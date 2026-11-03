/* SPDX-License-Identifier: MIT */
(function () {
  "use strict";
  const { normalizeMode, isDark } = globalThis.HSDMPalette;
  const system = matchMedia("(prefers-color-scheme: dark)");
  let mode = "system", revision = 0;

  function apply() {
    const root = document.documentElement;
    if (!root) return;
    const dark = isDark(mode, system.matches);
    root.setAttribute("data-hsdm-theme", dark ? "dark" : "light");
    root.setAttribute("data-hsdm-mode", mode);
    if (dark) globalThis.HSDMEngine.start();
    else globalThis.HSDMEngine.stop();
  }

  if (document.documentElement) apply();
  else {
    const bootstrap = new MutationObserver(() => {
      if (document.documentElement) { bootstrap.disconnect(); apply(); }
    });
    bootstrap.observe(document, { childList: true });
  }

  // Every open tab and permitted frame observes the OS/browser preference live.
  system.addEventListener("change", apply);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { apply(); globalThis.HSDMEngine.refresh(); }
  });
  window.addEventListener("pageshow", apply);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.mode) return;
    revision++;
    mode = normalizeMode(changes.mode.newValue);
    apply();
  });

  const initialRevision = revision;
  chrome.storage.local.get({ mode: "system" }).then((settings) => {
    // A slow initial read must not overwrite a newer change from the popup.
    if (revision !== initialRevision) return;
    mode = normalizeMode(settings.mode);
    apply();
  }).catch(() => { /* Keep system mode if storage is temporarily unavailable. */ });
})();
