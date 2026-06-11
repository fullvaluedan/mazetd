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
import { bfsDistanceField, weightedDistanceField, isReachable, tracePath, fieldAt, UNREACHABLE } from '../engine/pathfinding.js';
import { createMap } from './map.js';

export function createState(rng, seed = 0) {
  const map = createMap(rng);

  // towerGrid[y][x] = tower entity or null. Separate from map cell types so we
  // never lose the underlying terrain when a tower is sold.
  const towerGrid = [];
  for (let y = 0; y < ROWS; y++) towerGrid.push(new Array(COLS).fill(null));

  const state = {
    rng,
    seed,
    map,
    towerGrid,
    time: 0,                 // seconds of sim time (for animations)
    shake: 0,                // screen-shake intensity (juice)
    particles: [],           // transient death particles (juice)

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
    siegeFields: {},         // goalId -> weighted breach field (only while sealed)
    siege: false,            // true while any route is sealed (walls under threat)

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
    buildType: null,         // tower type id chosen to place (legacy armed mode)
    selected: null,          // selected placed tower
    hover: null,             // {x,y} hovered cell
    menuCell: null,          // {x,y} cell with an open radial build ring
    pendingBuild: null,      // tower type hovered inside the build ring
    menuSeals: false,        // cached wouldSealAt(menuCell) (computed on open)
    targetingConsumable: null, // consumable def awaiting a target cell
    targetingConsumableKey: null,
    targetingAbility: null,  // hero ability awaiting a target cell
    targetingAbilityIndex: -1,
    heroMoveMode: false,     // touch flow: tap hero (or Move btn) -> tap a cell

    // modifiers
    frenzyTimer: 0,          // seconds of +damage frenzy remaining

    // shop
    heroUpgrades: { hp: 0, dmg: 0, cooldown: 0, respawn: 0 }, // tiers purchased
    towerBoosts: { dmg: 0, speed: 0, range: 0 },              // global tower tiers
    repairUses: 0,           // for escalating Repair cost
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

// Is a tower allowed on this cell? Must be empty buildable interior with no
// ground enemy standing on it. Sealing the path IS allowed (siege mode) — use
// wouldSealAt() to warn the player before they do it.
export function canBuildAt(state, x, y) {
  if (!inBounds(x, y)) return false;
  if (state.map.type(x, y) !== CELL.OPEN) return false;
  if (state.towerGrid[y][x]) return false;
  // Don't build under a ground enemy (keeps its current cell always valid).
  for (const e of state.enemies) {
    if (!e.alive || e.flying) continue;
    if (e.cx === x && e.cy === y) return false;
  }
  return true;
}

// Would building here cut some spawn off from its goal? Drives the orange
// build-preview warning and keeps the sim's reference build seal-free.
export function wouldSealAt(state, x, y) {
  return !spawnsAllReachGoals(state, makeWalkable(state, x, y));
}

// While a goal is sealed (any spawn or live ground enemy cut off from it),
// publish a weighted breach field for it: open cell = 1, tower cell = big.
// Besieged creeps follow it downhill to the cheapest wall and chew through.
export function recomputeSiegeFields(state) {
  const terrain = (x, y) => {
    if (!inBounds(x, y)) return false;
    const t = state.map.type(x, y);
    return t !== CELL.BORDER && t !== CELL.OBSTACLE;   // towers ARE passable for costing
  };
  const costAt = (x, y) => (state.towerGrid[y][x] ? CONFIG.SIEGE.towerCellCost : 1);
  let any = false;
  for (const g of state.map.goals) {
    const field = state.fields[g.id];
    let sealed = state.map.spawns.some((s) => !isReachable(field, s.cx, s.cy));
    if (!sealed) {
      sealed = state.enemies.some((e) =>
        e.alive && !e.flying && e.goalId === g.id && fieldAt(field, e.cx, e.cy) === UNREACHABLE);
    }
    if (sealed) {
      state.siegeFields[g.id] = weightedDistanceField(terrain, costAt, g.cx, g.cy);
      any = true;
    } else {
      delete state.siegeFields[g.id];
    }
  }
  state.siege = any;
}

// Call whenever a tower is added or removed: refresh fields (+ siege breach
// fields), re-trace overlay paths, and nudge every live enemy onto a fresh
// next-step from the new field.
export function onMazeChanged(state) {
  recomputeFields(state);
  recomputeSiegeFields(state);
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
