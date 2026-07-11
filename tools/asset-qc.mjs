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
  return { width, height, color, alpha: alphaAt != null, bounds: { x0, y0, x1, y1 }, cornerAlpha };
}

const required = {
  'tile-floor-dirt': { source: [64, 64], tile: true },
  'tile-stone-pad': { source: [64, 64], tile: true },
  'objective-portal': { source: [192, 192], overlay: true },
  'objective-crystal': { source: [192, 256], overlay: true },
  'tower-wall-redbrick': { source: [64, 64], tile: true },
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
      const alphaOK = expectation.tile
        ? png.cornerAlpha.every((a) => a > 240)
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
