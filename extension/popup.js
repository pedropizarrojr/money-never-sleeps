/* SPDX-License-Identifier: MIT */
(async function () {
  "use strict";
  const { normalizeMode, isDark } = globalThis.HSDMPalette;
  const fieldset = document.querySelector("fieldset");
  const status = document.getElementById("status");
  const canvas = document.getElementById("dark-google-canvas");
  const auto = document.getElementById("auto-theme-updates");
  const checkUpdates = document.getElementById("check-updates");
  const updateStatus = document.getElementById("update-status");
  const version = chrome.runtime.getManifest().version;
  const system = matchMedia("(prefers-color-scheme: dark)");
  let mode = "system";
  let cache = null, updateState = {}, checking = false, ready = false;
  function renderUpdates() {
    const dark = isDark(mode, system.matches);
    checkUpdates.disabled = !ready || !auto.checked || !dark || checking;
    const theme = cache?.baseVersion === version ? `Theme update ${cache.revision}` : "Bundled theme";
    updateStatus.textContent = !auto.checked ? "Updates off. Using the bundled theme." : !dark ? "Updates pause in light mode." :
      checking ? "Checking GitHub…" : updateState.status === "extension-update-required" ? `The theme channel needs extension ${updateState.availableVersion}. Install that extension update manually.` :
      `${theme} · Extension ${version}${updateState.status === "offline" ? ". Couldn’t check GitHub. Keeping your current theme." : ""}`;
  }
  function render() {
    document.querySelector(`input[value="${mode}"]`).checked = true;
    status.textContent = mode === "system" ? `Following your system. Currently ${system.matches ? "dark" : "light"}.` :
      mode === "dark" ? "Dark mode is on across your supported apps." : "Each site’s original theme is on.";
    renderUpdates();
  }
  try {
    const settings = await chrome.storage.local.get({ mode: "system", darkGoogleCanvas: true, autoThemeUpdates: true, themeCache: null, themeUpdateState: {} });
    mode = normalizeMode(settings.mode);
    canvas.checked = settings.darkGoogleCanvas !== false;
    auto.checked = settings.autoThemeUpdates !== false;
    cache = settings.themeCache; updateState = settings.themeUpdateState || {}; ready = true;
    render();
    fieldset.disabled = false;
    canvas.disabled = false;
    auto.disabled = false;
  } catch {
    status.textContent = "Couldn’t load settings. Close and reopen this popup.";
  }
  system.addEventListener("change", render);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.mode) { mode = normalizeMode(changes.mode.newValue); render(); }
    if (area === "local" && changes.darkGoogleCanvas) canvas.checked = changes.darkGoogleCanvas.newValue !== false;
    if (area !== "local") return;
    if (changes.autoThemeUpdates) auto.checked = changes.autoThemeUpdates.newValue !== false;
    if (changes.themeCache) cache = changes.themeCache.newValue;
    if (changes.themeUpdateState) updateState = changes.themeUpdateState.newValue || {};
    renderUpdates();
  });
  auto.addEventListener("change", async () => {
    const value = auto.checked;
    auto.disabled = true;
    try { await chrome.storage.local.set({ autoThemeUpdates: value }); }
    catch { auto.checked = !value; updateStatus.textContent = "Couldn’t save update settings. Try again."; }
    finally { auto.disabled = false; renderUpdates(); }
  });
  checkUpdates.addEventListener("click", async () => {
    if (checkUpdates.disabled) return;
    checking = true; renderUpdates();
    try { updateState = await chrome.runtime.sendMessage({ type: "HSDM_THEME_CHECK", dark: true, force: true }) || {}; }
    catch { updateState = { status: "offline" }; }
    finally { checking = false; renderUpdates(); }
  });
  canvas.addEventListener("change", async () => {
    const value = canvas.checked;
    canvas.disabled = true;
    try { await chrome.storage.local.set({ darkGoogleCanvas: value }); }
    catch { canvas.checked = !value; status.textContent = "Couldn’t save. Try the document setting again."; }
    finally { canvas.disabled = false; }
  });
  fieldset.addEventListener("change", async (event) => {
    if (!event.target.matches('input[name="mode"]')) return;
    const previous = mode;
    mode = normalizeMode(event.target.value);
    fieldset.disabled = true;
    try { await chrome.storage.local.set({ mode }); render(); }
    catch { mode = previous; render(); status.textContent = "Couldn’t save. Try choosing the mode again."; }
    finally { fieldset.disabled = false; }
  });
})();
