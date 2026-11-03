/* SPDX-License-Identifier: MIT */
(function (scope) {
  "use strict";
  const MODES = ["system", "dark", "light"];
  const THEME = Object.freeze({
    page: "#202631", surface: "#283240", raised: "#344153", input: "#252e3b",
    text: "#dce4ef", muted: "#abb8c9", controlBorder: "#8796aa", focus: "#93c5fd"
  });
  const normalizeMode = (mode) => MODES.includes(mode) ? mode : "system";
  const isDark = (mode, systemDark) => normalizeMode(mode) === "dark" ||
    (normalizeMode(mode) === "system" && systemDark);

  function parseColor(value) {
    const s = value.trim().toLowerCase();
    if (s === "white") return [255, 255, 255, 1];
    if (s === "black") return [0, 0, 0, 1];
    if (s.startsWith("#")) {
      let hex = s.slice(1);
      if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/.test(hex)) return null;
      if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1];
    }
    const match = s.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    const parts = match[1].trim().split(/[\s,/]+/);
    if (parts.length < 3 || parts.length > 4) return null;
    const rgb = parts.slice(0, 3).map((p) => parseFloat(p) * (p.endsWith("%") ? 2.55 : 1));
    const alpha = parts[3] === undefined ? 1 : parseFloat(parts[3]) / (parts[3].endsWith("%") ? 100 : 1);
    return [...rgb, alpha].every(Number.isFinite) ? [...rgb, alpha] : null;
  }

  function toHsl([red, green, blue]) {
    const [r, g, b] = [red, green, blue].map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }

  function roleFor(property) {
    if (property.startsWith("--")) {
      if (/data.?viz|reporting|chart|categorical|sequential/i.test(property)) return null;
      // Foreground on a colored button or badge must stay paired with that fill.
      if (/on[A-Z]/.test(property) || /inverse/i.test(property)) return null;
      if (/action|button|badge|tag/i.test(property) &&
          /primary.*(?:fg|text)|(?:fg|text).*primary/i.test(property)) return null;
      if (/background|(?:^|-)(bg|fill)(?:-|$)/i.test(property)) return "background";
      if (/border|divider|outline/i.test(property)) return "border";
      if (/(?:^|-)(fg|text|icon)(?:-|$)|-color(?:-|$)/i.test(property)) return "foreground";
      return null;
    }
    if (/^background(?:-color|-image)?$/.test(property) || property === "box-shadow") return "background";
    if (/^(?:border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|column-rule(?:-color)?)$/.test(property)) return "border";
    if (/^(?:color|text-decoration-color|caret-color|-webkit-text-fill-color)$/.test(property)) return "foreground";
    return null;
  }

  function transformColor(value, role) {
    const rgba = parseColor(value);
    if (!rgba || rgba[3] === 0 || !role) return value;
    let [h, s, l] = toHsl(rgba);
    const neutral = Math.max(...rgba.slice(0, 3)) - Math.min(...rgba.slice(0, 3)) < 28;
    if (role === "background") {
      // Lift opaque near-black UI surfaces into charcoal. Keep translucent
      // backdrops and saturated fills unchanged; media pixels are never read.
      if (neutral && l < 0.10 && rgba[3] >= 0.95) {
        return `hsl(216 19% 17% / ${rgba[3].toFixed(3)})`;
      }
      // Leave saturated status fills and already-dark chrome alone.
      if (l < 0.52) return value;
      l = neutral ? 0.17 + (1 - l) * 0.22 : 0.20 + (1 - l) * 0.20;
      if (neutral) { h = 216; s = 0.19; } else { s = Math.min(s, 0.45); }
    } else if (role === "foreground") {
      if (l > 0.72) return value;
      l = neutral ? 0.9 - l * 0.22 : Math.max(0.72, 1 - l * 0.42);
      if (neutral) { h = 213; s = 0.24; }
    } else {
      l = neutral ? 0.28 : Math.max(0.38, Math.min(0.55, l));
      if (neutral) { h = 216; s = 0.16; }
    }
    return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}% / ${rgba[3].toFixed(3)})`;
  }

  function transformValue(property, value) {
    const role = roleFor(property);
    // Never rewrite URLs, image assets, sizing, SVG fills, or chart colors.
    if (!role || /url\(|(?:image-set|paint)\(/i.test(value)) return value;
    return value.replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi,
      (color) => transformColor(color, role));
  }

  const api = Object.freeze({ MODES, THEME, normalizeMode, isDark, parseColor, roleFor, transformColor, transformValue });
  scope.HSDMPalette = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
