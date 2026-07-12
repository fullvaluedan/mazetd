// Support promotion checks the normalized family, aura loop sheet, and proof
// boards.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportRoot = path.join(root, 'assets/staging/tower-family/support');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(ok ? '  ok  ' : '  FAIL', name, detail);
  if (!ok) fails++;
};

console.log('Support family: five full-footprint 2x2 static tiers');
for (let level = 1; level <= 5; level++) {
  const png = inspectPng(path.join(supportRoot, `support-lv${level}-2x2-grid-v2.png`));
  check(`L${level} is 128x128 RGBA`, png.width === 128 && png.height === 128 && png.alpha);
  check(`L${level} fills its exact 2x2 rectangle`,
    png.bounds.x0 === 0 && png.bounds.y0 === 0 && png.bounds.x1 === 127 && png.bounds.y1 === 127,
    JSON.stringify(png.bounds));
}

console.log('Support aura loop: four distinct full-footprint 2x2 frames');
const auraPath = path.join(supportRoot, 'support-aura-2x2-grid-v1.png');
const aura = inspectPng(auraPath);
const frames = inspectAtlasFrames(auraPath, [2, 2]);
check('aura atlas is 256x256 RGBA', aura.width === 256 && aura.height === 256 && aura.alpha);
check('aura frames fill their exact 2x2 rectangles',
  frames.length === 4 && frames.every((frame) => frame.x0 === 0 && frame.y0 === 0 && frame.x1 === 127 && frame.y1 === 127),
  JSON.stringify(frames));
const hashes = frames.map((_, index) => {
  const ox = (index % 2) * 128;
  const oy = Math.floor(index / 2) * 128;
  const bytes = Buffer.alloc(128 * 128 * aura.channels);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const source = ((oy + y) * aura.width + ox + x) * aura.channels;
    aura.pixels.copy(bytes, (y * 128 + x) * aura.channels, source, source + aura.channels);
  }
  return createHash('sha256').update(bytes).digest('hex');
});
check('aura frames are visually distinct by pixel content', new Set(hashes).size > 1, JSON.stringify(hashes));

check('family contact sheet is present', inspectPng(path.join(supportRoot, 'support-family-staging-v2.png')).width === 640);
check('family map proof is present', inspectPng(path.join(supportRoot, 'support-family-map-proof-v2.png')).width === 768);

console.log(fails === 0 ? 'SUPPORT_STAGING_QC_OK' : `SUPPORT_STAGING_QC_FAIL (${fails})`);
if (fails) process.exitCode = 1;
