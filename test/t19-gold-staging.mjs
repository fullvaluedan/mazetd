// Gold Mine promotion checks the normalized family, income loop sheet, and
// proof boards.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const goldRoot = path.join(root, 'assets/staging/tower-family/gold');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(ok ? '  ok  ' : '  FAIL', name, detail);
  if (!ok) fails++;
};

console.log('Gold Mine family: five full-footprint 2x2 static tiers');
for (let level = 1; level <= 5; level++) {
  const png = inspectPng(path.join(goldRoot, `gold-lv${level}-2x2-grid-v2.png`));
  check(`L${level} is 128x128 RGBA`, png.width === 128 && png.height === 128 && png.alpha);
  check(`L${level} fills its exact 2x2 rectangle`,
    png.bounds.x0 === 0 && png.bounds.y0 === 0 && png.bounds.x1 === 127 && png.bounds.y1 === 127,
    JSON.stringify(png.bounds));
}

console.log('Gold income loop: four distinct full-footprint 2x2 frames');
const incomePath = path.join(goldRoot, 'gold-income-2x2-grid-v1.png');
const income = inspectPng(incomePath);
const frames = inspectAtlasFrames(incomePath, [2, 2]);
check('income atlas is 256x256 RGBA', income.width === 256 && income.height === 256 && income.alpha);
check('income frames fill their exact 2x2 rectangles',
  frames.length === 4 && frames.every((frame) => frame.x0 === 0 && frame.y0 === 0 && frame.x1 === 127 && frame.y1 === 127),
  JSON.stringify(frames));
const hashes = frames.map((_, index) => {
  const ox = (index % 2) * 128;
  const oy = Math.floor(index / 2) * 128;
  const bytes = Buffer.alloc(128 * 128 * income.channels);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const source = ((oy + y) * income.width + ox + x) * income.channels;
    income.pixels.copy(bytes, (y * 128 + x) * income.channels, source, source + income.channels);
  }
  return createHash('sha256').update(bytes).digest('hex');
});
check('income frames are visually distinct by pixel content', new Set(hashes).size > 1, JSON.stringify(hashes));

check('family contact sheet is present', inspectPng(path.join(goldRoot, 'gold-family-staging-v2.png')).width === 640);
check('family map proof is present', inspectPng(path.join(goldRoot, 'gold-family-map-proof-v2.png')).width === 768);

console.log(fails === 0 ? 'GOLD_STAGING_QC_OK' : `GOLD_STAGING_QC_FAIL (${fails})`);
if (fails) process.exitCode = 1;
