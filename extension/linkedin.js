/* SPDX-License-Identifier: MIT */
(function (scope) {
  "use strict";
  const { transformValue, THEME } = scope.HSDMPalette;
  const prefix = 'html[data-hsdm-theme="dark"]';
  const skip = 'script,style,link,meta,head,img,picture,video,audio,canvas,source,track,svg,svg *,video *,[data-hsdm-preserve]';
  const properties = ["color", "background-color", "background-image", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "box-shadow"];
  let active = false, frame = null, timer = null, serial = 0, microtaskQueued = false, epoch = 0;
  let queue = [], offset = 0;
  const dirty = new Set(), records = new Map(), contexts = new Map();

  function sheetState(root) {
    const sheets = new Set([...(root.styleSheets || []), ...(root.adoptedStyleSheets || [])]);
    return [...sheets].filter((sheet) => sheet.ownerNode?.dataset?.hsdmOwned !== "true").map((sheet) => {
      let count = -1;
      try { count = sheet.cssRules.length; } catch { /* Cross-origin load events cover these sheets. */ }
      return [sheet, count, sheet.disabled];
    });
  }

  function enqueue(root) {
    if (!active || !root || ![1, 11].includes(root.nodeType) || root.closest?.(skip)) return;
    for (let parent = root.parentNode; parent; parent = parent.parentNode) {
      if (dirty.has(parent)) return;
    }
    dirty.add(root);
    // MutationObserver callbacks and microtasks run before paint. Style the
    // first batch in that turn instead of waiting for another animation frame.
    if (!microtaskQueued) {
      microtaskQueued = true;
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      const scheduledEpoch = epoch;
      queueMicrotask(() => {
        if (scheduledEpoch !== epoch) return;
        microtaskQueued = false;
        flush();
      });
    }
  }

  function register(root) {
    if (contexts.has(root)) return contexts.get(root);
    const shadow = root !== document;
    const context = { root, shadow, style: null, observer: null, sheets: sheetState(root) };
    contexts.set(root, context);
    context.observer = new MutationObserver((changes) => {
      for (const change of changes) {
        const target = change.target.nodeType === 3 ? change.target.parentElement : change.target;
        if (!target || target.closest?.('[data-hsdm-owned]')) continue;
        if (change.attributeName === "data-hsdm-li") {
          // Hydration can remove attributes on a reused element. Repair only
          // missing/replaced markers; ignore our own writes to avoid a loop.
          const record = records.get(target);
          if (record && target.getAttribute("data-hsdm-li") !== record.id) enqueue(target);
          continue;
        }
        const isSheet = (node) => node.nodeType === 1 && !node.dataset?.hsdmOwned &&
          (node.matches?.('style,link[rel="stylesheet"]') || node.querySelector?.('style,link[rel="stylesheet"]'));
        if (target.matches?.('style,link[rel="stylesheet"]') ||
            [...(change.addedNodes || []), ...(change.removedNodes || [])].some(isSheet)) {
          enqueue(shadow ? root : document.documentElement);
          continue;
        }
        if (![1, 11].includes(target.nodeType) || target.closest?.('style,script')) continue;
        if (change.type === "attributes") enqueue(target);
        else if (change.type === "childList") {
          change.addedNodes.forEach((node) => { if (node.nodeType === 1) enqueue(node); });
          if (change.removedNodes.length && !change.addedNodes.length) enqueue(context.shadow ? root : document.documentElement);
        }
      }
    });
    context.observer.observe(shadow ? root : document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["class", "style", "href", "rel", "media", "disabled", "data-hsdm-li"]
    });
    return context;
  }

  function ensureStyle(context) {
    if (context.style?.isConnected) return;
    const style = document.createElement("style");
    style.id = context.shadow ? "hsdm-linkedin-shadow" : "hsdm-linkedin";
    style.dataset.hsdmOwned = "true";
    (context.shadow ? context.root : document.head || document.documentElement).append(style);
    context.style = style;
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

  function chatCss() {
    const p = `:host-context(${prefix})`;
    return `
${p}{color-scheme:dark;color:${THEME.text};}
${p} :is(.msg-overlay-list-bubble,.msg-overlay-conversation-bubble){background:${THEME.surface} !important;color:${THEME.text} !important;border:1px solid ${THEME.divider} !important;box-shadow:0 8px 24px rgba(0,0,0,.3) !important;}
${p} :is(.msg-overlay-bubble-header,.msg-overlay-conversation-bubble-header){background:${THEME.raised} !important;color:${THEME.text} !important;border-bottom:1px solid ${THEME.divider} !important;}
${p} :is(.msg-s-message-list-container,.msg-s-message-list-content,.msg-convo-wrapper,.msg-overlay-conversation-bubble__content-wrapper,.msg-conversation-list-container){background:${THEME.surface} !important;color:${THEME.text} !important;}
${p} :is(.msg-form,.msg-form__footer,.msg-form__msg-content-container){background:${THEME.raised} !important;color:${THEME.text} !important;border-color:${THEME.divider} !important;}
${p} :is(.msg-form__contenteditable,textarea,input){background:${THEME.input} !important;color:${THEME.text} !important;caret-color:${THEME.text} !important;border-color:${THEME.controlBorder} !important;}
${p} [contenteditable=true]{color:${THEME.text} !important;caret-color:${THEME.text} !important;}
${p} :is(button,a) svg[fill=currentColor]{color:inherit !important;fill:currentColor;}
${p} :focus-visible{outline:2px solid ${THEME.focus} !important;outline-offset:2px;}
${p} ::placeholder{color:${THEME.muted} !important;opacity:1;}
${p} ::selection{background:#62533b;color:${THEME.text};}
${controlCss(p)}
`;
  }

  function controlCss(p) {
    // LinkedIn's header symbols often use <svg><use> without a fill attribute.
    // They must be targeted by purpose, rather than svg[fill=currentColor].
    const buttons = `${p} :is(.msg-overlay-bubble-header__controls button,.msg-overlay-conversation-bubble-header button,button[class*="msg-"]:not(:disabled):not([aria-disabled="true"]))`;
    return `${buttons}{color:#fff !important;}
${buttons} :is(svg,li-icon){color:#fff !important;fill:#fff !important;}
${buttons} svg :is(use,path){fill:inherit !important;}
${buttons} svg [stroke]:not([stroke="none"]){stroke:#fff !important;}`;
  }

  function flush() {
    frame = null;
    if (!active) return;
    if (dirty.size) {
      const candidates = new Set();
      // Open shadow trees need their own stylesheet and observer. LinkedIn's
      // interop messaging widgets are outside the main document's CSS scope.
      for (const root of dirty) {
        if (!root.isConnected) continue;
        let covered = false;
        for (let parent = root.parentNode; parent; parent = parent.parentNode) {
          if (dirty.has(parent)) { covered = true; break; }
        }
        if (covered) continue;
        const nodes = [...root.querySelectorAll("*")];
        if (root.nodeType === 1) nodes.unshift(root);
        for (const node of nodes) {
          candidates.add(node);
          if (node.shadowRoot && !contexts.has(node.shadowRoot)) {
            register(node.shadowRoot);
            dirty.add(node.shadowRoot);
          }
        }
      }
      // Fresh UI goes first; older offscreen work can finish in later frames.
      for (const node of queue.slice(offset)) candidates.add(node);
      dirty.clear();
      queue = [...candidates].filter((node) => !node.closest(skip));
      offset = 0;
    }
    for (const context of contexts.values()) ensureStyle(context);
    // Disable every generated sheet together, including shadow styles, so
    // measuring inherited colors never compounds our previous transformations.
    for (const context of contexts.values()) context.style.disabled = true;
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
    } finally {
      for (const context of contexts.values()) context.style.disabled = false;
    }
    const cssByRoot = new Map();
    for (const [element, record] of records) {
      if (!element.isConnected) { records.delete(element); continue; }
      const currentRoot = element.getRootNode?.() || document;
      const context = contexts.get(currentRoot);
      if (!context) { enqueue(element); continue; }
      const target = `[data-hsdm-li="${record.id}"]`;
      const p = context.shadow ? `:host-context(${prefix})` : prefix;
      const rule = context.shadow ? `${p} ${target}{${record.css}}\n` : `${p}${target},${p} ${target}{${record.css}}\n`;
      cssByRoot.set(currentRoot, (cssByRoot.get(currentRoot) || "") + rule);
    }
    for (const [root, context] of contexts) {
      if (context.shadow && !root.host.isConnected) {
        context.observer.disconnect(); context.style.remove(); contexts.delete(root); continue;
      }
      const text = `@media screen{${cssByRoot.get(root) || ""}${context.shadow ? chatCss() : controlCss(prefix)}}`;
      if (context.style.textContent !== text) context.style.textContent = text;
    }
    if (offset < queue.length || dirty.size) {
      if (frame === null) frame = requestAnimationFrame(flush);
    } else { queue = []; offset = 0; }
  }

  function onLoad(event) {
    if (event.target?.matches?.('link[rel="stylesheet"]')) enqueue(document.documentElement);
  }

  function start() {
    if (active) return;
    active = true;
    register(document);
    document.addEventListener("load", onLoad, true);
    // CSS-in-JS insertRule() and attachShadow() emit no DOM mutations. Check
    // lightweight fingerprints; only rescan when page styles actually change.
    timer = setInterval(() => {
      if (document.hidden) return;
      for (const context of contexts.values()) {
        const next = sheetState(context.root);
        if (next.length !== context.sheets.length || next.some((entry, i) => entry.some((value, j) => value !== context.sheets[i]?.[j]))) {
          context.sheets = next;
          enqueue(context.shadow ? context.root : document.documentElement);
        }
      }
      const root = document.getElementById("interop-outlet")?.shadowRoot;
      if (root && !contexts.has(root)) { register(root); enqueue(root); }
    }, 250);
    enqueue(document.documentElement);
  }

  function stop() {
    active = false;
    epoch++;
    microtaskQueued = false;
    document.removeEventListener("load", onLoad, true);
    clearInterval(timer);
    for (const context of contexts.values()) { context.observer.disconnect(); context.style?.remove(); }
    contexts.clear();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const element of records.keys()) element.removeAttribute("data-hsdm-li");
    records.clear(); dirty.clear(); queue = []; offset = 0;
  }

  scope.HSDMEngine = Object.freeze({ start, stop, refresh() { enqueue(document.documentElement); } });
})(globalThis);
