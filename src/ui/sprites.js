// =============================================================================
// sprites.js — optional generated-art layer.
//
// If assets/manifest.json exists (created by tools/gen-assets.mjs), load every
// image it lists. render.js then draws the sprite when it's ready and falls
// back to the original canvas shapes when it isn't — so the game remains 100%
// playable with zero asset files, and art "pops in" as it loads.
//
// This module is UI-only and must never break headless/Node runs: everything
// is wrapped so a missing fetch/Image (or a missing assets folder) just means
// "no sprites".
// =============================================================================

const images = new Map();   // id -> HTMLImageElement (only set once fully loaded)
const urls = new Map();     // id -> manifest path (for DOM <img> icons)
const sheets = new Map();   // base id (e.g. 'enemy-normal') -> [frame canvases]
let enabled = true;          // user toggle (HUD "Art" button)

export function spritesEnabled() { return enabled; }
export function toggleSprites() { enabled = !enabled; return enabled; }

function getLoadedSprite(id, frame) {
  if (!enabled) return null;
  if (frame != null) {
    const f = sheets.get(id);
    if (f) return f[((frame % f.length) + f.length) % f.length];
  }
  return images.get(id) || null;
}

// Returns the loaded image for an id (e.g. 'tower-archer'), or null. With a
// frame index, returns that walk-cycle frame when a sheet survived loading.
export function getSprite(id, frame) {
  return getLoadedSprite(id, frame);
}

export function getSpriteChain(ids, frame) {
  if (!enabled) return null;
  for (const id of ids) {
    const sprite = getLoadedSprite(id, frame);
    if (sprite) return sprite;
  }
  return null;
}

// Whether an id has an animated walk-cycle sheet.
export function hasSheet(id) { return enabled && sheets.has(id); }

export function spriteCount() { return images.size; }

export function towerSpriteCandidates(type, level = 1) {
  if (type === 'wall') return ['tower-wall-redbrick', 'tower-wall'];
  const top = Math.max(1, Math.min(5, level | 0 || 1));
  const ids = [];
  for (let lvl = top; lvl >= 1; lvl--) ids.push(`tower-${type}-lv${lvl}`);
  ids.push(`tower-${type}`);
  return ids;
}

export function towerAttackCandidates(type, level = 1) {
  const top = Math.max(1, Math.min(5, level | 0 || 1));
  const ids = [];
  for (let lvl = top; lvl >= 1; lvl--) ids.push(`tower-${type}-attack-lv${lvl}`);
  ids.push(`tower-${type}-attack`);
  return ids;
}

export function towerAuraCandidates(type, level = 1) {
  const top = Math.max(1, Math.min(5, level | 0 || 1));
  const ids = [];
  for (let lvl = top; lvl >= 1; lvl--) ids.push(`tower-${type}-aura-lv${lvl}`);
  ids.push(`tower-${type}-aura`);
  return ids;
}

export function towerIncomeCandidates(type, level = 1) {
  const top = Math.max(1, Math.min(5, level | 0 || 1));
  const ids = [];
  for (let lvl = top; lvl >= 1; lvl--) ids.push(`tower-${type}-income-lv${lvl}`);
  ids.push(`tower-${type}-income`);
  return ids;
}

export function enemyStateCandidates(type, state = 'idle') {
  return [`enemy-${type}-${state}`, `enemy-${type}`];
}

// URL of a generated asset for DOM <img> use (radial icons, portraits), or
// null when the art isn't generated/loaded. Respects the Art toggle.
export function getSpriteUrl(id) {
  if (!enabled || !images.has(id)) return null;
  return urls.get(id) || null;
}

// Generated PNGs are 1024px but drawn at ~32–40px. Downscaling once into a
// small offscreen canvas slashes GPU memory and per-frame draw cost (matters a
// lot on phones). Backgrounds stay full-size; everything else becomes 128px.
function shrink(id, img) {
  if (id.startsWith('misc-')) return img;
  try {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, S, S);
    return c;
  } catch { return img; }   // any hiccup: just use the original
}

// ---- walk-cycle sheets -------------------------------------------------------
// AI-generated 2x2 sheets are never pixel-perfect: frames drift in position and
// size. Each frame is re-centered on its alpha bounding box and scaled by ONE
// shared factor (largest frame wins) so the character doesn't pulse between
// frames. A sheet with an empty or full-bleed quadrant is dropped entirely —
// the unit falls back to its single sprite + procedural motion.
function sliceSheet(img, frames, grid) {
  try {
    const [gx, gy] = grid;
    const fw = (img.width / gx) | 0, fh = (img.height / gy) | 0;
    const probe = document.createElement('canvas');
    probe.width = fw; probe.height = fh;
    const pg = probe.getContext('2d', { willReadFrequently: true });

    // pass 1: alpha bounding boxes
    const boxes = [];
    for (let i = 0; i < frames; i++) {
      const sx = (i % gx) * fw, sy = ((i / gx) | 0) * fh;
      pg.clearRect(0, 0, fw, fh);
      pg.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      const data = pg.getImageData(0, 0, fw, fh).data;
      let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
      for (let y = 0; y < fh; y += 2) {           // stride 2: plenty for a bbox
        for (let x = 0; x < fw; x += 2) {
          if (data[(y * fw + x) * 4 + 3] > 24) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return null;                              // empty quadrant
      const bw = x1 - x0, bh = y1 - y0;
      if (bw > fw * 0.97 && bh > fh * 0.97) return null;    // full-bleed mess
      boxes.push({ sx: sx + x0, sy: sy + y0, bw, bh });
    }

    // pass 2: shared scale, centered 128px frames
    const S = 128;
    const maxDim = Math.max(...boxes.map((b) => Math.max(b.bw, b.bh)));
    const k = (S - 12) / maxDim;
    return boxes.map((b) => {
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, b.sx, b.sy, b.bw, b.bh,
        (S - b.bw * k) / 2, (S - b.bh * k) / 2, b.bw * k, b.bh * k);
      return c;
    });
  } catch { return null; }
}

export async function loadSprites() {
  if (typeof fetch === 'undefined' || typeof Image === 'undefined') return 0; // headless
  let manifest;
  try {
    const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return 0;                    // no generated assets — shapes only
    manifest = await res.json();
  } catch { return 0; }

  const srcCache = new Map();
  const jobs = Object.entries(manifest).map(([id, entry]) => new Promise((resolve) => {
    const isObject = entry && typeof entry === 'object';
    const isSheet = isObject && (entry.kind === 'sheet' || Number.isFinite(entry.frames));
    const src = isObject ? entry.src : entry;
    if (typeof src !== 'string') { resolve(false); return; }
    // SVG symbol sheets are consumed directly by <use>; loading them through
    // Image would add no drawable sprite and can vary across browsers.
    if (isObject && entry.kind === 'svg-symbol-sheet') { urls.set(id, src); resolve(true); return; }
    const cacheKey = `${isSheet ? 'sheet' : 'img'}:${src}`;
    let pending = srcCache.get(cacheKey);
    if (!pending) {
      pending = new Promise((resolveAsset) => {
        const img = new Image();
        img.onload = () => {
          if (isSheet) {
            const frames = sliceSheet(img, entry.frames || 4, entry.grid || [2, 2]);
            if (frames) resolveAsset({ kind: 'sheet', value: frames });
            else {
              console.log(`[sprites] dropped misaligned sheet ${id} (procedural fallback)`);
              resolveAsset(null);
            }
          } else {
            resolveAsset({ kind: 'image', value: shrink(id, img) });
          }
        };
        img.onerror = () => resolveAsset(null);   // listed but not generated yet — fine
        img.src = src;
      });
      srcCache.set(cacheKey, pending);
    }
    pending.then((asset) => {
      if (!asset) { resolve(false); return; }
      if (asset.kind === 'sheet') {
        sheets.set(id.replace(/^sheet-/, ''), asset.value);
      } else {
        images.set(id, asset.value);
        urls.set(id, src);
      }
      resolve(true);
    });
  }));
  const results = await Promise.all(jobs);
  const n = results.filter(Boolean).length;
  if (n) console.log(`[sprites] loaded ${n}/${jobs.length} generated assets (${sheets.size} walk sheets)`);
  return n;
}
