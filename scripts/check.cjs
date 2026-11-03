const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const manifest = JSON.parse(fs.readFileSync('extension/manifest.json'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.content_scripts[0].run_at, 'document_start');
assert.equal(manifest.content_scripts[0].all_frames, true);
for (const match of manifest.content_scripts[0].matches) {
  const host = new URL(match).hostname;
  assert.match(host, /^app(?:-[a-z]+\d)?\.hubspot\.com$/);
  assert.equal(host.includes('*'), false, 'Host wildcards must follow Chrome match-pattern syntax');
}
const required = [manifest.action.default_popup, ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap(s => [...s.js,...s.css])];
for (const file of required) assert.ok(fs.existsSync(path.join('extension',file)), file);
for (const file of fs.readdirSync('extension').filter(x => x.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check',path.join('extension',file)]);
  const source = fs.readFileSync(path.join('extension',file),'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(/);
}
assert.doesNotMatch(fs.readFileSync('extension/popup.html','utf8'), /\son\w+=|https?:\/\//);
console.log('Manifest, permissions, packaged resources, syntax and network-free source checks passed.');
