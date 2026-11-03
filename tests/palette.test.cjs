const { test } = require('node:test');
const assert = require('node:assert/strict');
const p = require('../extension/palette.js');

test('system mode follows both preference directions; explicit modes override', () => {
  assert.equal(p.isDark('system', true), true);
  assert.equal(p.isDark('system', false), false);
  assert.equal(p.isDark('dark', false), true);
  assert.equal(p.isDark('light', true), false);
  assert.equal(p.normalizeMode('unknown'), 'system');
});
test('color parser supports alpha, short hex and percentage channels', () => {
  assert.deepEqual(p.parseColor('#fff'), [255,255,255,1]);
  assert.deepEqual(p.parseColor('#0000'), [0,0,0,0]);
  assert.deepEqual(p.parseColor('rgb(0 0 0 / 50%)'), [0,0,0,.5]);
  assert.equal(p.parseColor('var(--anything)'), null);
});
test('backgrounds darken, text brightens, and transparent fills stay transparent', () => {
  assert.match(p.transformValue('background-color', '#fff'), /16\.0%/);
  assert.match(p.transformValue('color', '#333'), /85\.6%/);
  assert.equal(p.transformValue('background', 'rgba(255,255,255,0)'), 'rgba(255,255,255,0)');
});
test('images, SVG fills, dimensions and chart tokens remain intact', () => {
  for (const [key,value] of [['background','url("/white-logo.svg") #fff'], ['fill','#fff'],
    ['stroke','#333'], ['width','100px'], ['--t-sys-color-dataViz-sequential-red-07','#e00b0b']]) {
    assert.equal(p.transformValue(key,value), value);
  }
});
test('primary text tokens transform while foreground on colored actions is preserved', () => {
  assert.notEqual(p.transformValue('--trellis-color-text-primary', '#333'), '#333');
  assert.equal(p.transformValue('--t-sys-color-action-fg-primary-default', '#fff'), '#fff');
  assert.equal(p.transformValue('--t-ui-color-fg-onBlue-default', '#333'), '#333');
});
test('status fills and already dark navigation keep their colors', () => {
  assert.match(p.transformValue('background-color', '#333'), /hsl\(30 6% 20\.0%/);
  assert.equal(p.transformValue('background-color', '#008000'), '#008000');
});
test('neutral gradient fades and bright shadows darken without changing image URLs', () => {
  const gradient='linear-gradient(rgba(255,255,255,0), #fff)';
  assert.notEqual(p.transformValue('background-image',gradient),gradient);
  assert.equal(p.transformValue('background-image','url("white.png")'),'url("white.png")');
  assert.notEqual(p.transformValue('box-shadow','0 0 8px #fff'),'0 0 8px #fff');
});
test('low-opacity neutral dividers become visible warm gray',()=>{
  assert.match(p.transformValue('border-bottom-color','rgba(0, 0, 0, 0.08)'),/38\.0% \/ 0\.750/);
  assert.equal(p.transformValue('border-bottom-color','rgba(0, 0, 0, 0)'),'rgba(0, 0, 0, 0)');
});
