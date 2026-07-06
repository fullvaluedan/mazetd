// =============================================================================
// render.js — all canvas drawing. Everything is drawn from flat shapes + the
// CONFIG palette so the placeholder art looks intentional, not broken.
//
// This is the single place that reads game state and paints a frame. It never
// mutates state. Phases add more layers (enemies, towers, projectiles, hero,
// effects) but the structure stays: background -> map -> overlays -> entities ->
// effects -> cursor.
//
// U4 (big boards): render() takes the viewport and culls everything outside
// the visible world rect (+1 cell margin) when zoomed in; at zoom 1 the view
// is null and every cull check short-circuits to "draw". The static board
// (background + grid + border/obstacle cells) is cached to an offscreen canvas
// at WORLD resolution x dpr (capped 2 — never zoomed device resolution) and
// blitted under the camera transform; the cache invalidates off state.js's
// maze-revision counter (build/sell/snapshot-load), never per frame.
// =============================================================================

import { CONFIG } from '../config.js';
import { CELL, COLS, ROWS, SIZE, cellCenter, cellCenterX, cellCenterY, worldW, worldH } from '../engine/grid.js';
import { canBuildAt, wouldSealAt, getMapRev } from '../game/state.js';
import { marqueeCells } from '../game/shop.js';
import { getSprite, spriteCount, spritesEnabled } from './sprites.js';

const C = CONFIG.COLORS;

export function render(ctx, state, viewport = null) {
  const view = computeView(viewport);

  // screen shake (juice): jitter the whole world layer
  const shaking = state.shake > 0.1;
  if (shaking) {
    ctx.save();
    const m = state.shake;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  drawStatic(ctx, state, view);
  if (state.showPath) drawPaths(ctx, state);
  drawSpawnGoalMarkers(ctx, state, view);
  drawTowers(ctx, state, view);
  drawEnemies(ctx, state, view);
  drawProjectiles(ctx, state, view);
  drawEffects(ctx, state, view);
  drawParticles(ctx, state, view);
  drawSelected(ctx, state);
  drawHero(ctx, state);
  drawFloaters(ctx, state, view);
  drawHover(ctx, state);
  drawMarquee(ctx, state);
  drawMenuCell(ctx, state);
  drawAbilityTarget(ctx, state);
  if (shaking) ctx.restore();
}

// ---------------------------------------------------------------------------
// U4: view culling
// ---------------------------------------------------------------------------

// Visible world rect from the camera, expanded by ONE cell of margin, plus the
// matching inclusive cell-index bounds. Returns null when everything is
// visible (no viewport, or zoom 1 = fit-all) so culling costs one null check.
export function computeView(viewport) {
  if (!viewport || viewport.zoom <= 1) return null;
  const m = SIZE;   // +1 cell margin: cells straddling the edge never pop
  const x0 = viewport.camX - m;
  const y0 = viewport.camY - m;
  const x1 = viewport.camX + worldW() / viewport.zoom + m;
  const y1 = viewport.camY + worldH() / viewport.zoom + m;
  return {
    x0, y0, x1, y1,
    cx0: Math.max(0, Math.floor(x0 / SIZE)),
    cy0: Math.max(0, Math.floor(y0 / SIZE)),
    cx1: Math.min(COLS - 1, Math.ceil(x1 / SIZE) - 1),
    cy1: Math.min(ROWS - 1, Math.ceil(y1 / SIZE) - 1),
  };
}

// Cell-indexed cull check (towers, markers). null view = everything visible.
export function viewHasCell(v, cx, cy) {
  return !v || (cx >= v.cx0 && cx <= v.cx1 && cy >= v.cy0 && cy <= v.cy1);
}

// World-point cull check with a per-entity pad (radius, bar/text overhang).
function inV(v, x, y, pad) {
  return !v || (x + pad >= v.x0 && x - pad <= v.x1 && y + pad >= v.y0 && y - pad <= v.y1);
}

// Bounding-box overlap (beams/chains whose endpoints may both sit off-screen
// while the middle crosses the view). Conservative: may keep a diagonal that
// misses the corner, never drops a visible one.
function bboxInV(v, minX, minY, maxX, maxY) {
  return !v || !(maxX < v.x0 || minX > v.x1 || maxY < v.y0 || minY > v.y1);
}

// ---------------------------------------------------------------------------
// U4: static map layer cache (background + grid lines + border/obstacle cells)
// ---------------------------------------------------------------------------
// Cached at world px x dpr (capped 2) and scaled by the camera transform on
// blit. NEVER at zoomed device resolution: a 28x44 board at zoom 2.5 / dpr 2
// would be a ~126 MB backing store, past iOS canvas limits. Renderer-local
// state only — nothing is ever written onto the game state.
// Invalidation: maze rev (build/sell/load), grid size, map identity (level
// boot), dpr, and sprite availability (background art pops in async + the Art
// toggle). All integer/reference compares, once per frame.
let staticCache = null;

function drawStatic(ctx, state, view) {
  const layer = staticLayer(state);
  if (!layer) {   // headless / no-canvas environment: direct draws, still culled
    drawBackground(ctx, view);
    drawMap(ctx, state, view);
    return;
  }
  const W = worldW(), H = worldH();
  if (view) {
    // Blit only the visible sub-rect (source px = world px * cache scale).
    const s = staticCache.scale;
    const dx = Math.max(0, view.x0), dy = Math.max(0, view.y0);
    const dw = Math.min(W, view.x1) - dx, dh = Math.min(H, view.y1) - dy;
    if (dw > 0 && dh > 0) ctx.drawImage(layer, dx * s, dy * s, dw * s, dh * s, dx, dy, dw, dh);
  } else {
    ctx.drawImage(layer, 0, 0, W, H);
  }
}

function staticLayer(state) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const scale = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  const rev = getMapRev(), sprites = spriteCount(), art = spritesEnabled();
  const c = staticCache;
  if (c && c.rev === rev && c.map === state.map && c.cols === COLS && c.rows === ROWS &&
      c.scale === scale && c.sprites === sprites && c.art === art) {
    return c.canvas;
  }
  const w = Math.max(1, Math.round(worldW() * scale));
  const h = Math.max(1, Math.round(worldH() * scale));
  let canvas = c && c.canvas;
  if (!canvas || canvas.width !== w || canvas.height !== h) {
    canvas = document.createElement('canvas');
    if (!canvas || !canvas.getContext) return null;
    canvas.width = w; canvas.height = h;
  }
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.setTransform(scale, 0, 0, scale, 0, 0);   // draw in world px, store at dpr
  g.clearRect(0, 0, worldW(), worldH());
  drawBackground(g, null);                     // full board: the cache is world-sized
  drawMap(g, state, null);
  staticCache = { canvas, rev, map: state.map, cols: COLS, rows: ROWS, scale, sprites, art };
  return canvas;
}

// Screen-space pass — call AFTER viewport.applyScreenTransform(ctx): with the
// camera gone from the transform these stay glued to the screen under any
// pan/zoom (and aren't shaken). Coordinates are still world px at the fit
// scale, so drawing is pixel-identical to the pre-camera letterbox.
export function renderScreen(ctx, state) {
  drawBossBars(ctx, state);
  if (state.flash > 0) drawFlash(ctx, state);
}

function drawParticles(ctx, state, view) {
  if (!state.particles) return;
  for (const p of state.particles) {
    if (!inV(view, p.x, p.y, 3)) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function drawHero(ctx, state) {
  const h = state.hero;
  if (!h) return;

  if (h.downed) {
    // ghost + respawn countdown at the base
    const c = cellCenter(h.baseCell.x, h.baseCell.y);
    ctx.globalAlpha = 0.4;
    drawHeroShape(ctx, c.x, c.y, h.def.color, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.text;
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`↻ ${Math.ceil(h.respawnLeft)}s`, c.x, c.y - 16);
    ctx.textAlign = 'left';
    return;
  }

  // move-target marker
  if (h.moveTarget) {
    const m = cellCenter(h.moveTarget.x, h.moveTarget.y);
    ctx.strokeStyle = withAlpha(h.def.color, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, 6 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  // move-mode indicator: pulsing ring + "tap to move" affordance
  if (state.heroSelected) {
    ctx.strokeStyle = 'rgba(255,224,138,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 16 + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // attack range (faint) + hawk-eye buff glow
  ctx.strokeStyle = withAlpha(h.def.color, h.buffLeft > 0 ? 0.45 : 0.18);
  ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.arc(h.x, h.y, h.range * SIZE, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // cosmetic: walk bob while moving (orders OR auto-chase), idle breathe,
  // facing flip, melee lunge toward the target, hit flash when swarmed
  const heroMoving = !!(h.moveTarget || h.path);
  if (h._lastX != null && Math.abs(h.x - h._lastX) > 0.2) h._face = h.x < h._lastX ? -1 : 1;
  h._lastX = h.x;
  const heroBob = heroMoving
    ? -Math.abs(Math.sin(state.time * 9)) * 2.5
    : Math.sin(state.time * 2) * 1.1;
  // attack motion: melee lunges INTO the swing (12px), ranged kicks back
  const lungeK = h.lunge > 0 ? (h.lunge / 0.18) * 12 * (h.lungeDir || 1) : 0;
  const lx = Math.cos(h.angle) * lungeK, ly = Math.sin(h.angle) * lungeK;
  if (h.hitFlash > 0) {
    ctx.strokeStyle = `rgba(255,90,80,${Math.min(1, h.hitFlash / 0.08)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  // NOTE: heroes deliberately do NOT step walk-sheet frames — AI sheet frames
  // redraw held items (the warrior's sword) in slightly different poses, which
  // reads as flicker at 34px. Bob + facing flip alone keeps the walk alive.
  const heroSprite = getSprite('hero-' + h.id);
  if (heroSprite) {
    ctx.save();
    ctx.translate(h.x + lx, h.y + heroBob + ly);
    ctx.scale(h._face || 1, 1);
    const s = 34;
    ctx.drawImage(heroSprite, -s / 2, -s / 2, s, s);
    ctx.restore();
  } else {
    drawHeroShape(ctx, h.x + lx, h.y + heroBob + ly, h.def.color, h.angle);
  }

  // HP bar + level
  const bw = 26, bx = h.x - bw / 2, by = h.y - 18;
  ctx.fillStyle = C.hpBack; ctx.fillRect(bx, by, bw, 4);
  ctx.fillStyle = '#5fce7a'; ctx.fillRect(bx, by, bw * Math.max(0, h.hp / h.maxHp), 4);
  ctx.fillStyle = '#ffe08a';
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('L' + h.level, h.x, by - 3);
  ctx.textAlign = 'left';
}

function drawHeroShape(ctx, x, y, color, angle) {
  ctx.save();
  ctx.translate(x, y);
  // diamond body
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0c0e14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11); ctx.lineTo(9, 0); ctx.lineTo(0, 11); ctx.lineTo(-9, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // facing nub
  ctx.fillStyle = '#0c0e14';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 7, Math.sin(angle) * 7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAbilityTarget(ctx, state) {
  if (!state.targetingAbility && !state.targetingConsumable) return;
  if (!state.hover) return;
  const { x, y } = state.hover;
  const c = cellCenter(x, y);
  const radius = state.targetingAbility ? state.targetingAbility.radius
    : (state.targetingConsumable && state.targetingConsumable.radius) || 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,224,138,0.8)';
  ctx.fillStyle = 'rgba(255,224,138,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(c.x, c.y, radius * SIZE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawBossBars(ctx, state) {
  const bosses = state.enemies.filter((e) => e.alive && e.boss);
  if (bosses.length === 0) return;
  const bw = 360, bh = 14;
  let y = 10;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  for (const b of bosses) {
    const x = (worldW() - bw) / 2;
    ctx.fillStyle = 'rgba(12,14,20,0.85)';
    roundRect(ctx, x - 2, y - 2, bw + 4, bh + 4, 4); ctx.fill();
    ctx.fillStyle = '#3a1f3f';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#c65bd6';
    ctx.fillRect(x, y, bw * Math.max(0, b.hp / b.maxHp), bh);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${b.name}  ${Math.ceil(b.hp).toLocaleString()} / ${b.maxHp.toLocaleString()}`, worldW() / 2, y + bh - 3);
    y += bh + 6;
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

// Normally rendered ONCE into the static-layer cache (view = null). The view
// parameter only matters on the no-canvas fallback path, where these run per
// frame and cull to the visible rows/cols.
function drawBackground(ctx, view) {
  const bgImg = getSprite('misc-background');
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, worldW(), worldH());
    // golden-hour wash: keeps the meadow warm and bright (the old dark-blue
    // dim turned it olive — the single biggest "muddy board" offender)
    ctx.fillStyle = 'rgba(255, 214, 140, 0.08)';
    ctx.fillRect(0, 0, worldW(), worldH());
  } else {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, worldW(), worldH());
  }
  ctx.strokeStyle = C.gridLine;
  ctx.lineWidth = 1;
  const gx0 = view ? view.cx0 : 0, gx1 = view ? Math.min(COLS, view.cx1 + 1) : COLS;
  const gy0 = view ? view.cy0 : 0, gy1 = view ? Math.min(ROWS, view.cy1 + 1) : ROWS;
  for (let x = gx0; x <= gx1; x++) {
    ctx.beginPath();
    ctx.moveTo(x * SIZE + 0.5, 0);
    ctx.lineTo(x * SIZE + 0.5, worldH());
    ctx.stroke();
  }
  for (let y = gy0; y <= gy1; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * SIZE + 0.5);
    ctx.lineTo(worldW(), y * SIZE + 0.5);
    ctx.stroke();
  }
}

function drawMap(ctx, state, view) {
  const y0 = view ? view.cy0 : 0, y1 = view ? view.cy1 : ROWS - 1;
  const x0 = view ? view.cx0 : 0, x1 = view ? view.cx1 : COLS - 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = state.map.cells[y][x];
      if (t === CELL.BORDER) {
        ctx.fillStyle = C.border;
        ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
      } else if (t === CELL.OBSTACLE) {
        drawObstacle(ctx, x, y);
      }
    }
  }
}

// Obstacles are scenery now, not UI panels: alternating sun-bleached rocks
// and leafy bushes (deterministic per cell so the map never shimmers).
function drawObstacle(ctx, x, y) {
  const cx = cellCenterX(x), cy = cellCenterY(y);
  const isBush = ((x * 7 + y * 13) % 3) !== 0;
  // soft contact shadow
  ctx.fillStyle = 'rgba(60, 42, 20, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 9, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (isBush) {
    // three overlapping leafy lobes + highlight
    ctx.fillStyle = C.bush;
    for (const [ox, oy, r] of [[-7, 2, 8], [7, 2, 8], [0, -4, 10]]) {
      ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = C.bushHi;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(cx - 3, cy - 6, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // rounded boulder with a lit top
    ctx.fillStyle = C.obstacle;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 9);
    ctx.quadraticCurveTo(cx - 14, cy - 6, cx - 4, cy - 10);
    ctx.quadraticCurveTo(cx + 8, cy - 13, cx + 12, cy - 2);
    ctx.quadraticCurveTo(cx + 14, cy + 9, cx, cy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.obstacleHi;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(cx - 2, cy - 6, 7, 4, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPaths(ctx, state) {
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -(state.time * 24) % 12;   // gentle marching dashes
  ctx.strokeStyle = C.path;
  for (const s of state.map.spawns) {
    const path = state.paths[s.id];
    if (!path || path.length < 2) continue;
    ctx.beginPath();
    const start = cellCenter(path[0].x, path[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < path.length; i++) {
      const p = cellCenter(path[i].x, path[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpawnGoalMarkers(ctx, state, view) {
  ctx.save();
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // SPAWNS: a swirling dark portal mouth (sprite when generated)
  for (const s of state.map.spawns) {
    if (!viewHasCell(view, s.cx, s.cy)) continue;
    const c = cellCenter(s.cx, s.cy);
    const img = getSprite('misc-spawn');
    if (img) {
      ctx.drawImage(img, c.x - 19, c.y - 19, 38, 38);
    } else {
      ctx.fillStyle = '#2b1f3a';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 2; i++) {                  // rotating swirl arms
        const a0 = state.time * 2.4 + i * Math.PI;
        ctx.strokeStyle = `rgba(168, 120, 255, ${0.7 - i * 0.25})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6 + i * 3.5, a0, a0 + 2.1);
        ctx.stroke();
      }
    }
  }

  // EXITS: the camp you're protecting — a crackling little campfire
  for (const g of state.map.goals) {
    if (!viewHasCell(view, g.cx, g.cy)) continue;
    const c = cellCenter(g.cx, g.cy);
    const img = getSprite('misc-camp');
    if (img) {
      ctx.drawImage(img, c.x - 19, c.y - 19, 38, 38);
    } else {
      // crossed logs
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x - 9, c.y + 9); ctx.lineTo(c.x + 9, c.y + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x + 9, c.y + 9); ctx.lineTo(c.x - 9, c.y + 4); ctx.stroke();
      ctx.lineCap = 'butt';
      // flickering flame (two licks + glow)
      const f = Math.sin(state.time * 9 + g.cx) * 2;
      const glow = 0.25 + 0.1 * Math.sin(state.time * 6);
      ctx.fillStyle = `rgba(255, 176, 60, ${glow})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9e2e';
      ctx.beginPath();
      ctx.moveTo(c.x - 6, c.y + 6);
      ctx.quadraticCurveTo(c.x - 7, c.y - 4 + f, c.x, c.y - 11 - f);
      ctx.quadraticCurveTo(c.x + 7, c.y - 4 - f, c.x + 6, c.y + 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd35c';
      ctx.beginPath();
      ctx.moveTo(c.x - 3, c.y + 6);
      ctx.quadraticCurveTo(c.x - 3, c.y - 1 - f, c.x, c.y - 5 + f);
      ctx.quadraticCurveTo(c.x + 3, c.y - 1 + f, c.x + 3, c.y + 6);
      ctx.closePath(); ctx.fill();
    }
  }

  // checkpoint flags (Gem TD): gold banner on a pole, numbered, gentle wave
  const cps = state.map.checkpoints || [];
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    if (!viewHasCell(view, cp.cx, cp.cy)) continue;
    const c = cellCenter(cp.cx, cp.cy);
    const wave = Math.sin(state.time * 3 + i) * 2;
    ctx.strokeStyle = '#7a5a2e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(c.x - 4, c.y + 12);
    ctx.lineTo(c.x - 4, c.y - 12);
    ctx.stroke();
    ctx.fillStyle = '#ffd35c';
    ctx.beginPath();
    ctx.moveTo(c.x - 3, c.y - 12);
    ctx.lineTo(c.x + 12 + wave, c.y - 8);
    ctx.lineTo(c.x - 3, c.y - 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2106';
    ctx.font = 'bold 9px Segoe UI, sans-serif';
    ctx.fillText(String(i + 1), c.x + 3, c.y - 7.5);
    ctx.font = 'bold 11px Segoe UI, sans-serif';
  }
  ctx.restore();
}

function drawTowers(ctx, state, view) {
  for (const t of state.towers) {
    // Cell test + the 1-cell view margin covers every overhang a tower draws
    // (sprite oversize, falcon orbit ~26px, aura pulse ring, bars, pips).
    if (!viewHasCell(view, t.cx, t.cy)) continue;
    const px = t.cx * SIZE, py = t.cy * SIZE;
    const cx = cellCenterX(t.cx), cy = cellCenterY(t.cy);
    const sprite = getSprite('tower-' + t.type);

    // cosmetic: build pop-in + recoil kick opposite the shot direction
    const age = state.time - (t.builtAt != null ? t.builtAt : -10);
    const pop = age < 0.22 ? 0.55 + 0.45 * (age / 0.22) : 1;
    let rx = 0, ry = 0;
    if (t.muzzle > 0 && !t.def.aura) {
      const r = (t.muzzle / 0.08) * 2.2;
      rx = -Math.cos(t.angle) * r; ry = -Math.sin(t.angle) * r;
    }
    if (age >= 0 && age < 0.3) {                  // build dust ring
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - age / 0.3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + (age / 0.3) * 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (sprite) {
      // sprite art: draw slightly larger than the cell for presence
      const s = (SIZE + 6) * pop;
      ctx.drawImage(sprite, cx - s / 2 + rx, cy - s / 2 - 2 + ry, s, s);
    } else {
      const pad = 3, r = 6;
      // base body
      roundRect(ctx, px + pad, py + pad, SIZE - pad * 2, SIZE - pad * 2, r);
      ctx.fillStyle = t.def.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // barrel pointing at the last target
      ctx.strokeStyle = '#0c0e14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(t.angle) * 11, cy + Math.sin(t.angle) * 11);
      ctx.stroke();

      // glyph
      ctx.fillStyle = '#0c0e14';
      ctx.font = 'bold 13px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.def.glyph, cx, cy - 1);
    }

    // muzzle flash (both modes)
    if (t.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(t.angle) * 12, cy + Math.sin(t.angle) * 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // siege: red outline while being chewed + HP bar once damaged
    if (t.underAttack > 0) {
      ctx.strokeStyle = `rgba(226,75,74,${Math.min(1, t.underAttack / 0.2)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1.5, py + 1.5, SIZE - 3, SIZE - 3);
    }
    if (t.hp < t.maxHp) {
      const frac = Math.max(0, t.hp / t.maxHp);
      ctx.fillStyle = C.hpBack;
      ctx.fillRect(px + 4, py + SIZE - 4, SIZE - 8, 3);
      ctx.fillStyle = frac > 0.4 ? C.hpFront : C.danger;
      ctx.fillRect(px + 4, py + SIZE - 4, (SIZE - 8) * frac, 3);
    }

    // level pips along the bottom
    const pips = t.level;
    for (let i = 0; i < pips; i++) {
      ctx.fillStyle = i === 3 ? '#ffe08a' : '#0c0e14';
      ctx.beginPath();
      ctx.arc(px + 7 + i * 6, py + SIZE - 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // branch letter at L4
    if (t.branch) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = 'bold 9px Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(t.branch, px + SIZE - 4, py + 9);
    }
    // Falcon towers: a summoned bird circles the perch and swoops along the
    // attack direction when the tower fires. Pure cosmetics on muzzle timing.
    if (t.def.falcon) {
      const orbitA = state.time * 2.2 + t.uid * 1.7;
      let fx, fy, fa;
      if (t.muzzle > 0) {
        const k = 1 - t.muzzle / 0.08;                 // 0 -> 1 across the flash
        const swoop = Math.sin(k * Math.PI) * 16;      // out and back
        fx = cx + Math.cos(t.angle) * (10 + swoop);
        fy = cy + Math.sin(t.angle) * (10 + swoop) - 8;
        fa = t.angle;
      } else {
        fx = cx + Math.cos(orbitA) * 16;
        fy = cy + Math.sin(orbitA) * 9 - 14;           // flat ellipse above the perch
        fa = orbitA + Math.PI / 2;
      }
      const bird = getSprite('misc-falcon');
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(Math.cos(fa) < 0 ? -1 : 1, 1);
      if (bird) {
        ctx.drawImage(bird, -9, -9, 18, 18);
      } else {
        ctx.fillStyle = t.def.color;
        ctx.beginPath();                                // simple wing chevron
        ctx.moveTo(-7, 2); ctx.lineTo(0, -4); ctx.lineTo(7, 2); ctx.lineTo(0, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // soft shadow under the bird
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(fx, cy + 10, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beacons pulse softly; buffed towers get a small pink pip
    if (t.def.aura) {
      const pulse = 0.25 + 0.15 * Math.sin(state.time * 3);
      ctx.strokeStyle = withAlpha(t.def.color, pulse);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    } else if (t.buffDmg > 0 || t.buffSpeed > 0) {
      ctx.fillStyle = '#e08ac8';
      ctx.beginPath();
      ctx.arc(px + SIZE - 6, py + SIZE - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function drawProjectiles(ctx, state, view) {
  for (const p of state.projectiles) {
    if (!inV(view, p.x, p.y, 12)) continue;
    // oriented streak along the velocity + bright head
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const heavy = p.stats.splashRadius > 0;
    const len = heavy ? 7 : 10;
    ctx.strokeStyle = withAlpha(p.color, 0.5);
    ctx.lineWidth = heavy ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(p.x - (dx / d) * len, p.y - (dy / d) * len);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, heavy ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects(ctx, state, view) {
  for (const e of state.effects) {
    const a = Math.max(0, e.life / e.max);
    if (e.kind === 'beam') {
      // beams span up to tower range: bbox overlap, not endpoint tests
      if (!bboxInV(view, Math.min(e.x1, e.x2), Math.min(e.y1, e.y2),
        Math.max(e.x1, e.x2), Math.max(e.y1, e.y2))) continue;
      ctx.strokeStyle = withAlpha(e.color, a);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    } else if (e.kind === 'chain') {
      if (view) {
        let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
        for (const pt of e.points) {
          if (pt.x < mnx) mnx = pt.x; if (pt.x > mxx) mxx = pt.x;
          if (pt.y < mny) mny = pt.y; if (pt.y > mxy) mxy = pt.y;
        }
        if (!bboxInV(view, mnx, mny, mxx, mxy)) continue;
      }
      ctx.strokeStyle = withAlpha(e.color, a);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < e.points.length; i++) {
        const pt = e.points[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    } else if (e.kind === 'splash') {
      if (!inV(view, e.x, e.y, e.r * SIZE)) continue;
      ctx.strokeStyle = withAlpha(e.color, a * 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * SIZE * (1 - a * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === 'spark') {
      if (!inV(view, e.x, e.y, 8)) continue;
      ctx.fillStyle = withAlpha(e.color, a);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3 * a + 1, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'slash') {
      if (!inV(view, e.x, e.y, 26)) continue;
      // hero sword swing: a bright crescent sweeping across the attack line
      const p = 1 - a;                                    // 0 -> 1 over the swing
      const sweep = -1.2 + p * 2.4;                       // rotate across the arc
      ctx.strokeStyle = withAlpha(e.color, 0.95 * a + 0.05);
      ctx.lineWidth = 5 * a + 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 19, e.angle + sweep - 0.8, e.angle + sweep + 0.8);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(e.color, 0.4 * a);      // ghost trail
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14, e.angle + sweep - 0.6, e.angle + sweep + 0.6);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }
}

function drawSelected(ctx, state) {
  const t = state.selected;
  if (!t || !t.stats) return;
  // highlight border
  ctx.strokeStyle = C.rangeRing;
  ctx.lineWidth = 2;
  ctx.strokeRect(t.cx * SIZE + 1, t.cy * SIZE + 1, SIZE - 2, SIZE - 2);
  if (t.def.aura) {
    // aura coverage (NOT affected by the shop range boost) + a faint fill
    const r = t.stats.auraRange * SIZE;
    const cx = cellCenterX(t.cx), cy = cellCenterY(t.cy);
    ctx.fillStyle = withAlpha(t.def.color, 0.10 + 0.04 * Math.sin(state.time * 3));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(t.def.color, 0.6);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  // show the boosted range, matching what targeting actually uses
  drawRangeRing(ctx, t.cx, t.cy, t.effectiveRange ? t.effectiveRange(state) : t.stats.range);
}

function drawEnemies(ctx, state, view) {
  for (const e of state.enemies) {
    if (!e.alive) continue;
    // Pad: body radius + bars/outlines; bosses get extra for the name text.
    if (!inV(view, e.x, e.y, e.radius + (e.boss ? 80 : 12))) continue;
    let ey = e.y;
    if (e.flying) {
      // soft shadow on the ground + gentle bob
      ey = e.y + Math.sin(state.time * 3 + e.bob) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.radius + 4, e.radius * 0.8, e.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // healer aura
    if (e.def.healPct && !e.disrupted) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
      ctx.strokeStyle = `rgba(95,206,122,${0.12 + 0.12 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, ey, e.def.healRadius * SIZE * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- animated body ------------------------------------------------------
    // All purely cosmetic, driven by state.time + per-enemy phase (e.bob):
    // walk bob/waddle, horizontal facing, hit squash, spawn pop, siege chomp.
    const slowF = e.slowTimer > 0 ? (1 - e.slowPct) : 1;
    const stepHz = 1.6 * e.speed * slowF;
    const phase = state.time * stepHz * Math.PI * 2 + e.bob * 7;
    const moving = !e.flying && !e.siegeTarget && e.stunTimer <= 0 &&
      (Math.abs(e.targetCenter.x - e.x) > 0.5 || Math.abs(e.targetCenter.y - e.y) > 0.5);

    // facing: remember the last meaningful horizontal direction
    const fdx = e.targetCenter.x - e.x;
    if (Math.abs(fdx) > 0.5) e._face = fdx < 0 ? -1 : 1;

    // spawn pop-in with a slight overshoot
    const age = state.time - (e.spawnedAt || 0);
    const pop = age < 0.25 ? (age / 0.25) * (1.25 - 0.25 * (age / 0.25)) : 1;

    // hit squash + walk bob/tilt + siege lunge
    let sqX = 1, sqY = 1, bobY = 0, tilt = 0, lungeX = 0, lungeY = 0;
    if (e.hitFlash > 0) { const f = e.hitFlash / 0.12; sqX = 1 + 0.22 * f; sqY = 1 - 0.26 * f; }
    if (moving) {
      bobY = -Math.abs(Math.sin(phase)) * Math.min(3, e.radius * 0.28);
      tilt = Math.sin(phase) * 0.09;
    }
    if (e.siegeTarget) {
      const a = Math.atan2(e.siegeTarget.py - ey, e.siegeTarget.px - e.x);
      const l = Math.max(0, Math.sin(state.time * 7 + e.bob)) * 4;
      lungeX = Math.cos(a) * l; lungeY = Math.sin(a) * l;
    }

    const frame = moving ? Math.floor(state.time * stepHz * 4 + e.bob) % 4 : 0;
    const sprite = getSprite('enemy-' + e.type, frame);

    // soft contact shadow grounds the walkers (flyers already cast one)
    if (!e.flying) {
      ctx.fillStyle = 'rgba(60, 42, 20, 0.20)';
      ctx.beginPath();
      ctx.ellipse(e.x, ey + e.radius * 0.85, e.radius * 0.85, e.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(e.x + lungeX, ey + bobY + lungeY);
    if (tilt) ctx.rotate(tilt);
    ctx.scale((e._face || 1) * pop * sqX, pop * sqY);
    if (sprite) {
      const s = e.radius * 2.6;   // sprites carry whitespace; oversize a bit
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      if (e.boss) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.restore();

    // boss name (both modes)
    if (e.boss) {
      ctx.fillStyle = C.text;
      ctx.font = 'bold 11px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.name, e.x, ey - e.radius - 10);
      ctx.textAlign = 'left';
    }

    // shield ring
    if (e.shieldHp > 0) {
      ctx.strokeStyle = 'rgba(120,170,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, ey, e.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // status outlines: slow (cyan) / poison (green) / stun (white dashes)
    if (e.slowTimer > 0) outline(ctx, e.x, ey, e.radius + 1.5, 'rgba(110,200,255,0.9)');
    if (e.poison.length) outline(ctx, e.x, ey, e.radius + 3.5, 'rgba(120,210,90,0.85)');
    if (e.stunTimer > 0) outline(ctx, e.x, ey, e.radius + 5.5, 'rgba(255,255,255,0.7)');

    // hp bar (skip for full-hp tiny swarm to reduce clutter)
    if (e.hp < e.maxHp || e.boss) {
      const bw = Math.max(14, e.radius * 2);
      const bx = e.x - bw / 2, by = ey - e.radius - 7;
      ctx.fillStyle = C.hpBack;
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = e.boss ? '#e24b4a' : C.hpFront;
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
}

function outline(ctx, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFloaters(ctx, state, view) {
  ctx.save();
  ctx.font = 'bold 12px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    if (!inV(view, f.x, f.y, 80)) continue;   // 80: centered text half-width
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function drawFlash(ctx, state) {
  ctx.fillStyle = `rgba(226,75,74,${0.35 * state.flash})`;
  ctx.fillRect(0, 0, worldW(), worldH());
}

function drawHover(ctx, state) {
  if (!state.hover) return;
  const { x, y } = state.hover;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;

  // If a tower is selected for building, colour by legality and show range.
  // Orange = legal but seals the maze — the wave will attack your walls.
  if (state.buildType) {
    const legal = canBuildAt(state, x, y);
    const seals = legal && wouldSealAt(state, x, y);
    ctx.fillStyle = !legal ? C.hoverBad : (seals ? C.hoverSeal : C.hoverOk);
    ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
    const def = CONFIG.TOWERS[state.buildType];
    if (def) drawRangeRing(ctx, x, y, def.range);
  } else if (state.map.type(x, y) === CELL.OPEN && !state.towerGrid[y][x]) {
    ctx.fillStyle = C.hoverOk;
    ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
  }
}

// U21 marquee selection overlay (world space, live while dragging AND while
// the chooser card is up): green = buildable, blue = existing tower (sellable),
// orange = buildable but would seal the maze. wouldSealAt BFS-es per cell, so
// tints recompute only when the covered cell bounds or the tower count change,
// never per frame. (Enemy-underfoot legality can go momentarily stale in the
// tint; batchBuild re-validates every cell at execution.)
const MARQUEE_SELL = 'rgba(47, 143, 199, 0.38)';   // --ui-blue over the board
let marqueeCache = { key: '', tints: [] };
function drawMarquee(ctx, state) {
  const m = state.marquee;
  if (!m) return;
  const cells = marqueeCells(m.ax, m.ay, m.bx, m.by);
  const a = cells[0], b = cells[cells.length - 1];
  const key = `${a.x},${a.y}:${b.x},${b.y}:${state.towers.length}`;
  if (marqueeCache.key !== key) {
    marqueeCache = {
      key,
      tints: cells.map((c) => {
        if (state.towerGrid[c.y][c.x]) return MARQUEE_SELL;
        if (!canBuildAt(state, c.x, c.y)) return null;
        return wouldSealAt(state, c.x, c.y) ? C.hoverSeal : C.hoverOk;
      }),
    };
  }
  for (let i = 0; i < cells.length; i++) {
    const t = marqueeCache.tints[i];
    if (!t) continue;
    ctx.fillStyle = t;
    ctx.fillRect(cells[i].x * SIZE, cells[i].y * SIZE, SIZE, SIZE);
  }
  // thin frame around the whole selection
  const x0 = Math.min(a.x, b.x) * SIZE, y0 = Math.min(a.y, b.y) * SIZE;
  const w = (Math.abs(a.x - b.x) + 1) * SIZE, h = (Math.abs(a.y - b.y) + 1) * SIZE;
  ctx.strokeStyle = C.rangeRing;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 + 0.75, y0 + 0.75, w - 1.5, h - 1.5);
}

// Radial build ring open: highlight the chosen cell (orange when the placement
// would seal the maze — cached at ring-open, not re-BFS'd per frame) and show
// the hovered tower option's range.
function drawMenuCell(ctx, state) {
  if (!state.menuCell) return;
  const { x, y } = state.menuCell;
  ctx.fillStyle = state.menuSeals ? C.hoverSeal : C.hoverOk;
  ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
  ctx.strokeStyle = state.menuSeals ? 'rgba(255,165,0,0.9)' : C.rangeRing;
  ctx.lineWidth = 2;
  ctx.strokeRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);
  if (state.pendingBuild) {
    const def = CONFIG.TOWERS[state.pendingBuild];
    if (def) drawRangeRing(ctx, x, y, def.aura ? def.auraByLevel[0].range : def.range);
  }
}

export function drawRangeRing(ctx, cx, cy, rangeCells) {
  ctx.save();
  ctx.strokeStyle = C.rangeRing;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cellCenterX(cx), cellCenterY(cy), rangeCells * SIZE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Convert a #rrggbb (or existing rgba) colour to an rgba string with alpha.
function withAlpha(color, a) {
  if (color[0] === '#') {
    const n = parseInt(color.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

// ---- shared drawing helpers ----
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
