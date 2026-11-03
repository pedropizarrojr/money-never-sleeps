/* SPDX-License-Identifier: MIT */
(function (scope) {
  "use strict";
  const { transformValue, THEME } = scope.HSDMPalette;
  const prefix = 'html[data-hsdm-theme="dark"]';
  const skip = 'script,style,link,meta,head,img,picture,video,audio,canvas,source,track,svg,svg *,video *,[data-hsdm-preserve]';
  const properties = ["color", "background-color", "background-image", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "box-shadow"];
  // CSS supplies the baseline. Enhancement work has both a per-frame slice
  // and a per-document CPU budget; a busy app must never keep us scanning.
  const FRAME_MS = 3, DOCUMENT_MS = 100, MAX_NODES = 40, MAX_BUCKETS = 256;
  let active = false, frame = null, timer = null, serial = 0, usedMs = 0;
  let seen = new WeakSet(), records = new WeakMap();
  const jobs = [], queued = new Set(), repairs = new Set(), contexts = new Map(), colors = new Map();
  const now = () => performance.now();

  function schedule() {
    if (active && !document.hidden && frame === null && (jobs.length || repairs.size)) frame = requestAnimationFrame(flush);
  }

  function enqueue(root) {
    if (!active || usedMs >= DOCUMENT_MS || jobs.length >= 128 || !root || ![1, 11].includes(root.nodeType) || root.closest?.(skip) || queued.has(root)) return;
    for (let parent = root.parentNode; parent; parent = parent.parentNode) if (queued.has(parent)) return;
    // TreeWalker advances lazily; never materialize every node in a large feed.
    const walker = document.createTreeWalker(root, 1, { acceptNode(node) { return node.matches(skip) ? 2 : 1; } });
    jobs.push({ root, walker, first: root.nodeType === 1 });
    queued.add(root);
    schedule();
  }

  function register(root) {
    if (contexts.has(root)) return contexts.get(root);
    const shadow = root !== document;
    const context = { root, shadow, style: null, observer: null, buckets: new Map() };
    contexts.set(root, context);
    ensureStyle(context);
    if (usedMs >= DOCUMENT_MS) return context;
    context.observer = new MutationObserver((changes) => {
      for (const change of changes) {
        const target = change.target;
        if (target.closest?.('[data-hsdm-owned],style,script')) continue;
        if (change.type === "attributes") {
          const record = records.get(target);
          if (record && target.getAttribute("data-hsdm-li") !== record.id) repairs.add(target);
        } else {
          // Removal, text changes, hover classes and layout style changes do
          // not require rescanning existing elements or the document.
          for (const node of change.addedNodes) if (node.nodeType === 1) enqueue(node);
        }
      }
      schedule();
    });
    context.observer.observe(shadow ? root : document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["data-hsdm-li"]
    });
    return context;
  }

  function ensureStyle(context) {
    if (context.style?.isConnected) return;
    const style = document.createElement("style");
    style.id = context.shadow ? "hsdm-linkedin-shadow" : "hsdm-linkedin";
    style.dataset.hsdmOwned = "true";
    style.textContent = `@media screen{${context.shadow ? chatCss() : controlCss(prefix)}}`;
    (context.shadow ? context.root : document.head || document.documentElement).append(style);
    context.style = style;
    for (const [css, id] of context.buckets) style.sheet.insertRule(bucketRule(context, id, css), style.sheet.cssRules.length);
  }

  function bucketRule(context, id, css) {
    const target = `[data-hsdm-li="${id}"]`;
    const p = context.shadow ? `:host-context(${prefix})` : prefix;
    const selectors = context.shadow ? `${p} ${target}` : `${p}${target},${p} ${target}`;
    return `@media screen{${selectors}{${css}}}`;
  }

  function cssFor(element) {
    const source = getComputedStyle(element), declarations = [];
    for (const property of properties) {
      if (property.startsWith("border-") && parseFloat(source.getPropertyValue(property.replace("color", "width"))) === 0) continue;
      const value = source.getPropertyValue(property), key = property + ":" + value;
      let next = colors.get(key);
      if (next === undefined) {
        next = transformValue(property, value);
        if (colors.size < 1024) colors.set(key, next);
      }
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
    if (!active || document.hidden) return;
    const started = now(), measured = [], shadows = new Set();
    let visited = 0;
    // All computed-style reads finish before any selector attributes or rules
    // are written. Never disable whole stylesheets to measure one element.
    while (jobs.length && visited < MAX_NODES && now() - started < FRAME_MS && usedMs + now() - started < DOCUMENT_MS) {
      const job = jobs[0];
      const element = job.root.isConnected ? (job.first ? job.root : job.walker.nextNode()) : null;
      job.first = false;
      if (!element) { jobs.shift(); queued.delete(job.root); continue; }
      visited++;
      if (element.shadowRoot && !contexts.has(element.shadowRoot)) shadows.add(element.shadowRoot);
      if (seen.has(element)) continue;
      seen.add(element);
      const context = contexts.get(element.getRootNode()) || contexts.get(document);
      if (!context || context.buckets.size >= MAX_BUCKETS) continue;
      measured.push({ element, context, css: cssFor(element) });
    }
    for (const root of shadows) { register(root); enqueue(root); }
    for (const { element, context, css } of measured) {
      if (!css || !element.isConnected) continue;
      ensureStyle(context);
      let id = context.buckets.get(css);
      if (!id) {
        if (context.buckets.size >= MAX_BUCKETS) continue;
        id = String(++serial);
        context.style.sheet.insertRule(bucketRule(context, id, css), context.style.sheet.cssRules.length);
        context.buckets.set(css, id);
      }
      records.set(element, { id });
      if (element.getAttribute("data-hsdm-li") !== id) element.setAttribute("data-hsdm-li", id);
    }
    let repaired = 0;
    for (const element of repairs) {
      repairs.delete(element);
      const record = records.get(element);
      if (record && element.isConnected && element.getAttribute("data-hsdm-li") !== record.id) element.setAttribute("data-hsdm-li", record.id);
      if (++repaired >= MAX_NODES) break;
    }
    usedMs += now() - started;
    if (usedMs >= DOCUMENT_MS) {
      jobs.length = 0; queued.clear(); repairs.clear();
      for (const context of contexts.values()) context.observer?.disconnect();
    }
    schedule();
  }

  function discoverChat() {
    if (!active || document.hidden) return;
    for (const [root, context] of contexts) {
      if (context.shadow && !root.host.isConnected) {
        context.observer?.disconnect(); context.style.remove(); contexts.delete(root);
      } else ensureStyle(context);
    }
    const root = document.getElementById("interop-outlet")?.shadowRoot;
    if (root && !contexts.has(root)) { register(root); enqueue(root); }
  }

  function start() {
    if (active) return;
    active = true;
    usedMs = 0;
    register(document);
    discoverChat();
    timer = setInterval(discoverChat, 1000);
    enqueue(document.documentElement);
  }

  function stop() {
    if (!active) return;
    active = false;
    clearInterval(timer);
    timer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; serial = 0; usedMs = 0;
    for (const context of contexts.values()) {
      context.observer?.disconnect(); context.style.remove();
      context.root.querySelectorAll("[data-hsdm-li]").forEach(element => element.removeAttribute("data-hsdm-li"));
    }
    contexts.clear(); jobs.length = 0; queued.clear(); repairs.clear(); colors.clear();
    seen = new WeakSet(); records = new WeakMap();
  }

  scope.HSDMEngine = Object.freeze({ start, stop, refresh() { discoverChat(); schedule(); } });
})(globalThis);
