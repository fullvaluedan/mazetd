// Grunt staging checks keep unapproved enemy art out of runtime while proving
// the static, walk, and defeat candidates obey the per-enemy frame contract.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gruntRoot = path.join(root, 'assets/staging/enemy-family/grunt');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(ok ? '  ok  ' : '  FAIL', name, detail);
  if (!ok) fails++;
};

function hashes(png, frames, frameSize) {
  return frames.map((_, index) => {
    const ox = (index % 2) * frameSize;
    const oy = Math.floor(index / 2) * frameSize;
    const bytes = Buffer.alloc(frameSize * frameSize * png.channels);
    for (let y = 0; y < frameSize; y++) for (let x = 0; x < frameSize; x++) {
      const source = ((oy + y) * png.width + ox + x) * png.channels;
      png.pixels.copy(bytes, (y * frameSize + x) * png.channels, source, source + png.channels);
    }
    return createHash('sha256').update(bytes).digest('hex');
  });
}

console.log('Grunt staging: static fallback and two four-frame state atlases');
const staticSprite = inspectPng(path.join(gruntRoot, 'grunt-static-64-grid-v1.png'));
check('static candidate is 64x64 RGBA', staticSprite.width === 64 && staticSprite.height === 64 && staticSprite.alpha);
check('static candidate keeps safe transparent padding', staticSprite.bounds.x0 > 0 && staticSprite.bounds.y0 > 0 && staticSprite.bounds.x1 < 63 && staticSprite.bounds.y1 < 63, JSON.stringify(staticSprite.bounds));

for (const state of ['walk', 'defeat']) {
  const sheetPath = path.join(gruntRoot, `grunt-${state}-2x2-grid-v1.png`);
  const sheet = inspectPng(sheetPath);
  const frames = inspectAtlasFrames(sheetPath, [2, 2]);
  check(`${state} atlas is 128x128 RGBA`, sheet.width === 128 && sheet.height === 128 && sheet.alpha);
  check(`${state} atlas has four safe padded frames`, frames.length === 4 && frames.every((frame) => frame.x0 > 0 && frame.y0 > 0 && frame.x1 < 63 && frame.y1 < 63), JSON.stringify(frames));
  check(`${state} frames are visually distinct`, new Set(hashes(sheet, frames, 64)).size === 4);
}

const proof = inspectPng(path.join(gruntRoot, 'grunt-map-proof-v1.png'));
check('map-scale proof is a 12x16 64px grid composition', proof.width === 768 && proof.height === 1024);

console.log(fails === 0 ? 'GRUNT_STAGING_QC_OK' : `GRUNT_STAGING_QC_FAIL (${fails})`);
if (fails) process.exitCode = 1;
