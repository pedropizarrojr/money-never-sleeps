/* SPDX-License-Identifier: MIT */
(function () {
  "use strict";
  const { normalizeMode, isDark } = globalThis.HSDMPalette;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const app = location.hostname === "drive.google.com" ? "drive" :
    location.hostname === "calendar.google.com" ? "calendar" :
    location.hostname === "docs.google.com" ?
      (/^\/document(?:\/|$)/.test(location.pathname) ? "docs" :
        /^\/spreadsheets(?:\/|$)/.test(location.pathname) ? "sheets" : null) : null;
  // Google uses static CSS only. No engine, DOM traversal or polling is started.
  const engine = globalThis.HSDMEngine;
  let mode = "system", darkGoogleCanvas = true, modeRevision = 0, canvasRevision = 0;
  let settingsReady = false, engineRunning = false, systemListening = false;

  function watchSystem() {
    const listen = mode === "system";
    if (listen === systemListening) return;
    systemListening = listen;
    if (listen) system.addEventListener("change", apply);
    else system.removeEventListener("change", apply);
  }

  function attribute(root, name, value) {
    if (root.getAttribute(name) !== value) root.setAttribute(name, value);
  }

  function apply() {
    const root = document.documentElement;
    if (!root) return;
    const dark = isDark(mode, system.matches);
    if (app) {
      attribute(root, "data-hsdm-app", app);
      attribute(root, "data-hsdm-canvas", darkGoogleCanvas ? "dark" : "original");
    }
    attribute(root, "data-hsdm-theme", dark ? "dark" : "light");
    attribute(root, "data-hsdm-mode", mode);
    // Honor a saved Light override before starting any expensive theme work.
    // Only transitions start/stop the engine, never a routine tab activation.
    if (settingsReady && engine && dark !== engineRunning) {
      engineRunning = dark;
      if (dark) engine.start();
      else engine.stop();
    }
  }

  if (document.documentElement) apply();
  else {
    const bootstrap = new MutationObserver(() => {
      if (document.documentElement) { bootstrap.disconnect(); apply(); }
    });
    bootstrap.observe(document, { childList: true });
  }

  // Every open tab and permitted frame observes the OS/browser preference live.
  watchSystem();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (mode === "system") apply();
    if (engineRunning) engine.refresh();
  });
  window.addEventListener("pageshow", () => { if (mode === "system" || engineRunning) apply(); });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || (!changes.mode && !changes.darkGoogleCanvas)) return;
    if (changes.mode) {
      modeRevision++; mode = normalizeMode(changes.mode.newValue);
      settingsReady = true; watchSystem();
    }
    if (changes.darkGoogleCanvas) {
      canvasRevision++;
      darkGoogleCanvas = changes.darkGoogleCanvas.newValue !== false;
    }
    apply();
  });

  const initialModeRevision = modeRevision, initialCanvasRevision = canvasRevision;
  chrome.storage.local.get({ mode: "system", darkGoogleCanvas: true }).then((settings) => {
    // A slow initial read must not overwrite a newer change from the popup.
    if (modeRevision === initialModeRevision) mode = normalizeMode(settings.mode);
    if (canvasRevision === initialCanvasRevision) darkGoogleCanvas = settings.darkGoogleCanvas !== false;
    settingsReady = true;
    watchSystem();
    apply();
  }).catch(() => {
    settingsReady = true;
    apply(); // Keep system mode if storage is temporarily unavailable.
  });
})();
