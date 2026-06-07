// =============================================================================
// render.js — all canvas drawing. Everything is drawn from flat shapes + the
// CONFIG palette so the placeholder art looks intentional, not broken.
//
// This is the single place that reads game state and paints a frame. It never
// mutates state. Phases add more layers (enemies, towers, projectiles, hero,
// effects) but the structure stays: background -> map -> overlays -> entities ->
// effects -> cursor.
// =============================================================================

import { CONFIG, CANVAS_W, CANVAS_H } from '../config.js';
import { CELL, COLS, ROWS, SIZE, cellCenter, cellCenterX, cellCenterY } from '../engine/grid.js';
import { canBuildAt } from '../game/state.js';

const C = CONFIG.COLORS;

export function render(ctx, state) {
  drawBackground(ctx);
  drawMap(ctx, state);
  if (state.showPath) drawPaths(ctx, state);
  drawSpawnGoalMarkers(ctx, state);
  drawTowers(ctx, state);
  drawEnemies(ctx, state);
  drawProjectiles(ctx, state);
  drawEffects(ctx, state);
  drawSelected(ctx, state);
  drawFloaters(ctx, state);
  drawHover(ctx, state);
  if (state.flash > 0) drawFlash(ctx, state);
}

function drawBackground(ctx) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = C.gridLine;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * SIZE + 0.5, 0);
    ctx.lineTo(x * SIZE + 0.5, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * SIZE + 0.5);
    ctx.lineTo(CANVAS_W, y * SIZE + 0.5);
    ctx.stroke();
  }
}

function drawMap(ctx, state) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
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

function drawObstacle(ctx, x, y) {
  const px = x * SIZE, py = y * SIZE, pad = 2, r = 5;
  roundRect(ctx, px + pad, py + pad, SIZE - pad * 2, SIZE - pad * 2, r);
  ctx.fillStyle = C.obstacle;
  ctx.fill();
  // subtle inner highlight
  ctx.fillStyle = C.obstacleHi;
  roundRect(ctx, px + pad + 2, py + pad + 2, SIZE - pad * 2 - 4, (SIZE - pad * 2) / 2.4, 3);
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
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

function drawSpawnGoalMarkers(ctx, state) {
  ctx.save();
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const s of state.map.spawns) {
    const c = cellCenter(s.cx, s.cy);
    // green diamond
    ctx.fillStyle = C.spawn;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 9);
    ctx.lineTo(c.x + 9, c.y);
    ctx.lineTo(c.x, c.y + 9);
    ctx.lineTo(c.x - 9, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0c0e14';
    ctx.fillText(s.id, c.x, c.y + 0.5);
  }

  for (const g of state.map.goals) {
    const c = cellCenter(g.cx, g.cy);
    // red ring
    ctx.strokeStyle = C.goal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.goal;
    ctx.fillText(g.id, c.x, c.y + 0.5);
  }
  ctx.restore();
}

function drawTowers(ctx, state) {
  for (const t of state.towers) {
    const px = t.cx * SIZE, py = t.cy * SIZE;
    const pad = 3, r = 6;
    // base body
    roundRect(ctx, px + pad, py + pad, SIZE - pad * 2, SIZE - pad * 2, r);
    ctx.fillStyle = t.def.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cx = cellCenterX(t.cx), cy = cellCenterY(t.cy);
    // barrel pointing at the last target
    ctx.strokeStyle = '#0c0e14';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(t.angle) * 11, cy + Math.sin(t.angle) * 11);
    ctx.stroke();

    // muzzle flash
    if (t.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(t.angle) * 12, cy + Math.sin(t.angle) * 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // glyph
    ctx.fillStyle = '#0c0e14';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.def.glyph, cx, cy - 1);

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
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function drawProjectiles(ctx, state) {
  for (const p of state.projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.stats.splashRadius > 0 ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects(ctx, state) {
  for (const e of state.effects) {
    const a = Math.max(0, e.life / e.max);
    if (e.kind === 'beam') {
      ctx.strokeStyle = withAlpha(e.color, a);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    } else if (e.kind === 'chain') {
      ctx.strokeStyle = withAlpha(e.color, a);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < e.points.length; i++) {
        const pt = e.points[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    } else if (e.kind === 'splash') {
      ctx.strokeStyle = withAlpha(e.color, a * 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * SIZE * (1 - a * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === 'spark') {
      ctx.fillStyle = withAlpha(e.color, a);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3 * a + 1, 0, Math.PI * 2);
      ctx.fill();
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
  drawRangeRing(ctx, t.cx, t.cy, t.stats.range);
}

function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    if (!e.alive) continue;
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

    // body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, ey, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // boss outline + name
    if (e.boss) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
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

function drawFloaters(ctx, state) {
  ctx.save();
  ctx.font = 'bold 12px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function drawFlash(ctx, state) {
  ctx.fillStyle = `rgba(226,75,74,${0.35 * state.flash})`;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawHover(ctx, state) {
  if (!state.hover) return;
  const { x, y } = state.hover;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;

  // If a tower is selected for building, colour by legality and show range.
  if (state.buildType) {
    const legal = canBuildAt(state, x, y);
    ctx.fillStyle = legal ? C.hoverOk : C.hoverBad;
    ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
    const def = CONFIG.TOWERS[state.buildType];
    if (def) drawRangeRing(ctx, x, y, def.range);
  } else if (state.map.type(x, y) === CELL.OPEN && !state.towerGrid[y][x]) {
    ctx.fillStyle = C.hoverOk;
    ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
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
