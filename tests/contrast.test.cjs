const {test}=require('node:test');
const assert=require('node:assert/strict');
const {THEME,parseColor,transformValue}=require('../extension/palette.js');

function luminance(hex){
  const rgb=parseColor(hex).slice(0,3).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('default text and secondary text meet 4.5:1 on every curated surface',()=>{
  for(const bg of ['page','surface','raised','input']){
    for(const fg of ['text','muted'])assert.ok(ratio(THEME[fg],THEME[bg])>=4.5,`${fg}/${bg}: ${ratio(THEME[fg],THEME[bg])}`);
  }
});
test('input boundaries and focus indicators meet 3:1 on adjacent curated surfaces',()=>{
  for(const bg of ['page','surface','raised','input']){
    assert.ok(ratio(THEME.controlBorder,THEME[bg])>=3,`control boundary/${bg}`);
    assert.ok(ratio(THEME.focus,THEME[bg])>=3,`focus/${bg}`);
  }
});
test('elevated surfaces are lighter than the page and opaque black UI is softened',()=>{
  assert.ok(luminance(THEME.raised)>luminance(THEME.surface));
  assert.ok(luminance(THEME.surface)>luminance(THEME.page));
  assert.notEqual(transformValue('background-color','#000'),'#000');
  assert.equal(transformValue('background-color','rgba(0,0,0,0.4)'),'rgba(0,0,0,0.4)');
});
test('Google selection and high-elevation colors retain readable text contrast',()=>{
  for (const surface of ['#3c3935','#454039','#51442e']) {
    assert.ok(ratio('#e3e0de',surface)>=4.5, `Google text/${surface}`);
    assert.ok(ratio('#b8b2ac',surface)>=4.5, `Google secondary text/${surface}`);
  }
  assert.ok(ratio('#262422','#d6b77c')>=4.5, 'Google filled primary control');
});
module.exports={ratio};
