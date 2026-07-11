// File existence checks for the live roster tower art and battlefield tiles.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../tools/gen-assets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

const manifest = buildManifest();
const wanted = manifest;

console.log('Runtime asset files: every manifest entry is present on disk:');
for (const item of wanted) {
  const rel = item.out;
  const full = path.join(root, 'assets', rel);
  check(`${item.id} exists`, existsSync(full), rel);
}

console.log(fails === 0 ? 'ASSET_FILES_OK' : `ASSET_FILES_FAIL (${fails})`);
