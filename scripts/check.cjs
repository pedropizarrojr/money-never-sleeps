const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const manifest = JSON.parse(fs.readFileSync('extension/manifest.json'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.host_permissions, ['https://raw.githubusercontent.com/*']);
assert.deepEqual(manifest.background, { service_worker: 'update-worker.js' });
assert.equal(manifest.content_scripts.length, 3);
assert.equal(manifest.content_scripts[1].match_origin_as_fallback, true, 'LinkedIn-created blank/blob ad frames must receive the theme');
for (const [i, script] of manifest.content_scripts.entries()) {
  assert.equal(script.run_at, 'document_start');
  assert.equal(script.all_frames, i !== 2);
  for (const match of script.matches) {
    const host = new URL(match).hostname;
    assert.match(host, /^(?:app(?:-[a-z]+\d)?\.hubspot\.com|(?:www\.)?linkedin\.com|(?:drive|docs|calendar)\.google\.com)$/);
    assert.equal(host.includes('*'), false, 'Host wildcards must follow Chrome match-pattern syntax');
  }
}
assert.deepEqual(manifest.content_scripts[2].matches, [
  'https://drive.google.com/*', 'https://docs.google.com/document/*',
  'https://docs.google.com/spreadsheets/*', 'https://calendar.google.com/*'
]);
assert.deepEqual(manifest.content_scripts[2].js, ['palette.js', 'update-policy.js', 'theme-updates.js', 'content.js'], 'Google must not start a scanning engine');
assert.deepEqual(manifest.content_scripts[2].css, ['google.css']);
const required = [manifest.action.default_popup, manifest.background.service_worker, ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap(s => [...s.js,...s.css])];
for (const file of required) assert.ok(fs.existsSync(path.join('extension',file)), file);
for (const file of fs.readdirSync('extension').filter(x => x.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check',path.join('extension',file)]);
  const source = fs.readFileSync(path.join('extension',file),'utf8');
  assert.doesNotMatch(source, /\b(?:XMLHttpRequest|WebSocket|eval)\s*\(/);
  if (file !== 'update-worker.js') assert.doesNotMatch(source, /\bfetch\s*\(/, 'Only the updater worker can access the network');
}
const worker = fs.readFileSync('extension/update-worker.js','utf8');
assert.equal((worker.match(/\bfetch\s*\(/g) || []).length, 1, 'Updater has exactly one fixed download endpoint');
assert.match(worker, /https:\/\/raw\.githubusercontent\.com\/pedropizarrojr\/money-never-sleeps\/theme-updates\/updates\/latest\.json/);
assert.doesNotMatch(worker, /tabs\.|scripting\.|runtime\.reload|eval\(|new Function/);
assert.doesNotMatch(fs.readFileSync('extension/popup.html','utf8'), /\son\w+=|https?:\/\//);
console.log('Manifest, permissions, packaged resources, syntax and updater network boundary checks passed.');
