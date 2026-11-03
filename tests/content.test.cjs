const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const palette = fs.readFileSync('extension/palette.js', 'utf8');
const content = fs.readFileSync('extension/content.js', 'utf8');

function harness({ systemDark = false, stored = 'system', delayed = false } = {}) {
  const attributes = {}, listeners = {}, docListeners = {};
  const system = { matches: systemDark, addEventListener: (_, fn) => { listeners.system = fn; } };
  let resolve;
  const initial = delayed ? new Promise(r => { resolve = r; }) : Promise.resolve({ mode: stored });
  const h = { starts: 0, stops: 0, refreshes: 0, attributes, system,
    emitMode(value, area = 'local') { listeners.storage({mode: {newValue: value}}, area); },
    emitSystem(value) { system.matches = value; listeners.system(); },
    finishInitial(value) { resolve({mode:value}); },
    resume() { docListeners.visibilitychange(); },
    pageShow() { listeners.pageshow(); }
  };
  const context = vm.createContext({
    document: { hidden: false, documentElement: { setAttribute(k,v) { attributes[k] = v; } },
      addEventListener(k,fn) { docListeners[k] = fn; } },
    window: { addEventListener(k,fn) { listeners[k] = fn; } },
    matchMedia: () => system,
    chrome: { storage: { onChanged: { addListener(fn) { listeners.storage = fn; } }, local: { get: () => initial } } },
    HSDMEngine: { start() {h.starts++;}, stop() {h.stops++;}, refresh() {h.refreshes++;} }
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
