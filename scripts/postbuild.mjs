import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const manifestPath = path.join(distDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('[SourceCloak] Build failed: dist/manifest.json was not generated.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function assertJsEntry(label, value) {
  if (!value || !value.endsWith('.js') || value.endsWith('.ts')) {
    console.error(`[SourceCloak] Build failed: ${label} must reference a compiled .js file, got "${value ?? 'undefined'}".`);
    process.exit(1);
  }
}

assertJsEntry('background.service_worker', manifest.background?.service_worker);

for (const entry of manifest.content_scripts ?? []) {
  for (const script of entry.js ?? []) {
    assertJsEntry('content_scripts[].js', script);
  }
}

console.log('\n[SourceCloak] Extension ready. Load unpacked from:');
console.log(distDir);
console.log('');