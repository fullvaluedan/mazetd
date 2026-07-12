// Boss uses its own large-source contract: 128px static, 256px 2x2 sheets
// with 128px frames — never the standard 64px enemy geometry.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/staging/enemy-family/boss');
let fails = 0;
const check = (n, ok) => { console.log(ok ? '  ok  ' : '  FAIL', n); if (!ok) fails++; };
const staticSprite = inspectPng(path.join(dir, 'boss-static-128-grid-v1.png'));
check('static candidate is 128x128 RGBA with safe padding', staticSprite.width === 128 && staticSprite.height === 128 && staticSprite.alpha && staticSprite.bounds.x0 > 0 && staticSprite.bounds.y0 > 0 && staticSprite.bounds.x1 < 127 && staticSprite.bounds.y1 < 127);
for (const state of ['walk', 'defeat']) {
  const sheet = inspectPng(path.join(dir, `boss-${state}-2x2-grid-v1.png`));
  const frames = inspectAtlasFrames(path.join(dir, `boss-${state}-2x2-grid-v1.png`), [2, 2]);
  check(`${state} atlas is 256x256 RGBA with four padded 128px frames`, sheet.width === 256 && sheet.height === 256 && sheet.alpha && frames.every((f) => f.x0 > 0 && f.y0 > 0 && f.x1 < 127 && f.y1 < 127));
}
check('map proof is 12x16 grid scale', inspectPng(path.join(dir, 'boss-map-proof-v1.png')).width === 768);
console.log(fails ? `BOSS_STAGING_QC_FAIL (${fails})` : 'BOSS_STAGING_QC_OK');
if (fails) process.exitCode = 1;
