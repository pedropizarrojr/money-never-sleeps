const vm = require('node:vm');
const fs = require('node:fs');

function harness(count = 3, { source, readCost = 0.02 } = {}) {
  let serial = 0, interval, clock = 0, doc, wrote = false;
  const frames = new Map(), callbacks = new Map(), sheets = [], microtasks = [];
  const stats = { reads:0, writes:0, readAfterWrite:0, ruleWrites:0, textWrites:0, cssBytes:0, bulkScans:0, frames:0 };
  const write = () => {stats.writes++;wrote=true;};
  function node(tag='DIV',colors={}) {
    return {nodeType:1,tagName:tag,isConnected:true,attrs:{},children:[],colors:{color:'rgba(0, 0, 0, 0.9)','background-color':'rgb(255, 255, 255)',...colors},
      matches(selector){return selector.split(',').map(s=>s.trim().toUpperCase()).includes(this.tagName);},
      querySelectorAll(selector){stats.bulkScans++;const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);return selector==='[data-hsdm-li]'?all.filter(n=>n.attrs['data-hsdm-li']):all;},
      closest(selector){if(selector.includes('data-hsdm-owned')&&this.dataset?.hsdmOwned)return this;return this.matches(selector)?this:null;},
      getRootNode(){return this.ownerRoot || doc;},getAttribute(k){return this.attrs[k]??null;},
      setAttribute(k,v){write();this.attrs[k]=v;},removeAttribute(k){if(k in this.attrs)write();delete this.attrs[k];},
      remove(){this.isConnected=false;},append(child){write();this.children.push(child);child.parentNode=this;child.ownerRoot=this.nodeType===11?this:doc;if(child.tagName==='STYLE')sheets.push(child);}};
  }
  const root=node('HTML'),head=node('HEAD');
  root.children=Array.from({length:count},()=>{const n=node();n.parentNode=root;return n;});
  doc={documentElement:root,head,hidden:false,styleSheets:[],
    querySelectorAll:selector=>root.querySelectorAll(selector),
    getElementById(id){const walk=n=>!n.isConnected?undefined:n.id===id?n:n.children.map(walk).find(Boolean);return walk(root);},
    createTreeWalker(root,what,filter){const stack=[root.children[Symbol.iterator]()];return {nextNode(){while(stack.length){const next=stack.at(-1).next();if(next.done){stack.pop();continue;}const n=next.value;if(filter.acceptNode(n)===2)continue;stack.push(n.children[Symbol.iterator]());return n;}return null;}};},
    createElement(){const n={...node('STYLE'),dataset:{},disabled:false,sheet:{cssRules:[],insertRule(css,index){write();stats.ruleWrites++;stats.cssBytes+=css.length;this.cssRules.splice(index,0,{cssText:css});}}};let text='';Object.defineProperty(n,'textContent',{get(){return text;},set(v){write();stats.textWrites++;stats.cssBytes+=v.length;text=v;}});return n;},
    addEventListener(){},removeEventListener(){}};
  const context=vm.createContext({document:doc,performance:{now:()=>clock},
    getComputedStyle(element){stats.reads++;if(wrote)stats.readAfterWrite++;clock+=readCost;return {getPropertyValue(key){return key.endsWith('-width')?'0px':element.colors[key]||'none';}};},
    MutationObserver:class{constructor(fn){this.fn=fn;}observe(target){this.target=target;callbacks.set(target,this.fn);}disconnect(){callbacks.delete(this.target);}},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
    setInterval(fn){interval=fn;return 1;},clearInterval(){interval=null;},queueMicrotask(fn){microtasks.push(fn);}
  });
  vm.runInContext(fs.readFileSync('extension/palette.js','utf8'),context);
  vm.runInContext(source??fs.readFileSync('extension/linkedin.js','utf8'),context);
  function flushMicrotasks(){while(microtasks.length){wrote=false;microtasks.shift()();}}
  function step(){flushMicrotasks();if(frames.size){wrote=false;stats.frames++;const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}}
  function drain(){let guard=0;while(frames.size||microtasks.length){if(++guard>2000)throw new Error('Work did not settle');step();}}
  function shadow(host){const tree={nodeType:11,host,isConnected:true,children:[],querySelectorAll:root.querySelectorAll,append:root.append};host.shadowRoot=tree;return tree;}
  const style=(tree=doc)=>sheets.find(s=>s.isConnected&&s.ownerRoot===tree)||sheets.find(s=>s.ownerRoot===tree);
  return {engine:context.HSDMEngine,root,node,doc,frames,drain,step,shadow,tick:()=>interval?.(),stats,
    resources:()=>({interval:!!interval,observers:callbacks.size,pending:frames.size+microtasks.length}),
    flushMicrotasks,pending:()=>frames.size+microtasks.length,style,
    css:(tree=doc)=>{const s=style(tree);return (s?.textContent||'')+(s?.sheet.cssRules.map(r=>r.cssText).join('')||'');},
    mutate:(records,target=root)=>callbacks.get(target)?.(records)};
}
module.exports={harness};
