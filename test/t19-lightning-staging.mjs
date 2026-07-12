// Lightning promotion checks the normalized attack atlas plus the approved
// static family proof artifacts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lightningRoot = path.join(root, 'assets/staging/tower-family/lightning');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(ok ? '  ok  ' : '  FAIL', name, detail);
  if (!ok) fails++;
};

console.log('Lightning family: five full-footprint 2x2 static tiers');
for (let level = 1; level <= 5; level++) {
  const png = inspectPng(path.join(lightningRoot, `lightning-lv${level}-2x2-grid-v2.png`));
  check(`L${level} is 128x128 RGBA`, png.width === 128 && png.height === 128 && png.alpha);
  check(`L${level} fills its exact 2x2 rectangle`,
    png.bounds.x0 === 0 && png.bounds.y0 === 0 && png.bounds.x1 === 127 && png.bounds.y1 === 127,
    JSON.stringify(png.bounds));
}

console.log('Lightning attack atlas: four distinct full-footprint 2x2 frames');
const attackPath = path.join(lightningRoot, 'lightning-attack-2x2-grid-v2.png');
const attack = inspectPng(attackPath);
const frames = inspectAtlasFrames(attackPath, [2, 2]);
check('attack atlas is 256x256 RGBA', attack.width === 256 && attack.height === 256 && attack.alpha);
check('attack frames fill their exact 2x2 rectangles',
  frames.length === 4 && frames.every((frame) => frame.x0 === 0 && frame.y0 === 0 && frame.x1 === 127 && frame.y1 === 127),
  JSON.stringify(frames));
const hashes = frames.map((_, index) => {
  const ox = (index % 2) * 128;
  const oy = Math.floor(index / 2) * 128;
  const bytes = Buffer.alloc(128 * 128 * attack.channels);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const source = ((oy + y) * attack.width + ox + x) * attack.channels;
    attack.pixels.copy(bytes, (y * 128 + x) * attack.channels, source, source + attack.channels);
  }
  return createHash('sha256').update(bytes).digest('hex');
});
check('attack frames are visually distinct by pixel content', new Set(hashes).size > 1, JSON.stringify(hashes));

const familySheet = inspectPng(path.join(lightningRoot, 'lightning-family-staging-v2.png'));
check('family contact sheet is present', familySheet.width === 800 && familySheet.height === 192, `${familySheet.width}x${familySheet.height}`);
const familyMap = inspectPng(path.join(lightningRoot, 'lightning-family-map-proof-v2.png'));
check('family map proof is present', familyMap.width === 768 && familyMap.height === 1024, `${familyMap.width}x${familyMap.height}`);

console.log(fails === 0 ? 'LIGHTNING_STAGING_QC_OK' : `LIGHTNING_STAGING_QC_FAIL (${fails})`);
if (fails) process.exitCode = 1;
