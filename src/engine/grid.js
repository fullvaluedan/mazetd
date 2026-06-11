// =============================================================================
// grid.js — the cell grid coordinate system + cell-type constants.
//
// Pure geometry/helpers only (no game state). The map's actual cell array lives
// in map.js; this module just knows how to convert between pixels and cells and
// what the cell-type numbers mean.
// =============================================================================

import { CONFIG } from '../config.js';

// Cell types stored in the map grid.
export const CELL = {
  OPEN: 0,      // buildable interior
  BORDER: 1,    // non-buildable frame wall (not walkable)
  OBSTACLE: 2,  // permanent blocked rock/water (not walkable, not buildable)
  SPAWN: 3,     // enemy entry opening (walkable, not buildable)
  GOAL: 4,      // enemy exit opening (walkable, not buildable)
  CHECKPOINT: 5,// Gem-TD flag: walkable waypoint creeps must visit (not buildable)
};

// Grid dimensions are PER-LEVEL since the campaign rebuild. These are mutable
// `let` exports — ES module live bindings mean every importer always sees the
// current values. setGridSize() must be called BEFORE createState() for a
// level; the default stays the classic 28x18 so the headless sim/tests are
// untouched. SIZE (px per cell) never changes.
export let COLS = CONFIG.GRID_COLS;
export let ROWS = CONFIG.GRID_ROWS;
export const SIZE = CONFIG.CELL;   // pixel size of a cell

export function setGridSize(cols, rows) {
  COLS = cols;
  ROWS = rows;
}
export function worldW() { return COLS * SIZE; }
export function worldH() { return ROWS * SIZE; }

// 4-directional neighbour offsets (no diagonals — avoids cutting tower corners).
export const NEIGHBORS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

// Pixel center of a cell (used to position entities and draw).
export function cellCenter(x, y) {
  return { x: x * SIZE + SIZE / 2, y: y * SIZE + SIZE / 2 };
}

// Pixel center as separate values (avoids object allocation in hot loops).
export function cellCenterX(x) { return x * SIZE + SIZE / 2; }
export function cellCenterY(y) { return y * SIZE + SIZE / 2; }

// Which cell does a pixel coordinate fall in?
export function worldToCell(px, py) {
  return { x: Math.floor(px / SIZE), y: Math.floor(py / SIZE) };
}

// A stable integer key for a cell, handy for Sets/Maps.
export function cellKey(x, y) { return y * COLS + x; }

// Euclidean distance between two cells (in cell units) — used for tower range.
export function cellDist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
