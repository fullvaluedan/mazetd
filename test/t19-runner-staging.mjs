// Runner staging checks prove the approved static, locomotion, and defeat
// sources meet the same frame geometry contract as the promoted Grunt family.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerRoot = path.join(root, 'assets/staging/enemy-family/runner');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(ok ? '  ok  ' : '  FAIL', name, detail);
  if (!ok) fails++;
};

function hashes(png, frames) {
  return frames.map((_, index) => {
    const ox = (index % 2) * 64;
    const oy = Math.floor(index / 2) * 64;
    const bytes = Buffer.alloc(64 * 64 * png.channels);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const source = ((oy + y) * png.width + ox + x) * png.channels;
      png.pixels.copy(bytes, (y * 64 + x) * png.channels, source, source + png.channels);
    }
    return createHash('sha256').update(bytes).digest('hex');
  });
}

console.log('Runner staging: static fallback and two four-frame state atlases');
const staticSprite = inspectPng(path.join(runnerRoot, 'runner-static-64-grid-v1.png'));
check('static candidate is 64x64 RGBA', staticSprite.width === 64 && staticSprite.height === 64 && staticSprite.alpha);
check('static candidate keeps safe transparent padding', staticSprite.bounds.x0 > 0 && staticSprite.bounds.y0 > 0 && staticSprite.bounds.x1 < 63 && staticSprite.bounds.y1 < 63, JSON.stringify(staticSprite.bounds));

for (const state of ['walk', 'defeat']) {
  const sheetPath = path.join(runnerRoot, `runner-${state}-2x2-grid-v1.png`);
  const sheet = inspectPng(sheetPath);
  const frames = inspectAtlasFrames(sheetPath, [2, 2]);
  check(`${state} atlas is 128x128 RGBA`, sheet.width === 128 && sheet.height === 128 && sheet.alpha);
  check(`${state} atlas has four safe padded frames`, frames.length === 4 && frames.every((frame) => frame.x0 > 0 && frame.y0 > 0 && frame.x1 < 63 && frame.y1 < 63), JSON.stringify(frames));
  check(`${state} frames are visually distinct`, new Set(hashes(sheet, frames)).size === 4);
}

const proof = inspectPng(path.join(runnerRoot, 'runner-map-proof-v1.png'));
check('map-scale proof is a 12x16 64px grid composition', proof.width === 768 && proof.height === 1024);

console.log(fails === 0 ? 'RUNNER_STAGING_QC_OK' : `RUNNER_STAGING_QC_FAIL (${fails})`);
if (fails) process.exitCode = 1;
