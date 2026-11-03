// Synthetic operation benchmark, not a Chrome navigation timing claim.
const fs = require('node:fs');
const { harness } = require('../tests/helpers/linkedin-harness.cjs');
const source = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : undefined;
const h = harness(2000, { source });
h.engine.start();h.drain();
const initial={...h.stats};
const card=h.node();h.root.append(card);
h.mutate([{target:h.root,type:'childList',addedNodes:[card],removedNodes:[]}]);h.drain();
const add={styleReads:h.stats.reads-initial.reads,cssBytes:h.stats.cssBytes-initial.cssBytes};
const before={...h.stats};h.root.children[0].isConnected=false;
h.mutate([{target:h.root,type:'childList',addedNodes:[],removedNodes:[h.root.children[0]]}]);h.drain();
console.log(JSON.stringify({fixture:'2000 synthetic elements',initial,add,remove:{styleReads:h.stats.reads-before.reads,cssBytes:h.stats.cssBytes-before.cssBytes}},null,2));
