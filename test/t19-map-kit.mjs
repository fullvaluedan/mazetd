import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyProductionAssets } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'assets/manifest.json'), 'utf8'));
const results = verifyProductionAssets(manifest);
for (const result of results) console.log(result.ok ? '  ok  ' : '  FAIL', result.id, result.reason || '');
console.log(results.every((result) => result.ok) ? 'MAP_KIT_QC_OK' : 'MAP_KIT_QC_FAIL');
if (!results.every((result) => result.ok)) process.exitCode = 1;
