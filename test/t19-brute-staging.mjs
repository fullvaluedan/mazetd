// Brute staging checks the larger 96px enemy geometry independently from the
// 64px Grunt and Runner contracts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bruteRoot = path.join(root, 'assets/staging/enemy-family/brute');
let fails = 0;
const check = (name, ok, detail = '') => { console.log(ok ? '  ok  ' : '  FAIL', name, detail); if (!ok) fails++; };
function hashes(png, frames) {
  return frames.map((_, index) => {
    const ox = (index % 2) * 96, oy = Math.floor(index / 2) * 96;
    const bytes = Buffer.alloc(96 * 96 * png.channels);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const source = ((oy + y) * png.width + ox + x) * png.channels;
      png.pixels.copy(bytes, (y * 96 + x) * png.channels, source, source + png.channels);
    }
    return createHash('sha256').update(bytes).digest('hex');
  });
}
console.log('Brute staging: larger static fallback and state atlases');
const staticSprite = inspectPng(path.join(bruteRoot, 'brute-static-96-grid-v1.png'));
check('static candidate is 96x96 RGBA', staticSprite.width === 96 && staticSprite.height === 96 && staticSprite.alpha);
check('static candidate keeps safe transparent padding', staticSprite.bounds.x0 > 0 && staticSprite.bounds.y0 > 0 && staticSprite.bounds.x1 < 95 && staticSprite.bounds.y1 < 95, JSON.stringify(staticSprite.bounds));
for (const state of ['walk', 'defeat']) {
  const sheetPath = path.join(bruteRoot, `brute-${state}-2x2-grid-v1.png`);
  const sheet = inspectPng(sheetPath), frames = inspectAtlasFrames(sheetPath, [2, 2]);
  check(`${state} atlas is 192x192 RGBA`, sheet.width === 192 && sheet.height === 192 && sheet.alpha);
  check(`${state} atlas has four safe padded 96px frames`, frames.length === 4 && frames.every((f) => f.x0 > 0 && f.y0 > 0 && f.x1 < 95 && f.y1 < 95), JSON.stringify(frames));
  check(`${state} frames are visually distinct`, new Set(hashes(sheet, frames)).size === 4);
}
const proof = inspectPng(path.join(bruteRoot, 'brute-map-proof-v1.png'));
check('map-scale proof is a 12x16 64px grid composition', proof.width === 768 && proof.height === 1024);
console.log(fails === 0 ? 'BRUTE_STAGING_QC_OK' : `BRUTE_STAGING_QC_FAIL (${fails})`);
if (fails) process.exitCode = 1;
