const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/linkedin-harness.cjs');

test('LinkedIn opaque classes are themed from colors without CSSOM or content access',()=>{
  const h=harness();h.root.children[0].className='opaque-x123';
  h.engine.start();h.drain();
  assert.match(h.css(),/background-color:hsl/);
  assert.match(h.css(),/color:hsl/);
  assert.match(h.css(),/^@media screen/);
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
test('class changes and removals do not trigger another document scan',()=>{
  const h=harness(1000);h.engine.start();h.drain();const reads=h.stats.reads;
  const child=h.root.children[0];child.isConnected=false;
  h.mutate([{target:child,type:'attributes',attributeName:'class'}]);
  h.mutate([{target:h.root,type:'childList',addedNodes:[],removedNodes:[child]}]);
  h.drain();assert.equal(h.stats.reads,reads);
});
test('native dark surfaces stay dark and media elements are excluded',()=>{
  const h=harness();const child=h.root.children[0];child.colors={color:'rgb(240, 240, 240)','background-color':'rgb(27, 31, 35)'};
  const image=h.node('IMG');h.root.children.push(image);h.engine.start();h.drain();
  assert.ok(child.attrs['data-hsdm-li']);assert.match(h.css(),/hsl\(30 6%/);assert.equal(image.attrs['data-hsdm-li'],undefined);
});
test('switching back to original removes styles and cancels pending scans',()=>{
  const h=harness();h.engine.start();h.drain();const card=h.node();h.root.append(card);h.mutate([{target:h.root,type:'childList',addedNodes:[card],removedNodes:[]}]);assert.ok(h.pending());
  h.engine.stop();h.drain();assert.equal(h.style().isConnected,false);assert.equal(h.frames.size,0);
  assert.equal(h.root.children[0].attrs['data-hsdm-li'],undefined);
});
test('chat shadow roots get their own dark stylesheet, including headers and composer',()=>{
  const h=harness();const host=h.root.children[0];host.id='interop-outlet';
  const tree=h.shadow(host);const chat=h.node();tree.append(chat);
  h.engine.start();h.drain();
  const style=h.style(tree);assert.ok(style);
  assert.match(h.css(tree),/:host-context\(html\[data-hsdm-theme="dark"\]\)/);
  assert.match(h.css(tree),/msg-overlay-conversation-bubble-header/);
  assert.match(h.css(tree),/msg-form__contenteditable/);
  assert.match(h.css(tree),/background:#33302e/);
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
test('new cards are scheduled in a frame rather than blocking page microtasks',()=>{
  const h=harness();h.engine.start();h.drain();const card=h.node();h.root.append(card);
  const reads=h.stats.reads;
  h.mutate([{target:h.root,type:'childList',addedNodes:[card],removedNodes:[]}]);
  h.flushMicrotasks();assert.equal(h.stats.reads,reads);assert.equal(h.frames.size,1);
  h.drain();assert.ok(card.attrs['data-hsdm-li']);
});
test('messaging header symbols without fill attributes get explicit white fills',()=>{
  const h=harness();const tree=h.shadow(h.root.children[0]);tree.append(h.node());
  h.engine.start();h.drain();
  assert.match(h.css(tree),/msg-overlay-bubble-header__controls button/);
  assert.match(h.css(tree),/:is\(svg,li-icon\)\{color:#fff !important;fill:#fff !important;/);
  assert.match(h.css(tree),/svg :is\(use,path\)\{fill:inherit !important;/);
});

test('stylesheet churn does not restart computed-style scans',()=>{
  const h=harness(1000);h.engine.start();h.drain();const reads=h.stats.reads;
  const sheet={cssRules:[],disabled:false};h.doc.styleSheets.push(sheet);
  for(let i=0;i<20;i++){sheet.cssRules.push({});h.tick();h.drain();}
  assert.equal(h.stats.reads,reads);
});

test('hydration marker removal is repaired without reacting to the engine own writes',()=>{
  const h=harness();h.engine.start();h.drain();const label=h.root.children[0];
  const id=label.attrs['data-hsdm-li'];label.removeAttribute('data-hsdm-li');
  h.mutate([{target:label,type:'attributes',attributeName:'data-hsdm-li'}]);
  h.drain();assert.equal(label.attrs['data-hsdm-li'],id);
  h.mutate([{target:label,type:'attributes',attributeName:'data-hsdm-li'}]);
  assert.equal(h.pending(),0);
});

test('color reads are batched before DOM writes and equivalent styles share one rule',()=>{
  const h=harness(1000);h.engine.start();h.drain();
  assert.equal(h.stats.readAfterWrite,0);
  assert.equal(h.stats.ruleWrites,1);
  assert.equal(h.stats.bulkScans,0);
});

test('a single added element only reads that element and reuses the existing rule',()=>{
  const h=harness(1000);h.engine.start();h.drain();
  const before={...h.stats},card=h.node();h.root.append(card);
  h.mutate([{target:h.root,type:'childList',addedNodes:[card],removedNodes:[]}]);h.drain();
  assert.equal(h.stats.reads-before.reads,1);
  assert.equal(h.stats.ruleWrites-before.ruleWrites,0);
  assert.equal(h.stats.textWrites-before.textWrites,0);
});

test('each frame and total enhancement work are bounded on a large document',()=>{
  const h=harness(20000,{readCost:0.5});h.engine.start();h.step();
  assert.ok(h.stats.reads<=6,'3 ms slice at simulated 0.5 ms per style read');
  h.drain();assert.ok(h.stats.reads<=200,'100 ms document work budget');
  const reads=h.stats.reads;h.engine.refresh();h.tick();h.drain();
  assert.equal(h.stats.reads,reads,'refresh does not reset the budget');
  const host=h.root.children[0];host.id='interop-outlet';const tree=h.shadow(host);
  h.tick();h.drain();assert.ok(h.style(tree),'chat static CSS still installs after the budget');
});
