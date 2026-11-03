const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../extension/update-policy.js');
const builder = require('../scripts/build-theme.cjs');
const version = require('../extension/manifest.json').version;
const root = path.resolve(__dirname, '..');
const base = builder.build(root, 1);
const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));

test('the publisher compiles all shipped dark CSS into bounded screen-only data', () => {
  assert.ok(Buffer.byteLength(JSON.stringify(base)) < policy.MAX_BYTES);
  for (const app of policy.APPS) {
    const css = policy.compile(base, app, version);
    assert.ok(css.startsWith('@media screen{'));
    assert.doesNotMatch(css, /html:not\(|@import|url\s*\(|javascript:/i);
  }
  assert.match(policy.compile(base, 'google', version), /data-hsdm-canvas="dark"/);
  assert.match(policy.compile(base, 'linkedin', version, true), /:host-context\(html\[data-hsdm-theme="dark"\]\)/);
});

test('unscoped selectors, network values, layout changes and incompatible data are rejected', () => {
  const cases = [
    p => { p.rules.hubspot[0].selectors = ['body']; },
    p => { p.rules.hubspot[0].selectors = [policy.PREFIX + ' body,body']; },
    p => { p.rules.hubspot[0].selectors = [policy.PREFIX + ' :has(*)']; },
    p => { p.rules.hubspot[0].selectors = [policy.PREFIX + ' \\75rl']; },
    p => { p.rules.hubspot[0].declarations = { color: 'red;} body{color:red' }; },
    p => { p.rules.hubspot[0].declarations = { background: 'url(https://example.com)' }; },
    p => { p.rules.hubspot[0].declarations = { color: 'var(--tracking)' }; },
    p => { p.rules.hubspot[0].declarations = { display: 'none' }; },
    p => { p.rules.hubspot[0].declarations = { position: 'fixed' }; },
    p => { p.rules.hubspot[0].declarations = { color: 'rgb(1,2,3' }; },
    p => { p.schema = 2; }, p => { p.baseVersion = '0.0.1'; },
    p => { p.revision = -1; }, p => { p.rules.extra = []; },
    p => { p.rules.google = Array(401).fill(p.rules.google[0]); }
  ];
  for (const mutate of cases) { const packet = clone(base); mutate(packet); assert.throws(() => policy.validate(packet, version)); }
  assert.throws(() => builder.parse('@media print{body{color:red}}'), /screen/);
  assert.throws(() => builder.parse('@import "https://example.com";'), /Invalid CSS/);
});

function worker({ settings = {}, fetchImpl } = {}) {
  const data = { mode: 'dark', autoThemeUpdates: true, ...settings };
  const listeners = [], timers = new Map();
  let message, timerId = 0;
  const calls = [];
  const clock = { value: 2000000000000 };
  const storage = {
    get: async defaults => Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, data[k] === undefined ? v : data[k]])),
    set: async values => { const changes = {}; for (const [k, v] of Object.entries(values)) { changes[k] = { newValue: v, oldValue: data[k] }; data[k] = v; } listeners.forEach(fn => fn(changes, 'local')); }
  };
  const context = vm.createContext({ HSDMUpdatePolicy: policy, importScripts() {}, AbortController, TextDecoder,
    Date: class extends Date { static now() { return clock.value; } },
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => { calls.push({ url, options }); return fetchImpl ? fetchImpl(url, options) : new Response(JSON.stringify(base)); },
    chrome: { runtime: { id: 'extension', getManifest: () => ({ version }), getURL: p => 'chrome-extension://extension/' + p, onMessage: { addListener(fn) { message = fn; } } },
      storage: { local: storage, onChanged: { addListener(fn) { listeners.push(fn); } } } }
  });
  vm.runInContext(fs.readFileSync('extension/update-worker.js', 'utf8'), context);
  return { data, calls, timers, clock, storage,
    send: (input = { type: 'HSDM_THEME_CHECK', dark: true }, sender = { id: 'extension', tab: { id: 1 } }) => new Promise(resolve => { const keep = message(input, sender, resolve); if (!keep && input.type !== 'HSDM_THEME_CANCEL') resolve(undefined); })
  };
}

test('worker deduplicates concurrent tabs, caches a theme and persists the daily throttle', async () => {
  const h = worker();
  await Promise.all([h.send(), h.send(), h.send()]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.data.themeCache.revision, 1);
  assert.equal(h.data.themeUpdateState.status, 'current');
  assert.equal(h.data.themeUpdateState.nextCheckAt, h.clock.value + 86400000);
  assert.equal(h.calls[0].options.credentials, 'omit');
  assert.equal(h.calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(h.calls[0].options.redirect, 'error');
  assert.match(h.calls[0].url, /^https:\/\/raw\.githubusercontent\.com\/pedropizarrojr\/money-never-sleeps\/theme-updates\/updates\/latest\.json$/);
  await h.send(); assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
  const restarted = worker({ settings: h.data }); await restarted.send();
  assert.equal(restarted.calls.length, 0);
});

test('Light mode, disabled updates, non-dark requests and other extensions never download', async () => {
  for (const settings of [{ mode: 'light' }, { autoThemeUpdates: false }]) {
    const h = worker({ settings }); await h.send(); assert.equal(h.calls.length, 0); assert.equal(h.timers.size, 0);
  }
  const h = worker();
  await h.send({ type: 'HSDM_THEME_CHECK', dark: false });
  await h.send(undefined, { id: 'other', tab: { id: 1 } });
  assert.equal(h.calls.length, 0);
});

test('network failure, invalid rules and oversized responses retain the last working theme', async () => {
  const bad = clone(base); bad.rules.google[0].declarations = { background: 'url(external)' };
  for (const fetchImpl of [async () => { throw new Error('Offline'); }, async () => new Response(JSON.stringify(bad)), async () => new Response('x'.repeat(policy.MAX_BYTES + 1)), async () => new Response('', { status: 404 })]) {
    const h = worker({ settings: { themeCache: base }, fetchImpl });
    await h.send();
    assert.equal(h.data.themeCache, base);
    assert.equal(h.data.themeUpdateState.status, 'offline');
    assert.equal(h.data.themeUpdateState.nextCheckAt, h.clock.value + 21600000);
  }
});

test('older revisions cannot roll back a cached theme; incompatible extension versions are skipped', async () => {
  const newer = clone(base); newer.revision = 10;
  const h = worker({ settings: { themeCache: newer } }); await h.send();
  assert.equal(h.data.themeCache.revision, 10);
  const incompatible = clone(base); incompatible.baseVersion = '0.6.0';
  const other = worker({ settings: { themeCache: base }, fetchImpl: async () => new Response(JSON.stringify(incompatible)) });
  await other.send();
  assert.equal(other.data.themeCache, base);
  assert.equal(other.data.themeUpdateState.status, 'extension-update-required');
});

test('switching to Light or disabling updates aborts an in-flight download without caching it', async () => {
  for (const change of [{ mode: 'light' }, { autoThemeUpdates: false }]) {
    let finish;
    const h = worker({ fetchImpl: (_, options) => new Promise(resolve => { finish = () => resolve(new Response(JSON.stringify(base))); }) });
    const pending = h.send(); await flush();
    await h.storage.set(change); assert.equal(h.calls[0].options.signal.aborted, true);
    finish(); await pending;
    assert.equal(h.data.themeCache, undefined);
    assert.equal(h.timers.size, 0);
    assert.equal(h.data.themeUpdateState.status, 'paused');
    assert.equal(h.data.themeUpdateState.nextCheckAt, 0);
  }
});

test('manual checks are popup-only and rate limited', async () => {
  const h = worker(); await h.send();
  h.clock.value += 61000;
  await h.send({ type: 'HSDM_THEME_CHECK', dark: true, force: true });
  assert.equal(h.calls.length, 1, 'Content scripts cannot bypass the daily throttle');
  const popup = { id: 'extension', url: 'chrome-extension://extension/popup.html' };
  await h.send({ type: 'HSDM_THEME_CHECK', dark: true, force: true }, popup);
  assert.equal(h.calls.length, 2);
  await h.send({ type: 'HSDM_THEME_CHECK', dark: true, force: true }, popup);
  assert.equal(h.calls.length, 2);
});

test('the five-second download timeout keeps the cached theme and schedules a bounded retry', async () => {
  const h = worker({ settings: { themeCache: base }, fetchImpl: (_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('timeout')));
  }) });
  const pending = h.send(); await flush();
  const timer = h.timers.values().next().value;
  assert.equal(timer.ms, 5000); timer.fn(); await pending;
  assert.equal(h.data.themeCache, base); assert.equal(h.data.themeUpdateState.status, 'offline');
  assert.equal(h.data.themeUpdateState.nextCheckAt, h.clock.value + 21600000);
  assert.equal(h.timers.size, 0);
});

function client({ settings = {}, iframe = false, delayed = false } = {}) {
  const data = { autoThemeUpdates: true, themeCache: base, themeUpdateState: { nextCheckAt: 2000086400000 }, ...settings };
  const listeners = new Set(), timers = new Map(), styles = [], messages = [];
  let timerId = 0, finish;
  const clock = { value: 2000000000000 };
  const document = { hidden: false, createElement() { const style = { dataset: {}, isConnected: false, textContent: '', remove() { this.isConnected = false; } }; styles.push(style); return style; } };
  document.head = { append(style) { style.isConnected = true; } }; document.documentElement = document.head;
  const window = {}; window.top = iframe ? {} : window;
  const context = vm.createContext({ HSDMUpdatePolicy: policy, document, window, location: { hostname: 'www.linkedin.com' },
    Date: class extends Date { static now() { return clock.value; } },
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); },
    chrome: { runtime: { getManifest: () => ({ version }), sendMessage: async message => { messages.push(message); return { nextCheckAt: clock.value + 86400000 }; } },
      storage: { local: { get: () => delayed ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(clone(data)) }, onChanged: { addListener(fn) { listeners.add(fn); }, removeListener(fn) { listeners.delete(fn); } } } }
  });
  vm.runInContext(fs.readFileSync('extension/theme-updates.js', 'utf8'), context);
  return { api: context.HSDMThemeUpdates, data, document, listeners, timers, styles, messages, clock,
    finish() { finish(clone(data)); },
    emit(values) { const changes = {}; for (const [k, v] of Object.entries(values)) changes[k] = { newValue: v }; for (const listener of listeners) listener(changes, 'local'); },
    async tick() { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); await flush(); }
  };
}

test('the update client does no storage, DOM, timer or messaging work before dark-mode activation', () => {
  const h = client();
  for (let i = 0; i < 1000; i++) { h.api.stop(); h.api.resume(); }
  assert.equal(h.listeners.size + h.timers.size + h.styles.length + h.messages.length, 0);
});

test('cached updates apply without a network wait; new data replaces CSS without a reload', async () => {
  const h = client(); h.api.start(); await flush();
  assert.equal(h.styles.length, 1); assert.equal(h.messages.length, 0);
  const style = h.styles[0]; assert.match(style.textContent, /@media screen/);
  const next = clone(base); next.revision = 2; next.rules.linkedin[0].declarations.color = '#dedad5 !important';
  h.emit({ themeCache: next });
  assert.equal(h.styles.length, 1); assert.match(style.textContent, /#dedad5/);
  h.api.stop();
  assert.equal(style.isConnected, false); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
  const messages = h.messages.length;
  for (let i = 0; i < 1000; i++) { h.api.stop(); h.api.resume(); }
  assert.equal(h.messages.length, messages);
});

test('updates off restores bundled styles, removes update timers and applies no downloaded data', async () => {
  const h = client(); h.api.start(); await flush();
  h.emit({ autoThemeUpdates: false });
  assert.equal(h.styles[0].isConnected, false); assert.equal(h.timers.size, 0);
  h.emit({ autoThemeUpdates: true }); assert.equal(h.styles[1].isConnected, true);
  h.document.hidden = true; h.api.resume(); assert.equal(h.timers.size, 0);
  h.document.hidden = false; h.api.resume(); assert.equal(h.timers.size, 1);
});

test('iframes apply cached styles but never schedule or request downloads', async () => {
  const h = client({ iframe: true, settings: { themeUpdateState: {} } }); h.api.start(); await flush();
  assert.equal(h.styles.length, 1); assert.equal(h.timers.size, 0);
  h.api.stop(); assert.equal(h.messages.length, 0);
});

test('known chat shadow roots receive dark-scoped updates and are released when detached', async () => {
  const h = client();
  const shadow = { host: { isConnected: true }, append(style) { style.isConnected = true; } };
  h.api.attach(shadow); h.api.start(); await flush();
  assert.equal(h.styles.length, 2); assert.match(h.styles[0].textContent, /:host-context/);
  h.api.detach(shadow); assert.equal(h.styles[0].isConnected, false);
  h.api.stop(); assert.ok(h.styles.every(style => !style.isConnected));
});

test('slow cache reads cannot undo a newer theme or turn automatic updates back on', async () => {
  const h = client({ delayed: true }); h.api.start();
  const next = clone(base); next.revision = 2; next.rules.linkedin[0].declarations.color = '#abcdef !important';
  h.emit({ themeCache: next, autoThemeUpdates: false });
  assert.equal(h.styles.length, 0, 'No cache applies before the saved opt-out is known');
  h.finish(); await flush(); assert.equal(h.styles.length, 0);
  h.emit({ autoThemeUpdates: true }); assert.match(h.styles[0].textContent, /#abcdef/);
});

test('a due dark-page timer requests a shared worker check; incompatible caches fall back to bundled CSS', async () => {
  const h = client({ settings: { themeUpdateState: {} } }); h.api.start(); await flush();
  await h.tick(); assert.equal(h.messages.length, 1); assert.equal(h.messages[0].type, 'HSDM_THEME_CHECK');
  assert.equal(h.timers.values().next().value.ms, 86400000);
  const bad = clone(base); bad.baseVersion = '0.0.1';
  const other = client({ settings: { themeCache: bad } }); other.api.start(); await flush();
  assert.equal(other.styles.length, 0);
});
