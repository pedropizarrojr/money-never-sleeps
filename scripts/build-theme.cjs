/* Build declarative appearance updates from the same CSS shipped in the ZIP. */
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../extension/update-policy.js');

function parse(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/\/\*|\\/.test(css)) throw new Error('Unsupported CSS escape or comment');
  const rules = [];
  let cursor = 0;
  function block(end, inScreen) {
    while (cursor < end) {
      const open = css.indexOf('{', cursor);
      if (open < 0 || open >= end) { if (css.slice(cursor, end).trim()) throw new Error('Invalid CSS'); cursor = end; break; }
      const header = css.slice(cursor, open).trim();
      let close = open + 1, depth = 1, quote = '';
      for (; close < end; close++) {
        const c = css[close];
        if (quote) { if (c === quote) quote = ''; continue; }
        if (c === '"' || c === "'") quote = c;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) break;
      }
      if (depth || quote) throw new Error('Unbalanced CSS');
      if (header === '@media screen') { cursor = open + 1; block(close, true); }
      else if (header === '@media screen and (prefers-color-scheme: dark)') { /* Pre-paint fallback remains packaged. */ }
      else {
        if (!inScreen || header.startsWith('@')) throw new Error('Only flat screen theme rules can update automatically');
        const declarations = {};
        for (const declaration of css.slice(open + 1, close).split(';').map(s => s.trim()).filter(Boolean)) {
          const colon = declaration.indexOf(':');
          if (colon < 1) throw new Error('Invalid declaration');
          declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
        }
        rules.push({ selectors: policy.splitSelectors(header.replace(/\s+/g, ' ')), declarations });
      }
      cursor = close + 1;
    }
  }
  block(css.length, false);
  return rules;
}

function build(root, revision) {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'))).version;
  const read = name => parse(fs.readFileSync(path.join(root, 'extension', name), 'utf8'));
  const common = read('theme.css');
  const packet = { schema: 1, baseVersion: version, revision, rules: {
    hubspot: [...common, ...read('hubspot.css')],
    linkedin: [...common, ...read('linkedin.css')],
    google: read('google.css')
  } };
  policy.validate(packet, version);
  return packet;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const packet = build(root, Number(process.env.THEME_REVISION || Date.now()));
  const out = path.join(root, 'dist/theme/latest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(packet) + '\n');
  console.log(`Built theme ${packet.revision} for extension ${packet.baseVersion}: ${Buffer.byteLength(JSON.stringify(packet))} bytes`);
}
module.exports = { parse, build };
