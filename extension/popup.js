/* SPDX-License-Identifier: MIT */
(async function () {
  "use strict";
  const { normalizeMode } = globalThis.HSDMPalette;
  const fieldset = document.querySelector("fieldset");
  const status = document.getElementById("status");
  const system = matchMedia("(prefers-color-scheme: dark)");
  let mode = "system";
  function render() {
    document.querySelector(`input[value="${mode}"]`).checked = true;
    status.textContent = mode === "system" ? `Following your system. Currently ${system.matches ? "dark" : "light"}.` :
      mode === "dark" ? "Dark mode is on for HubSpot and LinkedIn." : "Each site’s original theme is on.";
  }
  try {
    const settings = await chrome.storage.local.get({ mode: "system" });
    mode = normalizeMode(settings.mode);
    render();
    fieldset.disabled = false;
  } catch {
    status.textContent = "Couldn’t load settings. Close and reopen this popup.";
  }
  system.addEventListener("change", render);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.mode) { mode = normalizeMode(changes.mode.newValue); render(); }
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
