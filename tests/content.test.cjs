const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const palette = fs.readFileSync('extension/palette.js', 'utf8');
const content = fs.readFileSync('extension/content.js', 'utf8');

function harness({ systemDark = false, stored = 'system', delayed = false, host = 'app.hubspot.com', pathname = '/', engine = true, canvas = true } = {}) {
  const attributes = {}, listeners = {}, docListeners = {};
  const system = { matches: systemDark, addEventListener: (_, fn) => { listeners.system = fn; }, removeEventListener: () => { delete listeners.system; } };
  let resolve;
  const initial = delayed ? new Promise(r => { resolve = r; }) : Promise.resolve({ mode: stored, darkGoogleCanvas: canvas });
  const h = { starts: 0, stops: 0, refreshes: 0, attributes, system,
    emitMode(value, area = 'local') { listeners.storage({mode: {newValue: value}}, area); },
    emitCanvas(value) { listeners.storage({darkGoogleCanvas: {newValue: value}}, 'local'); },
    emitSystem(value) { system.matches = value; listeners.system?.(); },
    finishInitial(value, darkGoogleCanvas = true) { resolve({mode:value, darkGoogleCanvas}); },
    resume() { docListeners.visibilitychange(); },
    pageShow() { listeners.pageshow(); }
  };
  const context = vm.createContext({
    location: { hostname: host, pathname },
    document: { hidden: false, documentElement: { getAttribute(k) { return attributes[k] ?? null; }, setAttribute(k,v) { attributes[k] = v; } },
      addEventListener(k,fn) { docListeners[k] = fn; } },
    window: { addEventListener(k,fn) { listeners[k] = fn; } },
    matchMedia: () => system,
    chrome: { storage: { onChanged: { addListener(fn) { listeners.storage = fn; } }, local: { get: () => initial } } },
    HSDMEngine: engine ? { start() {h.starts++;}, stop() {h.stops++;}, refresh() {h.refreshes++;} } : undefined
  });
  vm.runInContext(palette, context);
  vm.runInContext(content, context);
  return h;
}
const flush = () => new Promise(r => setImmediate(r));

test('an already open page tracks light → dark → light without reload', async () => {
  const h = harness(); await flush();
  assert.equal(h.attributes['data-hsdm-theme'],'light');
  h.emitSystem(true); assert.equal(h.attributes['data-hsdm-theme'],'dark');
  h.emitSystem(false); assert.equal(h.attributes['data-hsdm-theme'],'light');
});
test('manual overrides persist through OS changes and system mode restores syncing', async () => {
  const h = harness(); await flush();
  h.emitMode('dark'); h.emitSystem(false);
  assert.equal(h.attributes['data-hsdm-theme'],'dark');
  h.emitMode('light'); h.emitSystem(true);
  assert.equal(h.attributes['data-hsdm-theme'],'light');
  h.emitMode('system'); assert.equal(h.attributes['data-hsdm-theme'],'dark');
});
test('each tab receives preference changes; unrelated storage areas are ignored', async () => {
  const a = harness(), b = harness(); await flush();
  a.emitMode('dark'); b.emitMode('dark');
  assert.equal(a.attributes['data-hsdm-theme'],'dark');
  assert.equal(b.attributes['data-hsdm-theme'],'dark');
  a.emitMode('light','sync'); assert.equal(a.attributes['data-hsdm-theme'],'dark');
});
test('a delayed settings read cannot undo a newer preference change', async () => {
  const h = harness({delayed:true}); h.emitMode('dark'); h.finishInitial('light'); await flush();
  assert.equal(h.attributes['data-hsdm-theme'],'dark');
});
test('stored manual light is honored on a dark system; deleted settings restore system', async () => {
  const h = harness({systemDark:true,stored:'light'}); await flush();
  assert.equal(h.attributes['data-hsdm-theme'],'light');
  h.emitMode(undefined); assert.equal(h.attributes['data-hsdm-theme'],'dark');
});
test('resuming a suspended tab re-evaluates its current system preference', async () => {
  const h = harness(); await flush(); h.system.matches = true; h.resume();
  assert.equal(h.attributes['data-hsdm-theme'],'dark'); assert.equal(h.refreshes,1);
  h.system.matches = false; h.pageShow(); assert.equal(h.attributes['data-hsdm-theme'],'light');
});

test('all four Google apps sync modes without an engine, traversal, observers or timers', async () => {
  for (const [host, pathname, app] of [
    ['drive.google.com', '/drive/u/0/home', 'drive'],
    ['calendar.google.com', '/calendar/u/1/r/week', 'calendar'],
    ['docs.google.com', '/document/u/1/d/example/edit', 'docs'],
    ['docs.google.com', '/spreadsheets/d/example/edit', 'sheets']
  ]) {
    // The context intentionally supplies no timers, DOM query or style APIs.
    const h = harness({host, pathname, engine:false}); await flush();
    assert.equal(h.attributes['data-hsdm-app'], app);
    h.emitSystem(true); assert.equal(h.attributes['data-hsdm-theme'], 'dark');
    h.emitMode('light'); h.resume(); h.pageShow();
    assert.equal(h.attributes['data-hsdm-theme'], 'light');
    assert.equal(h.starts + h.stops + h.refreshes, 0);
  }
});
test('the canvas preference changes only the local presentation and survives mode changes', async () => {
  const h = harness({host:'docs.google.com', pathname:'/document/d/example/edit', engine:false, canvas:false}); await flush();
  assert.equal(h.attributes['data-hsdm-canvas'], 'original');
  h.emitCanvas(true); assert.equal(h.attributes['data-hsdm-canvas'], 'dark');
  h.emitMode('light'); h.emitMode('dark');
  assert.equal(h.attributes['data-hsdm-canvas'], 'dark');
  h.emitCanvas(undefined); assert.equal(h.attributes['data-hsdm-canvas'], 'dark');
});
test('a mode change during settings loading does not discard a stored canvas preference', async () => {
  const h = harness({delayed:true, host:'docs.google.com', pathname:'/spreadsheets/', engine:false});
  h.emitMode('dark'); h.finishInitial('light', false); await flush();
  assert.equal(h.attributes['data-hsdm-theme'], 'dark');
  assert.equal(h.attributes['data-hsdm-canvas'], 'original');
});
test('a canvas change during settings loading does not discard the stored mode', async () => {
  const h = harness({delayed:true, host:'docs.google.com', pathname:'/document/', engine:false});
  h.emitCanvas(false); h.finishInitial('dark', true); await flush();
  assert.equal(h.attributes['data-hsdm-theme'], 'dark');
  assert.equal(h.attributes['data-hsdm-canvas'], 'original');
});
test('unrequested Google products are not classified as supported apps', async () => {
  for (const [host, pathname] of [['accounts.google.com','/'], ['docs.google.com','/presentation/d/example/'], ['mail.google.com','/']]) {
    const h = harness({host, pathname, engine:false}); await flush();
    assert.equal(h.attributes['data-hsdm-app'], undefined);
  }
});

test('a saved Light override never starts an engine even on a dark OS with a slow settings read', async () => {
  const h = harness({systemDark:true, delayed:true});
  h.resume(); h.pageShow(); h.emitSystem(false); h.emitSystem(true);
  assert.equal(h.starts, 0);
  h.finishInitial('light'); await flush();
  for (let i=0; i<1000; i++) { h.resume(); h.pageShow(); h.emitSystem(i%2===0); }
  assert.equal(h.attributes['data-hsdm-theme'], 'light');
  assert.deepEqual([h.starts,h.stops,h.refreshes], [0,0,0]);
});
test('System on a light OS performs no engine calls while idle or when tabs resume', async () => {
  const h = harness(); await flush();
  for (let i=0; i<1000; i++) { h.resume(); h.pageShow(); }
  assert.deepEqual([h.starts,h.stops,h.refreshes], [0,0,0]);
  h.emitSystem(true); assert.equal(h.starts,1);
  h.emitSystem(true); assert.equal(h.starts,1);
  h.emitSystem(false); assert.equal(h.stops,1);
  for (let i=0; i<1000; i++) { h.resume(); h.pageShow(); }
  assert.deepEqual([h.starts,h.stops,h.refreshes], [1,1,0]);
});
