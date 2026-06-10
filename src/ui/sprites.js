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
let enabled = true;          // user toggle (HUD "Art" button)

export function spritesEnabled() { return enabled; }
export function toggleSprites() { enabled = !enabled; return enabled; }

// Returns the loaded image for an id (e.g. 'tower-archer'), or null.
export function getSprite(id) {
  if (!enabled) return null;
  return images.get(id) || null;
}

export function spriteCount() { return images.size; }

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

export async function loadSprites() {
  if (typeof fetch === 'undefined' || typeof Image === 'undefined') return 0; // headless
  let manifest;
  try {
    const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return 0;                    // no generated assets — shapes only
    manifest = await res.json();
  } catch { return 0; }

  const jobs = Object.entries(manifest).map(([id, path]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(id, shrink(id, img)); resolve(true); };
    img.onerror = () => resolve(false);       // listed but not generated yet — fine
    img.src = path;
  }));
  const results = await Promise.all(jobs);
  const n = results.filter(Boolean).length;
  if (n) console.log(`[sprites] loaded ${n}/${jobs.length} generated assets`);
  return n;
}
