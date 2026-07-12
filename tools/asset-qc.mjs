// Asset QC is deliberately dependency-free so it can run in CI and validates
// real PNG geometry instead of trusting manifest metadata alone.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

// Supports the 8-bit non-interlaced RGB/RGBA PNGs produced by our art pipeline.
export function inspectPng(file) {
  const data = readFileSync(file);
  if (!data.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let at = 8, width = 0, height = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (at < data.length) {
    const length = data.readUInt32BE(at); at += 4;
    const type = data.toString('ascii', at, at + 4); at += 4;
    const chunk = data.subarray(at, at + length); at += length + 4;
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      depth = chunk[8]; color = chunk[9]; interlace = chunk[12];
    } else if (type === 'IDAT') idat.push(chunk);
    else if (type === 'IEND') break;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[color];
  if (!width || !height || depth !== 8 || !channels || interlace !== 0) {
    throw new Error(`unsupported PNG format depth=${depth} color=${color} interlace=${interlace}`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let cursor = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[cursor++];
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const value = raw[cursor++];
      const left = x >= channels ? row[x - channels] : 0;
      const up = prev ? prev[x] : 0;
      const upLeft = prev && x >= channels ? prev[x - channels] : 0;
      row[x] = filter === 0 ? value : filter === 1 ? (value + left) & 255
        : filter === 2 ? (value + up) & 255
          : filter === 3 ? (value + ((left + up) >> 1)) & 255
            : filter === 4 ? (value + paeth(left, up, upLeft)) & 255 : value;
    }
  }
  const alphaAt = color === 6 ? 3 : color === 4 ? 1 : null;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  if (alphaAt == null) { x0 = 0; y0 = 0; x1 = width - 1; y1 = height - 1; }
  else for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[y * stride + x * channels + alphaAt] > 12) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  const cornerAlpha = alphaAt == null ? [255, 255, 255, 255] : [
    pixels[alphaAt], pixels[(width - 1) * channels + alphaAt],
    pixels[(height - 1) * stride + alphaAt], pixels[(height - 1) * stride + (width - 1) * channels + alphaAt],
  ];
  const result = { width, height, color, alpha: alphaAt != null, bounds: { x0, y0, x1, y1 }, cornerAlpha };
  // Keep decoded data internal to programmatic QC consumers without changing CLI output.
  Object.defineProperties(result, {
    pixels: { value: pixels },
    channels: { value: channels },
    alphaAt: { value: alphaAt },
  });
  return result;
}

export function inspectAtlasFrames(file, grid) {
  const png = inspectPng(file);
  const [cols, rows] = grid;
  if (!png.alpha || png.width % cols || png.height % rows) {
    throw new Error(`invalid atlas grid ${cols}x${rows}`);
  }
  const frameW = png.width / cols;
  const frameH = png.height / rows;
  const { pixels, channels, alphaAt } = png;
  return Array.from({ length: cols * rows }, (_, index) => {
    const ox = (index % cols) * frameW;
    const oy = Math.floor(index / cols) * frameH;
    let x0 = frameW, y0 = frameH, x1 = -1, y1 = -1;
    for (let y = 0; y < frameH; y++) for (let x = 0; x < frameW; x++) {
      const alpha = alphaAt == null ? 255 : pixels[((oy + y) * png.width + ox + x) * channels + alphaAt];
      if (alpha > 12) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    return { x0, y0, x1, y1 };
  });
}

const required = {
  'tile-floor-dirt': { source: [64, 64], tile: true },
  'tile-stone-pad': { source: [64, 64], tile: true },
  'objective-portal': { source: [192, 192], overlay: true },
  'objective-crystal': { source: [192, 256], overlay: true },
  'tower-wall-redbrick': { source: [64, 64], tile: true },
  'tower-arrow-lv1': { source: [128, 128], tower: true },
  'tower-arrow-lv2': { source: [128, 128], tower: true },
  'tower-arrow-lv3': { source: [128, 128], tower: true },
  'tower-arrow-lv4': { source: [128, 128], tower: true },
  'tower-arrow-lv5': { source: [128, 128], tower: true },
  'sheet-tower-arrow-attack': { source: [256, 256], sheet: true },
  'tower-cannon-lv1': { source: [128, 128], tower: true },
  'tower-cannon-lv2': { source: [128, 128], tower: true },
  'tower-cannon-lv3': { source: [128, 128], tower: true },
  'tower-cannon-lv4': { source: [128, 128], tower: true },
  'tower-cannon-lv5': { source: [128, 128], tower: true },
  'tower-frost-lv1': { source: [128, 128], tower: true },
  'tower-frost-lv2': { source: [128, 128], tower: true },
  'tower-frost-lv3': { source: [128, 128], tower: true },
  'tower-frost-lv4': { source: [128, 128], tower: true },
  'tower-frost-lv5': { source: [128, 128], tower: true },
  'tower-poison-lv1': { source: [128, 128], tower: true },
  'tower-poison-lv2': { source: [128, 128], tower: true },
  'tower-poison-lv3': { source: [128, 128], tower: true },
  'tower-poison-lv4': { source: [128, 128], tower: true },
  'tower-poison-lv5': { source: [128, 128], tower: true },
  'sheet-tower-poison-attack': { source: [256, 256], sheet: true },
  'tower-sniper-lv1': { source: [128, 128], tower: true },
  'tower-sniper-lv2': { source: [128, 128], tower: true },
  'tower-sniper-lv3': { source: [128, 128], tower: true },
  'tower-sniper-lv4': { source: [128, 128], tower: true },
  'tower-sniper-lv5': { source: [128, 128], tower: true },
  'sheet-tower-sniper-attack': { source: [256, 256], sheet: true },
  'tower-lightning-lv1': { source: [128, 128], tower: true },
  'tower-lightning-lv2': { source: [128, 128], tower: true },
  'tower-lightning-lv3': { source: [128, 128], tower: true },
  'tower-lightning-lv4': { source: [128, 128], tower: true },
  'tower-lightning-lv5': { source: [128, 128], tower: true },
  'sheet-tower-lightning-attack': { source: [256, 256], sheet: true },
  'tower-support-lv1': { source: [128, 128], tower: true },
  'tower-support-lv2': { source: [128, 128], tower: true },
  'tower-support-lv3': { source: [128, 128], tower: true },
  'tower-support-lv4': { source: [128, 128], tower: true },
  'tower-support-lv5': { source: [128, 128], tower: true },
  'sheet-tower-support-aura': { source: [256, 256], sheet: true },
  'tower-gold-lv1': { source: [128, 128], tower: true },
  'tower-gold-lv2': { source: [128, 128], tower: true },
  'tower-gold-lv3': { source: [128, 128], tower: true },
  'tower-gold-lv4': { source: [128, 128], tower: true },
  'tower-gold-lv5': { source: [128, 128], tower: true },
  'sheet-tower-gold-income': { source: [256, 256], sheet: true },
  'enemy-normal': { source: [64, 64] },
  'sheet-enemy-normal-walk': { source: [128, 128], enemySheet: true },
  'sheet-enemy-normal-defeat': { source: [128, 128], enemySheet: true },
  'enemy-fast': { source: [64, 64] },
  'sheet-enemy-fast-walk': { source: [128, 128], enemySheet: true },
  'sheet-enemy-fast-defeat': { source: [128, 128], enemySheet: true },
  'enemy-tank': { source: [96, 96] },
  'sheet-enemy-tank-walk': { source: [192, 192], enemySheet: true, frame: 96 },
  'sheet-enemy-tank-defeat': { source: [192, 192], enemySheet: true, frame: 96 },
  'enemy-swarm': { source: [48, 48] },
  'sheet-enemy-swarm-walk': { source: [96, 96], enemySheet: true, frame: 48 },
  'sheet-enemy-swarm-defeat': { source: [96, 96], enemySheet: true, frame: 48 },
  'enemy-flyer': { source: [64, 64] },
  'sheet-enemy-flyer-walk': { source: [128, 128], enemySheet: true },
  'sheet-enemy-flyer-defeat': { source: [128, 128], enemySheet: true },
  'enemy-healer': { source: [64, 64] },
  'sheet-enemy-healer-walk': { source: [128, 128], enemySheet: true },
  'sheet-enemy-healer-defeat': { source: [128, 128], enemySheet: true },
  'enemy-shield': { source: [64, 64] },
  'sheet-enemy-shield-walk': { source: [128, 128], enemySheet: true },
  'sheet-enemy-shield-defeat': { source: [128, 128], enemySheet: true },
  'enemy-boss': { source: [128, 128] },
  'sheet-enemy-boss-walk': { source: [256, 256], enemySheet: true, frame: 128 },
  'sheet-enemy-boss-defeat': { source: [256, 256], enemySheet: true, frame: 128 },
};

export function verifyProductionAssets(manifest) {
  const results = [];
  for (const [id, expectation] of Object.entries(required)) {
    const entry = manifest[id];
    if (!entry?.src) { results.push({ id, ok: false, reason: 'missing manifest entry' }); continue; }
    try {
      const png = inspectPng(path.join(ROOT, entry.src));
      const dimensionOK = png.width === expectation.source[0] && png.height === expectation.source[1];
      const bounds = png.bounds;
      const alphaOK = expectation.sheet
        ? inspectAtlasFrames(path.join(ROOT, entry.src), [2, 2]).every((frame) => frame.x0 === 0 && frame.y0 === 0 && frame.x1 === 127 && frame.y1 === 127)
        : expectation.enemySheet
          ? inspectAtlasFrames(path.join(ROOT, entry.src), [2, 2]).every((frame) => {
            const size = expectation.frame || 64;
            return frame.x0 > 0 && frame.y0 > 0 && frame.x1 < size - 1 && frame.y1 < size - 1;
          })
        : expectation.tile
        ? png.cornerAlpha.every((a) => a > 240)
        : expectation.tower
          ? bounds.x0 === 0 && bounds.y0 === 0 && bounds.x1 === png.width - 1 && bounds.y1 === png.height - 1
        : bounds.x0 > 0 && bounds.y0 > 0 && bounds.x1 < png.width - 1 && bounds.y1 < png.height - 1;
      results.push({ id, ok: dimensionOK && alphaOK, png, reason: dimensionOK ? (alphaOK ? '' : 'unsafe alpha bounds') : `expected ${expectation.source.join('x')}` });
    } catch (error) { results.push({ id, ok: false, reason: error.message }); }
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'));
  const results = verifyProductionAssets(manifest);
  for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.id}${result.reason ? `: ${result.reason}` : ''}`);
  console.log(results.every((result) => result.ok) ? 'ASSET_QC_OK' : 'ASSET_QC_FAIL');
  if (!results.every((result) => result.ok)) process.exitCode = 1;
}
