/* SPDX-License-Identifier: MIT
   Event-driven updater. Never reads page contents or reloads a tab. */
importScripts("update-policy.js");
(function () {
  "use strict";
  const policy = globalThis.HSDMUpdatePolicy;
  const URL = "https://raw.githubusercontent.com/pedropizarrojr/money-never-sleeps/theme-updates/updates/latest.json";
  const DAY = 86400000, RETRY = 21600000;
  let inFlight = null, controller = null;

  async function boundedJSON(response) {
    if (!response.ok || !response.body || Number(response.headers.get("Content-Length")) > policy.MAX_BYTES) throw new Error("Download unavailable");
    const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0, text = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > policy.MAX_BYTES) throw new Error("Download exceeds size limit");
        text += decoder.decode(value, { stream: true });
      }
      return JSON.parse(text + decoder.decode());
    } finally { await reader.cancel().catch(() => {}); }
  }

  async function check(force, signal) {
    const settings = await chrome.storage.local.get({ mode: "system", autoThemeUpdates: true, themeCache: null, themeUpdateState: {} });
    if (signal.aborted || settings.mode === "light" || settings.autoThemeUpdates === false) return { status: "inactive" };
    const now = Date.now(), previous = settings.themeUpdateState || {};
    if (now < (force ? (previous.lastAttempt || 0) + 60000 : previous.nextCheckAt || 0)) return previous;
    const state = { lastAttempt: now, nextCheckAt: now + RETRY, status: "checking" };
    async function paused() {
      state.status = "paused"; state.nextCheckAt = 0;
      await chrome.storage.local.set({ themeUpdateState: state });
      return state;
    }
    await chrome.storage.local.set({ themeUpdateState: state });
    if (signal.aborted) return paused();
    try {
      const response = await fetch(URL, { credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal });
      const packet = await boundedJSON(response);
      const version = chrome.runtime.getManifest().version;
      if (packet?.schema === 1 && typeof packet.baseVersion === "string" && /^\d+(?:\.\d+){0,3}$/.test(packet.baseVersion) && packet.baseVersion !== version) {
        state.status = "extension-update-required";
        state.availableVersion = packet.baseVersion;
      } else {
        policy.validate(packet, version);
        let cachedRevision = 0;
        try { policy.validate(settings.themeCache, version); cachedRevision = settings.themeCache.revision; } catch { /* Bundled theme remains the fallback. */ }
        // Re-check preferences after the request so a late response cannot reactivate updates.
        const current = await chrome.storage.local.get({ mode: "system", autoThemeUpdates: true });
        if (signal.aborted || current.mode === "light" || current.autoThemeUpdates === false) return paused();
        if (packet.revision > cachedRevision) await chrome.storage.local.set({ themeCache: packet });
        state.status = "current";
        state.revision = Math.max(cachedRevision, packet.revision);
      }
      state.nextCheckAt = now + DAY;
      state.lastSuccess = now;
    } catch {
      if (signal.aborted && signal.reason !== "timeout") return paused();
      state.status = "offline"; // Retain the last working cache, including on invalid data.
    }
    if (!signal.aborted || signal.reason === "timeout") await chrome.storage.local.set({ themeUpdateState: state });
    return state;
  }

  function checkOnce(force) {
    if (inFlight) return inFlight;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort("timeout"), 5000);
    inFlight = check(force, controller.signal).finally(() => { clearTimeout(timeout); inFlight = null; controller = null; });
    return inFlight;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.mode?.newValue === "light" || changes.autoThemeUpdates?.newValue === false)) controller?.abort("inactive");
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    const popup = sender.url === chrome.runtime.getURL("popup.html");
    if (!popup && !sender.tab) return false;
    if (message?.type === "HSDM_THEME_CANCEL") { controller?.abort("inactive"); reply({ status: "inactive" }); return false; }
    if (message?.type !== "HSDM_THEME_CHECK" || message.dark !== true) return false;
    checkOnce(popup && message.force === true).then(reply, () => reply({ status: "offline" }));
    return true;
  });
})();
