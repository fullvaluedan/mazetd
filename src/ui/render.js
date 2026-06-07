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
  drawHover(ctx, state);
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
