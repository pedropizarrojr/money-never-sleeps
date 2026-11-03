/* SPDX-License-Identifier: MIT
   Cache-first CSS updates. No page traversal, scroll handler or page reload. */
(function (scope) {
  "use strict";
  const policy = scope.HSDMUpdatePolicy;
  const app = /(?:^|\.)hubspot\.com$/.test(location.hostname) ? "hubspot" : /^(?:drive|docs|calendar)\.google\.com$/.test(location.hostname) ? "google" : "linkedin";
  const version = chrome.runtime.getManifest().version;
  const topLevel = window === window.top;
  const roots = new Map();
  let active = false, enabled = true, packet = null, timer = null, generation = 0;
  let loaded = false, cacheRevision = 0, enabledRevision = 0, stateRevision = 0;
  let state = {}, nextLocalCheck = 0;

  function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function removeStyles() { for (const entry of roots.values()) { entry.style?.remove(); entry.style = null; entry.revision = 0; } }
  function render() {
    if (!loaded) return;
    if (!active || !enabled || !packet) { removeStyles(); return; }
    let css;
    try { css = policy.compile(packet, app, version); } catch { packet = null; removeStyles(); return; }
    for (const [root, entry] of roots) {
      if (root !== document && !root.host.isConnected) { entry.style?.remove(); roots.delete(root); continue; }
      if (entry.style?.isConnected && entry.revision === packet.revision) continue;
      const text = root === document ? css : policy.compile(packet, app, version, true);
      if (!entry.style?.isConnected) {
        entry.style = document.createElement("style");
        entry.style.id = "hsdm-theme-update";
        entry.style.dataset.hsdmOwned = "true";
        (root === document ? document.head || document.documentElement : root).append(entry.style);
      }
      entry.style.textContent = text;
      entry.revision = packet.revision;
    }
  }
  function schedule() {
    clearTimer();
    if (!active || !enabled || !loaded || !topLevel || document.hidden) return;
    const due = Math.max(state.nextCheckAt || 0, nextLocalCheck);
    timer = setTimeout(check, Math.max(0, due - Date.now()));
  }
  function check() {
    timer = null;
    if (!active || !enabled || document.hidden || !topLevel) return;
    nextLocalCheck = Date.now() + 86400000;
    // Fixed message and no page URL/content. The worker owns the only network request.
    chrome.runtime.sendMessage({ type: "HSDM_THEME_CHECK", dark: true }).then(result => {
      if (typeof result?.nextCheckAt === "number") { state = result; nextLocalCheck = result.nextCheckAt; }
      schedule();
    }).catch(() => { nextLocalCheck = Date.now() + 21600000; schedule(); });
  }
  function changed(changes, area) {
    if (area !== "local") return;
    let paint = false;
    if (changes.autoThemeUpdates) { enabledRevision++; enabled = changes.autoThemeUpdates.newValue !== false; paint = true; }
    if (changes.themeCache) { cacheRevision++; packet = changes.themeCache.newValue || null; paint = true; }
    if (changes.themeUpdateState) { stateRevision++; state = changes.themeUpdateState.newValue || {}; }
    if (paint) render();
    if (changes.autoThemeUpdates || changes.themeUpdateState) schedule();
  }
  function start() {
    if (active) return;
    active = true; loaded = false;
    const stamp = ++generation, c = cacheRevision, e = enabledRevision, s = stateRevision;
    if (!roots.has(document)) roots.set(document, { style: null, revision: 0 });
    chrome.storage.onChanged.addListener(changed);
    chrome.storage.local.get({ autoThemeUpdates: true, themeCache: null, themeUpdateState: {} }).then(settings => {
      if (!active || generation !== stamp) return;
      if (cacheRevision === c) packet = settings.themeCache;
      if (enabledRevision === e) enabled = settings.autoThemeUpdates !== false;
      if (stateRevision === s) state = settings.themeUpdateState;
      loaded = true; render(); schedule();
    }).catch(() => { /* Storage failure keeps the bundled theme and does not fetch. */ });
  }
  function stop() {
    if (!active) return;
    active = false; loaded = false; generation++;
    nextLocalCheck = 0;
    clearTimer(); removeStyles(); packet = null;
    chrome.storage.onChanged.removeListener(changed);
    if (topLevel) chrome.runtime.sendMessage({ type: "HSDM_THEME_CANCEL" }).catch(() => {});
  }
  scope.HSDMThemeUpdates = Object.freeze({ start, stop, resume() { if (active) schedule(); },
    attach(root) { if (!roots.has(root)) roots.set(root, { style: null, revision: 0 }); if (active && loaded) render(); },
    detach(root) { roots.get(root)?.style?.remove(); roots.delete(root); }
  });
})(globalThis);
