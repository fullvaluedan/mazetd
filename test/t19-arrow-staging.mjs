// Arrow remains staging-only until this exact family has an approval decision.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inspectAtlasFrames, inspectPng } from '../tools/asset-qc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arrowRoot = path.join(root, 'assets/staging/tower-family/arrow');
const renderSource = readFileSync(path.join(root, 'src/ui/render.js'), 'utf8');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(ok ? '  ok  ' : '  FAIL', name, detail);
  if (!ok) fails++;
};

const statics = Array.from({ length: 5 }, (_, index) =>
  inspectPng(path.join(arrowRoot, `arrow-lv${index + 1}-2x2-grid-v2.png`)));

console.log('Arrow staging family: five 2x2 static tiers');
check('renderer draws the exact occupied 2x2 rectangle without an inset',
  renderSource.includes('const s = Math.max(fp.w, fp.h) * SIZE * pop;') &&
  renderSource.includes('ctx.drawImage(sprite, cx - s / 2 + rx, cy - s / 2 + ry, s, s);'));
for (let index = 0; index < statics.length; index++) {
  const png = statics[index];
  check(`L${index + 1} is 128x128 RGBA`, png.width === 128 && png.height === 128 && png.alpha);
  check(`L${index + 1} fills its exact 2x2 rectangle`,
    png.bounds.x0 === 0 && png.bounds.y0 === 0 && png.bounds.x1 === 127 && png.bounds.y1 === 127,
    JSON.stringify(png.bounds));
}

console.log('Arrow staging attack atlas: four centered 2x2 frames');
const attack = inspectPng(path.join(arrowRoot, 'arrow-attack-2x2-grid-v2.png'));
const frames = inspectAtlasFrames(path.join(arrowRoot, 'arrow-attack-2x2-grid-v2.png'), [2, 2]);
check('attack atlas is 256x256 RGBA', attack.width === 256 && attack.height === 256 && attack.alpha);
check('attack has four non-empty frames', frames.length === 4 && frames.every((frame) => frame.x1 >= frame.x0 && frame.y1 >= frame.y0));
check('attack frames fill their exact 2x2 rectangles', frames.every((frame) => frame.x0 === 0 && frame.y0 === 0 && frame.x1 === 127 && frame.y1 === 127), JSON.stringify(frames));
const frameHashes = frames.map((_, index) => {
  const ox = (index % 2) * 128;
  const oy = Math.floor(index / 2) * 128;
  const bytes = Buffer.alloc(128 * 128 * attack.channels);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const src = ((oy + y) * attack.width + ox + x) * attack.channels;
    attack.pixels.copy(bytes, (y * 128 + x) * attack.channels, src, src + attack.channels);
  }
  return createHash('sha256').update(bytes).digest('hex');
});
check('attack frames are visually distinct by pixel content', new Set(frameHashes).size > 1, JSON.stringify(frameHashes));

console.log(fails === 0 ? 'ARROW_STAGING_QC_OK' : `ARROW_STAGING_QC_FAIL (${fails})`);
if (fails) process.exitCode = 1;
