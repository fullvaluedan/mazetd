import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/staging/enemy-family/mender');
let fails = 0;
const check = (n, ok) => { console.log(ok ? '  ok  ' : '  FAIL', n); if (!ok) fails++; };
const staticSprite = inspectPng(path.join(dir, 'mender-static-64-grid-v1.png'));
check('static candidate is 64x64 RGBA with safe padding', staticSprite.width === 64 && staticSprite.height === 64 && staticSprite.alpha && staticSprite.bounds.x0 > 0 && staticSprite.bounds.y0 > 0 && staticSprite.bounds.x1 < 63 && staticSprite.bounds.y1 < 63);
for (const state of ['walk', 'defeat']) {
  const sheet = inspectPng(path.join(dir, `mender-${state}-2x2-grid-v1.png`));
  const frames = inspectAtlasFrames(path.join(dir, `mender-${state}-2x2-grid-v1.png`), [2, 2]);
  check(`${state} atlas is 128x128 RGBA with four padded frames`, sheet.width === 128 && sheet.height === 128 && sheet.alpha && frames.every((f) => f.x0 > 0 && f.y0 > 0 && f.x1 < 63 && f.y1 < 63));
}
check('map proof is 12x16 grid scale', inspectPng(path.join(dir, 'mender-map-proof-v1.png')).width === 768);
console.log(fails ? `MENDER_STAGING_QC_FAIL (${fails})` : 'MENDER_STAGING_QC_OK');
if (fails) process.exitCode = 1;
