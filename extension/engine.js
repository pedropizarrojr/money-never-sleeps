/* SPDX-License-Identifier: MIT */
(function (scope) {
  "use strict";
  const { transformValue } = scope.HSDMPalette;
  const selector = 'html[data-hsdm-theme="dark"]';
  let style = null, observer = null, timer = null, pending = false, active = false, epoch = 0;
  let lastSheetState = [];
  let inlineId = 0;
  let tokenCss = "", tokensDirty = true;
  const cache = new WeakMap();

  function sheetState() {
    const result = [];
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode === style || sheet.ownerNode?.dataset?.hsdmOwned === "true" || sheet.href?.startsWith("chrome-extension://")) continue;
      try { result.push([sheet, sheet.cssRules.length, sheet.disabled]); }
      catch { result.push([sheet, -1, sheet.disabled]); }
    }
    return result;
  }

  function declarations(source) {
    const out = [];
    for (const property of source) {
      const original = source.getPropertyValue(property);
      const next = transformValue(property, original);
      if (next !== original) out.push(`${property}:${next} !important;`);
    }
    return out.join("");
  }

  function scopeSelectors(text) {
    const parts = [];
    let start = 0, depth = 0, quote = "", escaped = false, pseudo = -1;
    function append(end) {
      const item = text.slice(start, end).trim();
      if (item) {
        // Pseudo-elements cannot appear inside :is(). Keep their suffix outside
        // the root match, and prefix each descendant selector separately.
        const base = pseudo < 0 ? item : text.slice(start, pseudo).trim() || "*";
        const suffix = pseudo < 0 ? "" : text.slice(pseudo, end).trim();
        parts.push(`:where(${selector}):is(${base})${suffix}`, `:where(${selector}) ${item}`);
      }
      start = end + 1; pseudo = -1;
    }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (quote) { if (c === quote) quote = ""; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth--;
      else if (!depth && c === ",") append(i);
      else if (!depth && pseudo < 0 && c === ":" && (text[i + 1] === ":" || /^:(?:before|after|first-line|first-letter)\b/.test(text.slice(i)))) pseudo = i;
    }
    append(text.length);
    return parts.join(",");
  }

  function rulesToCss(rules) {
    let css = "";
    for (const rule of rules) {
      if (rule.type === CSSRule.STYLE_RULE) {
        const body = declarations(rule.style);
        if (body) css += `${scopeSelectors(rule.selectorText)}{${body}}\n`;
      } else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
        const nested = rulesToCss(rule.cssRules);
        if (nested) css += `${rule.cssText.slice(0, rule.cssText.indexOf("{"))}{${nested}}\n`;
      } else if (rule.type === CSSRule.IMPORT_RULE) {
        try {
          const nested = rulesToCss(rule.styleSheet.cssRules);
          css += rule.media.mediaText ? `@media ${rule.media.mediaText}{${nested}}` : nested;
        } catch { /* Cross-origin CSS remains covered by the component fallback. */ }
      } else if (rule.cssRules && /^@(?:layer|container)\b/.test(rule.cssText)) {
        const nested = rulesToCss(rule.cssRules);
        if (nested) css += `${rule.cssText.slice(0, rule.cssText.indexOf("{"))}{${nested}}\n`;
      }
    }
    return css;
  }

  function refresh() {
    pending = false;
    if (!active || !document.documentElement) return;
    if (!style || !style.isConnected) {
      style = document.createElement("style");
      style.id = "hsdm-generated";
      (document.head || document.documentElement).append(style);
    }
    let css = "";
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode === style || sheet.ownerNode?.dataset?.hsdmOwned === "true" ||
          sheet.href?.startsWith("chrome-extension://")) continue;
      try {
        if (sheet.disabled) continue;
        const rules = sheet.cssRules;
        // CSS-in-JS may use insertRule(), which doesn't emit DOM mutations.
        // Poll rule counts; only regenerate changed stylesheets.
        const stamp = `${rules.length}:${sheet.ownerNode?.textContent || ""}`;
        let record = cache.get(sheet);
        if (!record || record.stamp !== stamp) {
          record = { stamp, css: rulesToCss(rules) };
          cache.set(sheet, record);
          tokensDirty = true;
        }
        css += sheet.media.mediaText ? `@media ${sheet.media.mediaText}{${record.css}}` : record.css;
      } catch { /* No fetching or extra host permissions for cross-origin sheets. */ }
    }
    if (tokensDirty) {
      // Some HubSpot token sheets are cross-origin and inaccessible through CSSOM.
      // Computed custom properties remain readable. Disable only our own generated
      // sheet during this synchronous read so colors never compound between scans.
      style.disabled = true;
      try {
        const source = getComputedStyle(document.documentElement);
        const tokens = [];
        for (const name of source) {
          if (!name.startsWith("--t-") && !name.startsWith("--trellis-")) continue;
          const value = source.getPropertyValue(name);
          const next = transformValue(name, value);
          if (next !== value) tokens.push(`${name}:${next} !important;`);
        }
        tokenCss = `${selector}{${tokens.join("")}}`;
        tokensDirty = false;
      } finally { style.disabled = false; }
    }
    css += tokenCss;
    // Cover inline colors without changing HubSpot's original style attributes.
    for (const element of document.querySelectorAll("[style]")) {
      if (element.closest("svg,canvas,video")) continue;
      const body = declarations(element.style);
      if (!body) continue;
      if (!element.hasAttribute("data-hsdm-inline")) element.setAttribute("data-hsdm-inline", String(++inlineId));
      css += `${selector} [data-hsdm-inline="${element.getAttribute("data-hsdm-inline")}"]{${body}}\n`;
    }
    css = `@media screen {${css}}`;
    if (style.textContent !== css) style.textContent = css;
    lastSheetState = sheetState();
  }

  function schedule(event) {
    if (event?.type === "load") tokensDirty = true;
    if (active && !pending) {
      pending = true;
      const scheduledEpoch = epoch;
      queueMicrotask(() => {
        if (scheduledEpoch === epoch) refresh();
      });
    }
  }

  function start() {
    if (active) return;
    active = true;
    tokensDirty = true;
    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target?.closest?.("#hsdm-generated")) return false;
        if (record.type === "attributes") return record.attributeName !== "class" || target === document.documentElement;
        if (target?.matches?.("style,link[rel=stylesheet]")) return true;
        return [...record.addedNodes].some((node) => node.nodeType === 1 &&
          node.id !== "hsdm-generated" && (node.matches("style,link[rel=stylesheet]") || node.querySelector("style,link[rel=stylesheet]")));
      });
      if (relevant) { tokensDirty = true; schedule(); }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "media", "disabled", "class"] });
    document.addEventListener("load", schedule, true);
    timer = setInterval(() => {
      if (document.hidden) return;
      const next = sheetState();
      if (next.length !== lastSheetState.length || next.some((entry, i) => entry.some((value, j) => value !== lastSheetState[i]?.[j]))) schedule();
    }, 250);
    refresh();
  }

  function stop() {
    active = false;
    epoch++;
    observer?.disconnect();
    document.removeEventListener("load", schedule, true);
    clearInterval(timer);
    pending = false;
    style?.remove();
    style = null;
    document.querySelectorAll("[data-hsdm-inline]").forEach((element) => element.removeAttribute("data-hsdm-inline"));
  }

  scope.HSDMEngine = Object.freeze({ start, stop, refresh });
})(globalThis);
