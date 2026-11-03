/* SPDX-License-Identifier: MIT
   Shared by the publisher, worker and page. Remote updates contain data only. */
(function (scope) {
  "use strict";
  const PREFIX = 'html[data-hsdm-theme="dark"]';
  const MAX_BYTES = 131072;
  const APPS = ["hubspot", "linkedin", "google"];
  const PROPERTIES = new Set(["background", "background-color", "background-image", "color", "color-scheme", "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "box-shadow", "outline", "outline-color", "outline-offset", "scrollbar-color", "accent-color", "caret-color", "opacity", "filter", "fill", "stroke"]);
  const FUNCTIONS = new Set(["rgb", "rgba", "hsl", "hsla", "linear-gradient", "invert", "hue-rotate", "sepia"]);
  function requireValue(ok, message) { if (!ok) throw new Error(message); }

  function splitSelectors(text) {
    const out = [];
    let start = 0, depth = 0, quote = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === quote) quote = ""; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") { depth--; requireValue(depth >= 0, "Unbalanced selector"); }
      else if (c === "," && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
    }
    requireValue(depth === 0 && !quote, "Unbalanced selector");
    out.push(text.slice(start).trim());
    return out;
  }

  function selector(text) {
    requireValue(typeof text === "string" && text.length <= 1024 && text.startsWith(PREFIX), "Unscoped theme selector");
    requireValue(/^(?:\s|\[|:|$)/.test(text.slice(PREFIX.length)), "Invalid theme root");
    requireValue(!/[\\{};@<\x00-\x1f]|\/\*|:has\s*\(/i.test(text), "Unsupported theme selector");
    requireValue(splitSelectors(text).length === 1, "Unscoped selector list");
    return text;
  }

  function declaration(property, value) {
    requireValue(PROPERTIES.has(property) || /^--(?:gm3-|cal-|trellis-color-)[a-z0-9-]{1,90}$/.test(property), "Unsupported theme property");
    requireValue(typeof value === "string" && value.length <= 256 && /^[#a-zA-Z0-9.,%() +/!\-]+$/.test(value), "Unsupported theme value");
    requireValue(!/url|expression|image-set|paint|attr|var\s*\(/i.test(value), "External or dynamic theme value");
    for (const match of value.matchAll(/([a-z-]+)\s*\(/gi)) requireValue(FUNCTIONS.has(match[1].toLowerCase()), "Unsupported theme function");
    let depth = 0;
    for (const c of value) { if (c === "(") depth++; if (c === ")") depth--; requireValue(depth >= 0 && depth <= 8, "Unbalanced theme value"); }
    requireValue(depth === 0, "Unbalanced theme value");
    requireValue(!value.includes("!") || / !important$/.test(value) && !value.slice(0, -11).includes("!"), "Invalid theme priority");
  }

  function validate(packet, baseVersion) {
    requireValue(packet && packet.schema === 1 && packet.baseVersion === baseVersion, "Theme needs a different extension version");
    requireValue(Number.isSafeInteger(packet.revision) && packet.revision > 0, "Invalid theme revision");
    requireValue(packet.rules && Object.keys(packet.rules).sort().join() === APPS.slice().sort().join(), "Invalid theme apps");
    requireValue(JSON.stringify(packet).length <= MAX_BYTES, "Theme exceeds size limit");
    let count = 0;
    for (const app of APPS) {
      const rules = packet.rules[app];
      requireValue(Array.isArray(rules) && rules.length > 0 && rules.length <= 400, "Invalid theme rules");
      for (const rule of rules) {
        requireValue(rule && Array.isArray(rule.selectors) && rule.selectors.length > 0 && rule.selectors.length <= 32, "Invalid theme selectors");
        rule.selectors.forEach(selector);
        requireValue(rule.declarations && !Array.isArray(rule.declarations), "Invalid theme declarations");
        const entries = Object.entries(rule.declarations);
        requireValue(entries.length > 0 && entries.length <= 128, "Invalid theme declarations");
        for (const [property, value] of entries) declaration(property, value);
        count += entries.length + rule.selectors.length;
        requireValue(count <= 4096, "Too many theme declarations");
      }
    }
    return packet;
  }

  function compile(packet, app, baseVersion, shadow = false) {
    validate(packet, baseVersion);
    requireValue(APPS.includes(app), "Unknown theme app");
    const css = packet.rules[app].map(rule => {
      const selectors = rule.selectors.map(s => shadow ? ':host-context(' + PREFIX + ')' + s.slice(PREFIX.length) : s);
      return selectors.join(",") + "{" + Object.entries(rule.declarations).map(([p, v]) => p + ":" + v + ";").join("") + "}";
    }).join("\n");
    return "@media screen{\n" + css + "\n}";
  }

  const api = Object.freeze({ PREFIX, MAX_BYTES, APPS, splitSelectors, validate, compile });
  scope.HSDMUpdatePolicy = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
