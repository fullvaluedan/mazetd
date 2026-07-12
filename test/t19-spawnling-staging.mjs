import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/staging/enemy-family/spawnling');
let fails = 0;
const check = (name, ok) => { console.log(ok ? '  ok  ' : '  FAIL', name); if (!ok) fails++; };
const hashes = (png, frames) => frames.map((_, i) => {
  const ox = (i % 2) * 48, oy = Math.floor(i / 2) * 48, bytes = Buffer.alloc(48 * 48 * png.channels);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const at = ((oy + y) * png.width + ox + x) * png.channels;
    png.pixels.copy(bytes, (y * 48 + x) * png.channels, at, at + png.channels);
  }
  return createHash('sha256').update(bytes).digest('hex');
});
const staticSprite = inspectPng(path.join(dir, 'spawnling-static-48-grid-v1.png'));
check('static candidate is 48x48 RGBA', staticSprite.width === 48 && staticSprite.height === 48 && staticSprite.alpha);
check('static candidate has safe padding', staticSprite.bounds.x0 > 0 && staticSprite.bounds.y0 > 0 && staticSprite.bounds.x1 < 47 && staticSprite.bounds.y1 < 47);
for (const state of ['walk', 'defeat']) {
  const file = path.join(dir, `spawnling-${state}-2x2-grid-v1.png`), png = inspectPng(file), frames = inspectAtlasFrames(file, [2, 2]);
  check(`${state} atlas is 96x96 RGBA`, png.width === 96 && png.height === 96 && png.alpha);
  check(`${state} has padded 48px frames`, frames.every((f) => f.x0 > 0 && f.y0 > 0 && f.x1 < 47 && f.y1 < 47));
  check(`${state} frames are distinct`, new Set(hashes(png, frames)).size === 4);
}
const proof = inspectPng(path.join(dir, 'spawnling-map-proof-v1.png'));
check('map proof is 12x16 grid scale', proof.width === 768 && proof.height === 1024);
console.log(fails ? `SPAWNLING_STAGING_QC_FAIL (${fails})` : 'SPAWNLING_STAGING_QC_OK');
if (fails) process.exitCode = 1;
