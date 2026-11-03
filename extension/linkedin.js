/* SPDX-License-Identifier: MIT */
(function (scope) {
  "use strict";
  const { transformValue } = scope.HSDMPalette;
  const prefix = 'html[data-hsdm-theme="dark"]';
  const skip = 'script,style,link,meta,head,img,picture,video,audio,canvas,source,track,svg,svg *,video *,[data-hsdm-preserve]';
  const properties = ["color", "background-color", "background-image", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "box-shadow"];
  let active = false, style = null, observer = null, frame = null, serial = 0;
  let queue = [], offset = 0;
  const dirty = new Set(), records = new Map();

  function enqueue(root) {
    if (!active || !root || root.nodeType !== 1 || root.closest?.(skip)) return;
    dirty.add(root);
    if (frame === null) frame = requestAnimationFrame(flush);
  }

  function cssFor(element) {
    const source = getComputedStyle(element);
    const declarations = [];
    for (const property of properties) {
      if (property.startsWith("border-")) {
        const width = source.getPropertyValue(property.replace("color", "width"));
        if (parseFloat(width) === 0) continue;
      }
      const value = source.getPropertyValue(property);
      const next = transformValue(property, value);
      if (next !== value) declarations.push(`${property}:${next} !important;`);
    }
    return declarations.join("");
  }

  function flush() {
    frame = null;
    if (!active) return;
    if (!style?.isConnected) {
      style = document.createElement("style");
      style.id = "hsdm-linkedin";
      style.dataset.hsdmOwned = "true";
      (document.head || document.documentElement).append(style);
    }
    if (dirty.size) {
      const candidates = new Set(queue.slice(offset));
      // Changes to an ancestor can affect inherited colors throughout its subtree.
      for (const root of dirty) {
        if (!root.isConnected) continue;
        candidates.add(root);
        root.querySelectorAll("*").forEach((node) => candidates.add(node));
      }
      dirty.clear();
      queue = [...candidates].filter((node) => !node.closest(skip));
      offset = 0;
    }
    // Always measure original site colors, so repeated scans never compound.
    // The sheet is restored within this synchronous callback before any paint.
    style.disabled = true;
    try {
      const end = Math.min(offset + 250, queue.length);
      for (; offset < end; offset++) {
        const element = queue[offset];
        if (!element.isConnected) continue;
        const css = cssFor(element);
        const existing = records.get(element);
        if (!css) { records.delete(element); element.removeAttribute("data-hsdm-li"); continue; }
        const id = existing?.id || String(++serial);
        element.setAttribute("data-hsdm-li", id);
        records.set(element, { id, css });
      }
    } finally { style.disabled = false; }
    let css = "";
    for (const [element, record] of records) {
      if (!element.isConnected) { records.delete(element); continue; }
      const target = `[data-hsdm-li="${record.id}"]`;
      css += `${prefix}${target},${prefix} ${target}{${record.css}}\n`;
    }
    const text = `@media screen{${css}}`;
    if (style.textContent !== text) style.textContent = text;
    if (offset < queue.length) frame = requestAnimationFrame(flush);
    else { queue = []; offset = 0; }
  }

  function onLoad(event) {
    if (event.target?.matches?.('link[rel="stylesheet"]')) enqueue(document.documentElement);
  }

  function start() {
    if (active) return;
    active = true;
    observer = new MutationObserver((changes) => {
      for (const change of changes) {
        const target = change.target;
        if (target.nodeType !== 1 || target.closest?.("#hsdm-linkedin,style,script")) continue;
        if (change.type === "attributes") enqueue(target);
        else if (change.type === "childList") {
          change.addedNodes.forEach((node) => { if (node.nodeType === 1) enqueue(node); });
          // Prune detached nodes even when a render only removes content.
          if (change.removedNodes.length && frame === null) frame = requestAnimationFrame(flush);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    document.addEventListener("load", onLoad, true);
    enqueue(document.documentElement);
  }

  function stop() {
    active = false;
    observer?.disconnect();
    document.removeEventListener("load", onLoad, true);
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    style?.remove(); style = null;
    for (const element of records.keys()) element.removeAttribute("data-hsdm-li");
    records.clear(); dirty.clear(); queue = []; offset = 0;
  }

  scope.HSDMEngine = Object.freeze({ start, stop, refresh() { enqueue(document.documentElement); } });
})(globalThis);
