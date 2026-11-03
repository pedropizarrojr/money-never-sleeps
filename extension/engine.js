/* SPDX-License-Identifier: MIT */
(function (scope) {
  "use strict";
  const { transformValue } = scope.HSDMPalette;
  const selector = 'html[data-hsdm-theme="dark"]';
  let style = null, observer = null, timer = null, pending = null, active = false;
  let inlineId = 0;
  let tokenCss = "", tokensDirty = true;
  const cache = new WeakMap();

  function declarations(source) {
    const out = [];
    for (const property of source) {
      const original = source.getPropertyValue(property);
      const next = transformValue(property, original);
      if (next !== original) out.push(`${property}:${next} !important;`);
    }
    return out.join("");
  }

  function rulesToCss(rules) {
    let css = "";
    for (const rule of rules) {
      if (rule.type === CSSRule.STYLE_RULE) {
        // Preserve original selector grouping, including :is() and :not().
        const body = declarations(rule.style);
        if (body) css += `:where(${selector}):is(${rule.selectorText}),:where(${selector}) :is(${rule.selectorText}){${body}}\n`;
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
    pending = null;
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
  }

  function schedule(event) {
    if (event?.type === "load") tokensDirty = true;
    if (active && pending === null) pending = setTimeout(refresh, 80);
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
    timer = setInterval(() => { if (!document.hidden) schedule(); }, 1500);
    refresh();
  }

  function stop() {
    active = false;
    observer?.disconnect();
    document.removeEventListener("load", schedule, true);
    clearInterval(timer);
    clearTimeout(pending);
    pending = null;
    style?.remove();
    style = null;
    document.querySelectorAll("[data-hsdm-inline]").forEach((element) => element.removeAttribute("data-hsdm-inline"));
  }

  scope.HSDMEngine = Object.freeze({ start, stop, refresh });
})(globalThis);
