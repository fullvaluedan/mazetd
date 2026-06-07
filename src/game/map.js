// =============================================================================
// map.js — builds the playfield: border frame, spawn/goal openings, and a
// seeded scatter of permanent obstacles.
//
// Key guarantee: after obstacles are placed, EVERY spawn can still reach EVERY
// goal. If a random layout would trap a spawn, we throw the obstacles away and
// try again (then, as a last resort, thin them out). This keeps each run's maze
// slightly different without ever generating an impossible map.
// =============================================================================

import { CONFIG } from '../config.js';
import { CELL, COLS, ROWS, inBounds, NEIGHBORS4 } from '../engine/grid.js';
import { bfsDistanceField, isReachable } from '../engine/pathfinding.js';

// Build an empty grid: border ring + open interior + spawn/goal openings.
function blankGrid() {
  const cells = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const isBorder = (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1);
      row.push(isBorder ? CELL.BORDER : CELL.OPEN);
    }
    cells.push(row);
  }
  for (const s of CONFIG.SPAWNS) cells[s.cy][s.cx] = CELL.SPAWN;
  for (const g of CONFIG.GOALS) cells[g.cy][g.cx] = CELL.GOAL;
  return cells;
}

// The interior cell directly adjacent to an opening — we never block these so an
// entry/exit is never sealed at the source (reduces regeneration churn).
function reservedEntries() {
  const reserved = new Set();
  const mark = (cx, cy) => {
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = cx + dx, ny = cy + dy;
      if (inBounds(nx, ny)) reserved.add(ny * COLS + nx);
    }
  };
  for (const s of CONFIG.SPAWNS) mark(s.cx, s.cy);
  for (const g of CONFIG.GOALS) mark(g.cx, g.cy);
  return reserved;
}

// Walkable for *map generation* (no towers exist yet): anything that isn't a
// border wall or an obstacle.
function genWalkable(cells, x, y) {
  if (!inBounds(x, y)) return false;
  const t = cells[y][x];
  return t !== CELL.BORDER && t !== CELL.OBSTACLE;
}

// Are all spawns able to reach all goals on this layout?
function allConnected(cells) {
  for (const g of CONFIG.GOALS) {
    const field = bfsDistanceField((x, y) => genWalkable(cells, x, y), g.cx, g.cy);
    for (const s of CONFIG.SPAWNS) {
      if (!isReachable(field, s.cx, s.cy)) return false;
    }
  }
  return true;
}

// Scatter `nClusters` obstacle blobs of 1..3 cells into the interior.
function scatterObstacles(cells, rng, nClusters, reserved) {
  for (let c = 0; c < nClusters; c++) {
    // Pick a random interior seed cell that's open and not reserved.
    let sx, sy, tries = 0;
    do {
      sx = rng.int(2, COLS - 3);
      sy = rng.int(2, ROWS - 3);
      tries++;
    } while ((cells[sy][sx] !== CELL.OPEN || reserved.has(sy * COLS + sx)) && tries < 40);
    if (tries >= 40) continue;

    const size = rng.int(CONFIG.OBSTACLE_CLUSTER_CELLS_MIN, CONFIG.OBSTACLE_CLUSTER_CELLS_MAX);
    let cx = sx, cy = sy;
    for (let i = 0; i < size; i++) {
      if (cells[cy][cx] === CELL.OPEN && !reserved.has(cy * COLS + cx)) {
        cells[cy][cx] = CELL.OBSTACLE;
      }
      // Grow the blob to a random adjacent interior cell.
      const dir = rng.pick(NEIGHBORS4);
      const nx = cx + dir[0], ny = cy + dir[1];
      if (inBounds(nx, ny) && cells[ny][nx] === CELL.OPEN) { cx = nx; cy = ny; }
    }
  }
}

// Create a map. Retries obstacle layouts until connectivity holds.
export function createMap(rng) {
  const reserved = reservedEntries();
  let cells = null;
  let nClusters = rng.int(CONFIG.OBSTACLE_CLUSTERS_MIN, CONFIG.OBSTACLE_CLUSTERS_MAX);

  for (let attempt = 0; attempt < 60; attempt++) {
    cells = blankGrid();
    scatterObstacles(cells, rng, nClusters, reserved);
    if (allConnected(cells)) break;
    // Every few failed attempts, ease off on obstacle count.
    if (attempt > 0 && attempt % 12 === 0 && nClusters > CONFIG.OBSTACLE_CLUSTERS_MIN) {
      nClusters--;
    }
    if (attempt === 59) {
      // Final fallback: a guaranteed-clear interior (no obstacles).
      cells = blankGrid();
    }
  }

  return {
    cells,
    spawns: CONFIG.SPAWNS.map((s) => ({ ...s })),
    goals: CONFIG.GOALS.map((g) => ({ ...g })),
    type(x, y) { return inBounds(x, y) ? this.cells[y][x] : CELL.BORDER; },
  };
}
