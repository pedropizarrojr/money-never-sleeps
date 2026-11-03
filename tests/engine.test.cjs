const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function decl(values) {
  return Object.assign(Object.keys(values), {getPropertyValue: name => values[name]});
}
function harness() {
  let node, interval, observerCallback, load, reads = 0;
  let clock = 0, serial = 0;const frames = new Map(), delays = new Map();
  const sheet = {cssRules: [], ownerNode: {textContent: ''}, media: {mediaText: ''}};
  const inline = {style: decl({color:'#333'}), attr: {}, closest() {return null;},
    hasAttribute(k) {return k in this.attr;}, setAttribute(k,v) {this.attr[k]=v;},
    getAttribute(k) {return this.attr[k];}, removeAttribute(k) {delete this.attr[k];}};
  const doc = {hidden:false, styleSheets:[sheet],
    documentElement:{nodeType:1}, head:{append(value){node=value;node.isConnected=true;}},
    createElement() {return {textContent:'',dataset:{},isConnected:false,remove(){this.isConnected=false;}};},
    querySelectorAll(q) {return q==='[style]' ? [inline] : [inline];},
    addEventListener(name,fn){if(name==='load')load=fn;},removeEventListener(){}};
  const context = vm.createContext({document:doc,performance:{now:()=>clock},
    CSSRule:{STYLE_RULE:1,IMPORT_RULE:3,MEDIA_RULE:4,SUPPORTS_RULE:12},
    getComputedStyle() {reads++;return decl({'--trellis-color-text-primary':'#333','--t-sys-color-foundational-bg-normal-default':'#fff'});},
    MutationObserver:class {constructor(fn){observerCallback=fn;}observe(){}disconnect(){}},
    queueMicrotask(fn){fn();},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
    setTimeout(fn){const id=++serial;delays.set(id,fn);return id;},clearTimeout(id){delays.delete(id);},
    setInterval(fn){interval=fn;return 1;},clearInterval(){}
  });
  vm.runInContext(fs.readFileSync('extension/palette.js','utf8'),context);
  vm.runInContext(fs.readFileSync('extension/engine.js','utf8'),context);
  function drain(){while(frames.size||delays.size){clock+=100;for(const [id,fn] of [...delays]){delays.delete(id);fn();}for(const [id,fn] of [...frames]){frames.delete(id);fn();}}}
  const engine={start(){context.HSDMEngine.start();drain();},stop:context.HSDMEngine.stop,refresh(){context.HSDMEngine.refresh();drain();}};
  return {engine,drain,pending:()=>frames.size+delays.size,load:event=>load(event),realEngine:context.HSDMEngine,sheet,doc,inline,node:()=>node,reads:()=>reads,
    tick:()=>{interval();drain();}, mutate:records=>observerCallback(records),
    rule:(selectorText,values)=>({type:1,selectorText,style:decl(values)})};
}

test('generates scoped screen-only CSS, token overrides and inline fallback', () => {
  const h=harness(); h.sheet.cssRules.push(h.rule('.card',{background:'#fff',color:'#333',width:'100px'}));
  h.engine.start(); const css=h.node().textContent;
  assert.match(css, /^@media screen/); assert.match(css, /html\[data-hsdm-theme="dark"\]/);
  assert.match(css, /:is\(\.card\)/); assert.match(css, /background:hsl\(/);
  assert.match(css, /--trellis-color-text-primary:hsl\(/);
  assert.match(css, /data-hsdm-inline="1"/); assert.doesNotMatch(css,/width:/);
});
test('new CSS-in-JS rules and newly attached stylesheets are picked up', () => {
  const h=harness(); h.engine.start();
  h.sheet.cssRules.push(h.rule('.late',{background:'#fff'})); h.engine.refresh();
  assert.match(h.node().textContent, /:is\(\.late\)/);
  h.doc.styleSheets.push({cssRules:[h.rule('.new',{color:'#333'})],media:{mediaText:''}});
  h.engine.refresh(); assert.match(h.node().textContent, /:is\(\.new\)/);
});
test('cross-origin failures do not stop accessible styles and computed tokens', () => {
  const h=harness(); h.doc.styleSheets.push({get cssRules(){throw new Error('SecurityError');}});
  h.engine.start(); assert.match(h.node().textContent, /--trellis-color-text-primary/);
});
test('disabled sheets are ignored and media conditions remain scoped', () => {
  const h=harness(); h.sheet.disabled=true;h.sheet.cssRules.push(h.rule('.disabled',{color:'#333'}));
  h.doc.styleSheets.push({media:{mediaText:'(min-width: 800px)'},cssRules:[h.rule('.wide',{color:'#333'})]});
  h.engine.start(); assert.doesNotMatch(h.node().textContent,/:is\(\.disabled\)/);
  assert.match(h.node().textContent, /@media \(min-width: 800px\)/);
});
test('unchanged refreshes reuse token results and stopping removes generated changes', () => {
  const h=harness();h.engine.start();h.engine.refresh();assert.equal(h.reads(),1);
  h.engine.stop();assert.equal(h.node().isConnected,false);assert.equal(h.inline.hasAttribute('data-hsdm-inline'),false);
});
test('lightweight stylesheet polling detects inserted rules without rebuilding unchanged sheets',()=>{
  const h=harness();h.engine.start();h.tick();assert.equal(h.reads(),1);
  h.sheet.cssRules.push(h.rule('.loading-row',{background:'#fff'}));h.tick();
  assert.match(h.node().textContent,/:is\(\.loading-row\)/);
  assert.equal(h.reads(),2);
});

test('pseudo-elements stay outside is() and every selector remains dark-scoped',()=>{
  const h=harness();
  h.sheet.cssRules.push(h.rule('.shimmer::after, :is(.a, .b):not([title="a,b"])::before',{background:'linear-gradient(white, #ebebeb)'}));
  h.engine.start();const css=h.node().textContent;
  assert.match(css,/:is\(\.shimmer\)::after/);
  assert.match(css,/:where\(html\[data-hsdm-theme="dark"\]\) \.shimmer::after/);
  assert.match(css,/:is\(:is\(\.a, \.b\):not\(\[title="a,b"\]\)\)::before/);
  assert.doesNotMatch(css,/:is\(\.shimmer::after\)/);
  assert.match(css,/linear-gradient\(hsl/);
});

test('image loads and layout-only inline changes do not schedule HubSpot refreshes',()=>{
  const h=harness();h.engine.start();const reads=h.reads();
  for(let i=0;i<1000;i++){
    h.load({type:'load',target:{matches:()=>false}});
    const target={nodeType:1,style:decl({transform:'translateX(20px)',width:'50px'}),closest:()=>null};
    h.mutate([{type:'attributes',attributeName:'style',target}]);
  }
  assert.equal(h.pending(),0);h.drain();assert.equal(h.reads(),reads);
});

test('repeated updates of already-themed inline elements do not rebuild unchanged colors',()=>{
  const h=harness();h.engine.start();h.inline.nodeType=1;
  for(let i=0;i<100;i++)h.mutate([{type:'attributes',attributeName:'style',target:h.inline}]);
  assert.equal(h.pending(),0);
});

test('HubSpot work is coalesced into a frame and stopping cancels queued callbacks',()=>{
  const h=harness();h.realEngine.start();assert.equal(h.reads(),0);
  for(let i=0;i<100;i++)h.realEngine.refresh();
  assert.equal(h.pending(),1);h.drain();assert.equal(h.reads(),1);
  h.realEngine.refresh();assert.equal(h.pending(),1);h.realEngine.stop();
  assert.equal(h.pending(),0);h.drain();assert.equal(h.reads(),1);
});
