const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function harness(count = 3) {
  let callback, style, serial = 0;
  const frames = new Map();
  function node(tag = 'DIV', colors = {}) {
    return {nodeType:1,tagName:tag,isConnected:true,attrs:{},children:[],colors:{color:'rgba(0, 0, 0, 0.9)','background-color':'rgb(255, 255, 255)',...colors},
      querySelectorAll() {return this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);},
      closest(selector) {if(selector.includes('#hsdm-linkedin')&&this.id==='hsdm-linkedin')return this;
        return ['IMG','SVG','VIDEO','CANVAS','STYLE','SCRIPT'].includes(this.tagName) ? this : null;},
      setAttribute(key,value){this.attrs[key]=value;},removeAttribute(key){delete this.attrs[key];},
      remove(){this.isConnected=false;},append(child){this.children.push(child);style=child;}};
  }
  const root=node('HTML'),head=node('HEAD');
  root.children = Array.from({length:count},()=>node());
  const context=vm.createContext({
    document:{documentElement:root,head,createElement:()=>({...node('STYLE'),dataset:{},textContent:'',disabled:false}),
      addEventListener(){},removeEventListener(){}},
    getComputedStyle(element){assert.equal(style.disabled,true,'Read original colors with generated CSS disabled');return {getPropertyValue(key){return key.endsWith('-width')?'0px':element.colors[key]||'none';}};},
    MutationObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){}},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}
  });
  vm.runInContext(fs.readFileSync('extension/palette.js','utf8'),context);
  vm.runInContext(fs.readFileSync('extension/linkedin.js','utf8'),context);
  function drain(){let guard=0;while(frames.size){assert.ok(++guard<50,'Frames settle');const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}}
  return {engine:context.HSDMEngine,root,node,frames,drain,style:()=>style,mutate:records=>callback(records)};
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
  const h=harness(520);h.engine.start();
  const [id,fn]=h.frames.entries().next().value;h.frames.delete(id);fn();
  assert.ok(h.frames.size>0);h.drain();
  const added=h.node();h.root.children.push(added);
  h.mutate([{target:h.root,type:'childList',addedNodes:[added],removedNodes:[]}]);h.drain();
  assert.ok(added.attrs['data-hsdm-li']);
});
test('class changes re-read original colors and removed elements are pruned',()=>{
  const h=harness();h.engine.start();h.drain();const child=h.root.children[0];
  child.colors['background-color']='rgb(240, 240, 240)';
  h.mutate([{target:child,type:'attributes'}]);h.drain();assert.match(h.style().textContent,/18\.3%/);
  const id=child.attrs['data-hsdm-li'];child.isConnected=false;
  h.mutate([{target:h.root,type:'childList',addedNodes:[],removedNodes:[child]}]);h.drain();
  assert.ok(!h.style().textContent.includes(`[data-hsdm-li="${id}"]`));
});
test('native dark surfaces stay dark and media elements are excluded',()=>{
  const h=harness();const child=h.root.children[0];child.colors={color:'rgb(240, 240, 240)','background-color':'rgb(27, 31, 35)'};
  const image=h.node('IMG');h.root.children.push(image);h.engine.start();h.drain();
  assert.equal(child.attrs['data-hsdm-li'],undefined);assert.equal(image.attrs['data-hsdm-li'],undefined);
});
test('switching back to original removes styles and cancels pending scans',()=>{
  const h=harness();h.engine.start();h.drain();h.engine.refresh();assert.ok(h.frames.size);
  h.engine.stop();h.drain();assert.equal(h.style().isConnected,false);assert.equal(h.frames.size,0);
  assert.equal(h.root.children[0].attrs['data-hsdm-li'],undefined);
});
