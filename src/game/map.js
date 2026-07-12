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
import { bfsDistanceField, bfsDistanceFieldMany, isReachable, fieldAt } from '../engine/pathfinding.js';
import { makeRng } from '../engine/rng.js';

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

// --- U6: seeded-random crystal placement (level.goalZone opt-in) -----------
// A level can opt a goal into a seeded-random position within a row band
// (currently just l1's crystal) instead of a fixed authored cell. The draw
// uses its OWN rng stream, derived from a hash of the run seed + level id,
// never the shared map-build rng, so it stays reproducible per seed without
// depending on how many other rng.next() calls happened first (review
// requirement: decouples placement from unrelated rng consumption order).

const GOAL_ZONE_RETRY_CAP = 40;
const GOAL_ZONE_ROUTE_FLOOR = 14;   // min BFS steps from every spawn to the pad

// Tiny deterministic string hash (FNV-1a) -> 32-bit unsigned int. Good enough
// to seed a throwaway rng stream; not cryptographic, just needs to mix well.
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Same 2x2-pad geometry as state.js's objectiveRect, reimplemented locally:
// map.js builds the grid before a game state (and therefore COLS/ROWS-aware
// state helpers) exists, so goal candidates are validated against the exact
// same pad math the runtime later uses for build-blocking and routing.
function padRectFor(cx, cy) {
  const w = 2, h = 2;
  const x = Math.max(0, Math.min(COLS - w, cx - 1));
  let y = cy - Math.floor(h / 2);
  if (cy === 0) y = 0;
  else if (cy === ROWS - 1) y = ROWS - h - 1;
  y = Math.max(0, Math.min(ROWS - h, y));
  return { x, y, w, h };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Is (cx,cy)'s 2x2 pad a legal, well-routed goal placement on this partially
// built grid (obstacles/spawns/checkpoints already stamped, goal not yet)?
function isValidGoalCandidate(cells, level, cx, cy) {
  const pad = padRectFor(cx, cy);
  const padCells = [];
  for (let py = pad.y; py < pad.y + pad.h; py++) {
    for (let px = pad.x; px < pad.x + pad.w; px++) {
      if (!inBounds(px, py) || cells[py][px] !== CELL.OPEN) return false;
      padCells.push({ x: px, y: py });
    }
  }
  // No overlap with props (decorative, but shouldn't sit under the crystal).
  for (const prop of level.props || []) {
    if (prop.cx >= pad.x && prop.cx < pad.x + pad.w && prop.cy >= pad.y && prop.cy < pad.y + pad.h) return false;
  }
  // No overlap with the player's day-1 starter walls.
  for (const [wx, wy] of level.starterWalls || []) {
    if (wx >= pad.x && wx < pad.x + pad.w && wy >= pad.y && wy < pad.y + pad.h) return false;
  }
  // No overlap with any spawn/goal's own entry pad (mirrors isObjectiveCell).
  for (const marker of [...level.spawns, ...(level.goals || [])]) {
    if (rectsOverlap(pad, padRectFor(marker.cx, marker.cy))) return false;
  }
  // Reachable from every spawn, and not just barely: a route shorter than the
  // floor risks an undefendable straight shot (review requirement).
  const walk = (x, y) => genWalkable(cells, x, y);
  const field = bfsDistanceFieldMany(walk, padCells);
  for (const s of level.spawns) {
    if (fieldAt(field, s.cx, s.cy) < GOAL_ZONE_ROUTE_FLOOR) return false;   // covers UNREACHABLE too
  }
  return true;
}

// Resolve the goal markers to place: the authored list unchanged, unless the
// level opts into goalZone, in which case goals[0]'s (cx,cy) is redrawn from
// a dedicated rng stream and validated against the current grid. Exhausting
// the retry budget falls back to the authored position rather than throwing.
function resolveGoalMarkers(level, seed, cells) {
  if (!level.goalZone) return level.goals;
  const zone = level.goalZone;
  const rng = makeRng(hashSeed(`${seed}:${level.id}:crystal`));
  for (let attempt = 0; attempt < GOAL_ZONE_RETRY_CAP; attempt++) {
    const cx = rng.int(2, COLS - 3);       // column inset: pad never touches x=0/COLS-1
    const cy = rng.int(zone.yMin, zone.yMax);
    if (isValidGoalCandidate(cells, level, cx, cy)) {
      return level.goals.map((g, i) => (i === 0 ? { ...g, cx, cy } : { ...g }));
    }
  }
  return level.goals;
}

// Build a map from an AUTHORED campaign level definition: fixed obstacles,
// spawn/exit openings on the border, checkpoint flags in the interior.
function createAuthoredMap(level, seed = 0) {
  const cells = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const isBorder = (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1);
      row.push(isBorder ? CELL.BORDER : CELL.OPEN);
    }
    cells.push(row);
  }
  for (const [x, y] of level.obstacles || []) {
    if (inBounds(x, y)) cells[y][x] = CELL.OBSTACLE;
  }
  for (const s of level.spawns) cells[s.cy][s.cx] = CELL.SPAWN;
  for (const c of level.checkpoints || []) cells[c.cy][c.cx] = CELL.CHECKPOINT;

  const goals = resolveGoalMarkers(level, seed, cells);
  for (const g of goals) cells[g.cy][g.cx] = CELL.GOAL;

  return {
    cells,
    spawns: level.spawns.map((s) => ({ ...s })),
    goals: goals.map((g) => ({ ...g })),
    checkpoints: (level.checkpoints || []).map((c) => ({ ...c })),
    props: (level.props || []).map((prop) => ({ ...prop })),
    type(x, y) { return inBounds(x, y) ? this.cells[y][x] : CELL.BORDER; },
  };
}

// Create a map. With a level def -> authored layout; without -> the classic
// random-obstacle 28x18 board (Endless-style worlds & the headless sim).
// `seed` (the run seed, not the rng object) only matters for goalZone levels;
// it seeds a dedicated placement rng decoupled from `rng`'s own draw order.
export function createMap(rng, level = null, seed = 0) {
  if (level) return createAuthoredMap(level, seed);

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
    checkpoints: [],
    props: [],
    type(x, y) { return inBounds(x, y) ? this.cells[y][x] : CELL.BORDER; },
  };
}
