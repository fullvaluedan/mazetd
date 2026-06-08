// =============================================================================
// state.js — the single central game-state object + the pathfinding glue that
// keeps enemy routes correct as the maze changes.
//
// Everything the simulation touches hangs off the object returned by
// createState(). The functions here own the "maze changed -> recompute routes"
// flow and the Wintermaul "you may not fully block the path" legality check.
// =============================================================================

import { CONFIG } from '../config.js';
import { CELL, COLS, ROWS, inBounds } from '../engine/grid.js';
import { bfsDistanceField, isReachable, tracePath, fieldAt, UNREACHABLE } from '../engine/pathfinding.js';
import { createMap } from './map.js';

export function createState(rng) {
  const map = createMap(rng);

  // towerGrid[y][x] = tower entity or null. Separate from map cell types so we
  // never lose the underlying terrain when a tower is sold.
  const towerGrid = [];
  for (let y = 0; y < ROWS; y++) towerGrid.push(new Array(COLS).fill(null));

  const state = {
    rng,
    map,
    towerGrid,
    time: 0,                 // seconds of sim time (for animations)

    // entities
    towers: [],
    enemies: [],
    projectiles: [],
    effects: [],             // transient visual effects (rings, sparks, text)
    hero: null,
    floaters: [],            // floating damage/gold numbers

    // pathfinding
    fields: {},              // goalId -> distance field (Float64Array)
    routing: {},             // spawnId -> goalId
    paths: {},               // spawnId -> traced [{x,y}...] (for overlay)

    // economy
    gold: CONFIG.START_GOLD,
    lives: CONFIG.START_LIVES,
    wave: 0,                 // last started wave (0 = none yet)
    maxWave: 0,

    // run status
    status: 'setup',         // 'setup' | 'playing' | 'won' | 'lost'
    waveActive: false,
    spawnQueue: [],          // pending enemy spawns for the active wave
    spawnElapsed: 0,         // seconds since the active wave started spawning
    activeSpawns: [],        // which spawns the current wave uses
    buildTimer: CONFIG.BUILD_TIMER,  // seconds of build time left (early-start bonus)
    autoStart: false,        // auto-chain waves when the build timer expires
    flash: 0,                // red screen-flash intensity (leaks)

    // ui / interaction
    showPath: true,
    buildType: null,         // tower type id chosen to place
    selected: null,          // selected placed tower
    hover: null,             // {x,y} hovered cell
    targetingConsumable: null, // consumable awaiting a target cell
    targetingAbility: null,  // hero ability awaiting a target cell
    targetingAbilityIndex: -1,

    // modifiers
    frenzyTimer: 0,          // seconds of +damage frenzy remaining
  };

  // Default routing: each spawn heads for whichever goal is closest on the
  // obstacle-only layout. Waves can override this per spawn later.
  recomputeFields(state);
  defaultRouting(state);
  recomputePaths(state);
  state.activeSpawns = state.map.spawns.map((s) => s.id);
  return state;
}

// Walkability for enemies/pathfinding: open ground that isn't a wall, obstacle
// or tower. Optionally treat one extra cell (blockX,blockY) as blocked — used by
// the build-legality check without mutating the grid.
export function makeWalkable(state, blockX = -1, blockY = -1) {
  const map = state.map, towerGrid = state.towerGrid;
  return (x, y) => {
    if (!inBounds(x, y)) return false;
    if (x === blockX && y === blockY) return false;
    const t = map.type(x, y);
    if (t === CELL.BORDER || t === CELL.OBSTACLE) return false;
    if (towerGrid[y][x]) return false;
    return true;   // OPEN / SPAWN / GOAL
  };
}

export function recomputeFields(state) {
  const walk = makeWalkable(state);
  for (const g of state.map.goals) {
    state.fields[g.id] = bfsDistanceField(walk, g.cx, g.cy);
  }
}

export function defaultRouting(state) {
  for (const s of state.map.spawns) {
    let bestGoal = state.map.goals[0].id;
    let bestDist = UNREACHABLE;
    for (const g of state.map.goals) {
      const d = fieldAt(state.fields[g.id], s.cx, s.cy);
      if (d < bestDist) { bestDist = d; bestGoal = g.id; }
    }
    state.routing[s.id] = bestGoal;
  }
}

export function recomputePaths(state) {
  for (const s of state.map.spawns) {
    const goalId = state.routing[s.id] || state.map.goals[0].id;
    state.paths[s.id] = tracePath(state.fields[goalId], s.cx, s.cy) || [];
  }
}

// Does every spawn still reach every goal under `walk`? (Connectivity = legal.)
export function spawnsAllReachGoals(state, walk) {
  for (const g of state.map.goals) {
    const field = bfsDistanceField(walk, g.cx, g.cy);
    for (const s of state.map.spawns) {
      if (!isReachable(field, s.cx, s.cy)) return false;
    }
  }
  return true;
}

// Is a tower allowed on this cell? Must be empty buildable interior, with no
// ground enemy standing on it, and must not seal off any spawn from any goal.
export function canBuildAt(state, x, y) {
  if (!inBounds(x, y)) return false;
  if (state.map.type(x, y) !== CELL.OPEN) return false;
  if (state.towerGrid[y][x]) return false;
  // Don't build under a ground enemy (keeps its current cell always valid).
  for (const e of state.enemies) {
    if (!e.alive || e.flying) continue;
    if (e.cx === x && e.cy === y) return false;
  }
  // Path-existence rule: with this cell blocked, all routes must survive.
  return spawnsAllReachGoals(state, makeWalkable(state, x, y));
}

// Call whenever a tower is added or removed: refresh fields, default routing
// stays as set, re-trace overlay paths, and nudge every live enemy onto a fresh
// next-step from the new field.
export function onMazeChanged(state) {
  recomputeFields(state);
  recomputePaths(state);
  for (const e of state.enemies) {
    if (e.alive && !e.flying && typeof e.reroute === 'function') e.reroute(state);
  }
  if (state.hero && typeof state.hero.onMazeChanged === 'function') state.hero.onMazeChanged(state);
}

// Distance from a cell to a goal's exit (used by enemy stepping).
export function distanceToGoal(state, goalId, x, y) {
  return fieldAt(state.fields[goalId], x, y);
}
