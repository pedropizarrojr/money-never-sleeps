const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Google CSS stays screen-only and every rule is scoped to the appearance controller', () => {
  const css = fs.readFileSync('extension/google.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const stack = [];
  let start = 0, quote = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) { if (c === quote && css[i-1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') {
      const header = css.slice(start, i).trim();
      if (stack.length === 0) assert.match(header, /^@media screen(?:\s|$)/, header);
      else {
        assert.equal(stack.length, 1, 'No unreviewed nested/global rules');
        for (const selector of header.split(/,\s*(?=html\[)/)) {
          assert.match(selector, /^html(?:\[data-hsdm-theme="dark"\]\[data-hsdm-app|:not\(\[data-hsdm-theme\]\))/, selector);
        }
      }
      stack.push(header); start = i + 1;
    } else if (c === '}') {
      assert.ok(stack.length, 'Unexpected closing brace');
      stack.pop(); start = i + 1;
    }
  }
  assert.equal(stack.length, 0, 'Unclosed CSS block');
  assert.equal(quote, null, 'Unclosed CSS string');
  assert.doesNotMatch(css, /@import|url\s*\(/i, 'Google theming must not load external resources');
});
