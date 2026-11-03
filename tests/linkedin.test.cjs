const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function harness(count = 3) {
  let serial = 0, interval;
  const frames = new Map(), callbacks = new Map(), sheets = [], microtasks = [];
  let doc;
  function node(tag = 'DIV', colors = {}) {
    return {nodeType:1,tagName:tag,isConnected:true,attrs:{},children:[],colors:{color:'rgba(0, 0, 0, 0.9)','background-color':'rgb(255, 255, 255)',...colors},
      querySelectorAll() {return this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);},
      closest(selector) {if(selector.includes('data-hsdm-owned')&&this.dataset?.hsdmOwned)return this;
        return ['IMG','SVG','VIDEO','CANVAS','STYLE','SCRIPT'].includes(this.tagName) ? this : null;},
      getRootNode(){return this.ownerRoot || doc;},
      setAttribute(key,value){this.attrs[key]=value;},removeAttribute(key){delete this.attrs[key];},
      remove(){this.isConnected=false;},append(child){this.children.push(child);child.ownerRoot=this.nodeType===11?this:doc;if(child.tagName==='STYLE')sheets.push(child);}};
  }
  const root=node('HTML'),head=node('HEAD');
  root.children = Array.from({length:count},()=>node());
  doc={documentElement:root,head,hidden:false,
    getElementById(id){return root.querySelectorAll('*').find(n=>n.id===id);},
    createElement:()=>({...node('STYLE'),dataset:{},textContent:'',disabled:false}),
    addEventListener(){},removeEventListener(){}};
  const context=vm.createContext({document:doc,
    getComputedStyle(element){assert.ok(sheets.filter(s=>s.isConnected).every(s=>s.disabled),'Read original colors with all generated sheets disabled');return {getPropertyValue(key){return key.endsWith('-width')?'0px':element.colors[key]||'none';}};},
    MutationObserver:class{constructor(fn){this.fn=fn;}observe(target){callbacks.set(target,this.fn);}disconnect(){}},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
    setInterval(fn){interval=fn;return 1;},clearInterval(){interval=null;},queueMicrotask(fn){microtasks.push(fn);}
  });
  vm.runInContext(fs.readFileSync('extension/palette.js','utf8'),context);
  vm.runInContext(fs.readFileSync('extension/linkedin.js','utf8'),context);
  function flushMicrotasks(){while(microtasks.length)microtasks.shift()();}
  function drain(){let guard=0;while(frames.size||microtasks.length){assert.ok(++guard<50,'Work settles');flushMicrotasks();if(frames.size){const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}}}
  function shadow(host){const tree={nodeType:11,host,isConnected:true,children:[],querySelectorAll:root.querySelectorAll,append:root.append};host.shadowRoot=tree;return tree;}
  return {engine:context.HSDMEngine,root,node,frames,drain,shadow,tick:()=>interval?.(),
    flushMicrotasks,pending:()=>frames.size+microtasks.length,
    style:(tree=doc)=>sheets.find(s=>s.isConnected&&s.ownerRoot===tree)||sheets.find(s=>s.ownerRoot===tree),
    mutate:(records,target=root)=>callbacks.get(target)(records)};
}

test('LinkedIn opaque classes are themed from colors without CSSOM or content access',()=>{
  const h=harness();h.root.children[0].className='opaque-x123';
  h.engine.start();h.drain();
  assert.match(h.style().textContent,/background-color:hsl/);
  assert.match(h.style().textContent,/color:hsl/);
  assert.match(h.style().textContent,/^@media screen/);
  assert.ok(h.root.children[0].attrs['data-hsdm-li']);
  assert.equal(h.style().disabled,false);
});
test('large feeds are split across frames and newly added cards are themed',()=>{
  const h=harness(520);h.engine.start();h.flushMicrotasks();
  assert.ok(h.frames.size>0);h.drain();
  const added=h.node();h.root.children.push(added);
  h.mutate([{target:h.root,type:'childList',addedNodes:[added],removedNodes:[]}]);h.drain();
  assert.ok(added.attrs['data-hsdm-li']);
});
test('class changes re-read original colors and removed elements are pruned',()=>{
  const h=harness();h.engine.start();h.drain();const child=h.root.children[0];
  child.colors['background-color']='rgb(240, 240, 240)';
  h.mutate([{target:child,type:'attributes'}]);h.drain();assert.match(h.style().textContent,/17\.3%/);
  const id=child.attrs['data-hsdm-li'];child.isConnected=false;
  h.mutate([{target:h.root,type:'childList',addedNodes:[],removedNodes:[child]}]);h.drain();
  assert.ok(!h.style().textContent.includes(`[data-hsdm-li="${id}"]`));
});
test('native dark surfaces stay dark and media elements are excluded',()=>{
  const h=harness();const child=h.root.children[0];child.colors={color:'rgb(240, 240, 240)','background-color':'rgb(27, 31, 35)'};
  const image=h.node('IMG');h.root.children.push(image);h.engine.start();h.drain();
  assert.ok(child.attrs['data-hsdm-li']);assert.match(h.style().textContent,/hsl\(30 6%/);assert.equal(image.attrs['data-hsdm-li'],undefined);
});
test('switching back to original removes styles and cancels pending scans',()=>{
  const h=harness();h.engine.start();h.drain();h.engine.refresh();assert.ok(h.pending());
  h.engine.stop();h.drain();assert.equal(h.style().isConnected,false);assert.equal(h.frames.size,0);
  assert.equal(h.root.children[0].attrs['data-hsdm-li'],undefined);
});
test('chat shadow roots get their own dark stylesheet, including headers and composer',()=>{
  const h=harness();const host=h.root.children[0];host.id='interop-outlet';
  const tree=h.shadow(host);const chat=h.node();tree.append(chat);
  h.engine.start();h.drain();
  const style=h.style(tree);assert.ok(style);
  assert.match(style.textContent,/:host-context\(html\[data-hsdm-theme="dark"\]\)/);
  assert.match(style.textContent,/msg-overlay-conversation-bubble-header/);
  assert.match(style.textContent,/msg-form__contenteditable/);
  assert.match(style.textContent,/background:#33302e/);
  assert.ok(chat.attrs['data-hsdm-li']);
  h.engine.stop();assert.equal(style.isConnected,false);
  assert.equal(chat.attrs['data-hsdm-li'],undefined);
});
test('late-attached chat roots and messages inserted inside them are discovered',()=>{
  const h=harness();const host=h.root.children[0];host.id='interop-outlet';
  h.engine.start();h.drain();const tree=h.shadow(host);const chat=h.node();tree.append(chat);
  h.tick();h.drain();assert.ok(h.style(tree));
  const message=h.node();tree.append(message);
  h.mutate([{target:tree,type:'childList',addedNodes:[message],removedNodes:[]}],tree);
  h.drain();assert.ok(message.attrs['data-hsdm-li']);
  host.isConnected=false;h.engine.refresh();h.drain();
  assert.equal(h.style(tree).isConnected,false);
});
test('newly inserted cards receive their first dark pass before an animation frame',()=>{
  const h=harness();h.engine.start();h.drain();const card=h.node();h.root.children.push(card);
  h.mutate([{target:h.root,type:'childList',addedNodes:[card],removedNodes:[]}]);
  assert.equal(h.frames.size,0);h.flushMicrotasks();
  assert.ok(card.attrs['data-hsdm-li']);
  assert.match(h.style().textContent,/background-color:hsl/);
});
test('messaging header symbols without fill attributes get explicit white fills',()=>{
  const h=harness();const tree=h.shadow(h.root.children[0]);tree.append(h.node());
  h.engine.start();h.drain();
  assert.match(h.style(tree).textContent,/msg-overlay-bubble-header__controls button/);
  assert.match(h.style(tree).textContent,/:is\(svg,li-icon\)\{color:#fff !important;fill:#fff !important;/);
  assert.match(h.style(tree).textContent,/svg :is\(use,path\)\{fill:inherit !important;/);
});
