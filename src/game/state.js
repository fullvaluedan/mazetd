// =============================================================================
// state.js — the single central game-state object + the pathfinding glue that
// keeps enemy routes correct as the maze changes.
//
// Everything the simulation touches hangs off the object returned by
// createState(). The functions here own the "maze changed -> recompute routes"
// flow and the Wintermaul "you may not fully block the path" legality check.
// =============================================================================

import { CONFIG, difficultyModeStats, normalizeDifficultyMode } from '../config.js';
import { CELL, COLS, ROWS, inBounds } from '../engine/grid.js';
import { bfsDistanceField, bfsDistanceFieldMany, weightedDistanceField, isReachable, tracePath, fieldAt, UNREACHABLE } from '../engine/pathfinding.js';
import { createMap } from './map.js';

// level (optional): an authored campaign level def (see levels.js). Without
// one you get the classic random 28x18 board (Endless-style + headless sim).
// NOTE: callers must setGridSize(level.cols, level.rows) BEFORE this.
export function createState(rng, seed = 0, level = null, options = {}) {
  const difficultyMode = normalizeDifficultyMode(options?.difficultyMode);
  const balance = difficultyModeStats(difficultyMode);
  const map = createMap(rng, level);

  // towerGrid[y][x] = tower entity or null. Separate from map cell types so we
  // never lose the underlying terrain when a tower is sold.
  const towerGrid = [];
  for (let y = 0; y < ROWS; y++) towerGrid.push(new Array(COLS).fill(null));

  const state = {
    rng,
    seed,
    level,                   // campaign level def or null (classic board)
    map,
    towerGrid,
    time: 0,                 // seconds of sim time (for animations)
    shake: 0,                // screen-shake intensity (juice)
    particles: [],           // transient death particles (juice)
    events: [],              // plain-data sound/feedback events, drained by the UI

    // entities
    towers: [],
    enemies: [],
    defeatedEnemies: [],    // render-only defeat snapshots; never participate in simulation
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
    difficultyMode,
    gold: Math.round((level && level.startGold != null ? level.startGold : CONFIG.START_GOLD) * balance.goldMult),
    lives: level && level.lives != null ? level.lives : CONFIG.START_LIVES,
    wave: 0,                 // last started wave (0 = none yet)
    maxWave: 0,

    // run status
    status: 'setup',         // 'setup' | 'playing' | 'won' | 'lost'
    waveActive: false,
    spawnQueue: [],          // pending enemy spawns for the active wave
    spawnElapsed: 0,         // seconds since the active wave started spawning
    activeSpawns: [],        // which spawns the current wave uses
    buildTimer: CONFIG.BUILD_TIMER,  // seconds of build time left (early-start bonus)
    autoStart: !(level && level.mazeMode),   // waves auto-chain when the build timer
                             // expires (user 2026-07-06: mobile default; NEXT WAVE =
                             // call early for bonus gold). OFF in Maze Mode: its single
                             // wave is released manually and must never auto-stack.
    nextWaveCooldown: 0,     // seconds until the next wave can be called (waves may now
                             // stack on the field while this is 0 — user 2026-07-07)
    mazeTimer: 0,            // Maze Mode: seconds the horde has been contained (the score)
    flash: 0,                // red screen-flash intensity (leaks)
    crystalBreakUntil: 0,    // render-only leak reaction; never affects routing

    // ui / interaction
    showPath: true,
    buildType: null,         // tower type id chosen to place (legacy armed mode)
    selected: null,          // selected placed tower
    hover: null,             // {x,y} hovered cell
    menuCell: null,          // {x,y} cell with an open radial build ring
    marquee: null,           // {ax,ay,bx,by} world-px multi-select rect (U21; UI-owned)
    pendingBuild: null,      // tower type hovered inside the build ring
    menuSeals: false,        // cached wouldSealAt(menuCell) (computed on open)
    targetingConsumable: null, // consumable def awaiting a target cell
    targetingConsumableKey: null,
    targetingAbility: null,  // hero ability awaiting a target cell
    targetingAbilityIndex: -1,
    heroSelected: false,     // KR control: hero selected -> taps on ground move it

    // modifiers
    frenzyTimer: 0,          // seconds of +damage frenzy remaining

    // shop
    heroUpgrades: { hp: 0, dmg: 0, cooldown: 0, respawn: 0 }, // tiers purchased
    towerBoosts: { dmg: 0, speed: 0, range: 0 },              // global tower tiers
    repairUses: 0,           // for escalating Repair cost

    // rewarded ads (UI grants only — the sim never reads these)
    adFreeGoldWave: -999,    // wave at the last FREE GOLD grant (wave-gate)
    reviveUsed: false,       // defeat revive is once per run
  };

  // Default routing: each spawn heads for whichever goal is closest on the
  // obstacle-only layout. Waves can override this per spawn later.
  recomputeFields(state);
  defaultRouting(state);
  recomputePaths(state);
  state.activeSpawns = state.map.spawns.map((s) => s.id);
  return state;
}

export function footprintFor(typeId) {
  const def = CONFIG.TOWERS[typeId];
  return def && def.footprint ? def.footprint : (def && !def.wall ? { w: 2, h: 2 } : { w: 1, h: 1 });
}

export function footprintCells(typeId, x, y) {
  const { w, h } = footprintFor(typeId);
  const cells = [];
  for (let cy = y; cy < y + h; cy++) for (let cx = x; cx < x + w; cx++) cells.push({ x: cx, y: cy });
  return cells;
}

// Objective rectangles are grid data, shared by build validation and rendering.
// Objectives use matching 2x2 pads. Their center mouths remain the existing
// path target/spawn so routing stays independent from presentation art.
export function objectiveRect(state, marker) {
  const isGoal = state.map.goals.includes(marker);
  const w = 2, h = 2;
  const x = Math.max(0, Math.min(COLS - w, marker.cx - 1));
  let y = marker.cy - Math.floor(h / 2);
  if (marker.cy === 0) y = 0;
  // Goals sit one cell inside the frame so every objective cell can be reached
  // from any direction; border cells remain frame-only and never become exits.
  else if (marker.cy === ROWS - 1) y = ROWS - h - 1;
  y = Math.max(0, Math.min(ROWS - h, y));
  return { x, y, w, h, isGoal };
}

export function isObjectiveCell(state, x, y) {
  for (const marker of [...state.map.spawns, ...state.map.goals]) {
    const rect = objectiveRect(state, marker);
    if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) return true;
  }
  return false;
}

// Walkability for enemies/pathfinding: open ground that isn't a wall, obstacle
// or tower. Extra prospective footprint cells are blocked atomically for build
// legality without mutating the grid.
export function makeWalkable(state, blockedCells = null) {
  const map = state.map, towerGrid = state.towerGrid;
  const blocked = blockedCells ? new Set(blockedCells.map((c) => `${c.x},${c.y}`)) : null;
  return (x, y) => {
    if (!inBounds(x, y)) return false;
    if (blocked && blocked.has(`${x},${y}`)) return false;
    const t = map.type(x, y);
    if (t === CELL.BORDER || t === CELL.OBSTACLE) return false;
    if (towerGrid[y][x]) return false;
    return true;   // OPEN / SPAWN / GOAL
  };
}

// All routing targets on this map: checkpoint flags (visited in order) plus
// the exit goals. Fields are keyed by target id ('CP1', 'G1', ...).
export function routeTargets(state) {
  return [...(state.map.checkpoints || []), ...state.map.goals];
}

// The ordered chain of target ids an enemy from `spawnId` must visit:
// every checkpoint in order, then its assigned goal.
export function routeFor(state, spawnId) {
  const cps = (state.map.checkpoints || []).map((c) => c.id);
  const goalId = state.routing[spawnId] || state.map.goals[0].id;
  return [...cps, goalId];
}

export function targetCell(state, key) {
  const t = routeTargets(state).find((c) => c.id === key);
  return t ? { x: t.cx, y: t.cy } : null;
}

export function targetCells(state, key) {
  const target = routeTargets(state).find((entry) => entry.id === key);
  if (!target) return [];
  if (!state.map.goals.includes(target)) return [{ x: target.cx, y: target.cy }];
  const rect = objectiveRect(state, target);
  const cells = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) cells.push({ x, y });
  return cells;
}

function targetField(state, target, walk) {
  const cells = targetCells(state, target.id);
  return cells.length === 1
    ? bfsDistanceField(walk, cells[0].x, cells[0].y)
    : bfsDistanceFieldMany(walk, cells);
}

export function recomputeFields(state) {
  const walk = makeWalkable(state);
  for (const t of routeTargets(state)) {
    state.fields[t.id] = targetField(state, t, walk);
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

// Overlay path per spawn: concatenate the per-stage traces so the dotted line
// shows the FULL journey (spawn -> CP1 -> CP2 -> ... -> exit).
export function recomputePaths(state) {
  for (const s of state.map.spawns) {
    const route = routeFor(state, s.id);
    let full = [];
    let from = { x: s.cx, y: s.cy };
    for (const key of route) {
      const seg = tracePath(state.fields[key], from.x, from.y);
      if (!seg) { full = full.length ? full : []; break; }
      full = full.length ? full.concat(seg.slice(1)) : seg;
      from = targetCell(state, key) || from;
    }
    state.paths[s.id] = full;
  }
}

// Does the whole waypoint CHAIN stay connected under `walk`? Every spawn must
// reach the first target, each checkpoint the next, and the last checkpoint
// every goal. (No checkpoints -> the classic "every spawn reaches every goal".)
export function spawnsAllReachGoals(state, walk) {
  const cps = state.map.checkpoints || [];
  const firsts = cps.length ? [cps[0]] : state.map.goals;
  for (const f of firsts) {
      const field = targetField(state, f, walk);
    for (const s of state.map.spawns) {
      if (!isReachable(field, s.cx, s.cy)) return false;
    }
  }
  for (let i = 0; i < cps.length; i++) {
    const prev = cps[i];
    const nexts = (i + 1 < cps.length) ? [cps[i + 1]] : state.map.goals;
    for (const n of nexts) {
      const field = targetField(state, n, walk);
      if (!isReachable(field, prev.cx, prev.cy)) return false;
    }
  }
  return true;
}

// Is a tower allowed on this cell? Must be empty buildable interior with no
// ground enemy standing on it. Sealing the path IS allowed (siege mode) — use
// wouldSealAt() to warn the player before they do it.
export function canBuildAt(state, x, y, typeId = 'wall') {
  for (const cell of footprintCells(typeId, x, y)) {
    if (!inBounds(cell.x, cell.y) || isObjectiveCell(state, cell.x, cell.y) || state.map.type(cell.x, cell.y) !== CELL.OPEN || state.towerGrid[cell.y][cell.x]) return false;
    // Don't build under a ground enemy (keeps its current cell always valid).
    for (const e of state.enemies) {
      if (!e.alive || e.flying) continue;
      if (e.cx === cell.x && e.cy === cell.y) return false;
    }
  }
  return true;
}

// Would building here cut some spawn off from its goal? Drives the orange
// build-preview warning and keeps the sim's reference build seal-free.
export function wouldSealAt(state, x, y, typeId = 'wall') {
  if (!canBuildAt(state, x, y, typeId)) return false;
  return !spawnsAllReachGoals(state, makeWalkable(state, footprintCells(typeId, x, y)));
}

// While any route STAGE is sealed (its feeders can't reach its target),
// publish a weighted breach field for that target: open cell = 1, tower = big.
// Besieged creeps follow it downhill to the cheapest wall and chew through.
export function recomputeSiegeFields(state) {
  const terrain = (x, y) => {
    if (!inBounds(x, y)) return false;
    const t = state.map.type(x, y);
    return t !== CELL.BORDER && t !== CELL.OBSTACLE;   // towers ARE passable for costing
  };
  const costAt = (x, y) => (state.towerGrid[y][x] ? CONFIG.SIEGE.towerCellCost : 1);
  const cps = state.map.checkpoints || [];
  let any = false;

  for (const t of routeTargets(state)) {
    const field = state.fields[t.id];
    // feeders: spawn mouths for the first stage, the previous flag otherwise
    const isCp = t.id.startsWith('CP');
    const cpIndex = isCp ? cps.findIndex((c) => c.id === t.id) : -1;
    const feeders = (cpIndex > 0) ? [cps[cpIndex - 1]]
      : (isCp || cps.length === 0) ? state.map.spawns
      : [cps[cps.length - 1]];                       // goals fed by the last flag
    let sealed = feeders.some((f) => !isReachable(field, f.cx, f.cy));
    if (!sealed) {
      sealed = state.enemies.some((e) =>
        e.alive && !e.flying && e.route && e.route[e.stage] === t.id &&
        fieldAt(field, e.cx, e.cy) === UNREACHABLE);
    }
    if (sealed) {
      state.siegeFields[t.id] = weightedDistanceField(terrain, costAt, t.cx, t.cy);
      any = true;
    } else {
      delete state.siegeFields[t.id];
    }
  }
  state.siege = any;
}

// U4: monotonic maze-revision counter. Bumped by onMazeChanged — the exact
// set of events that can change the board (build/sell/snapshot-load) — so the
// renderer can invalidate its static map-layer cache with one integer compare
// per frame instead of hooking anything. Module-local by design: it is never
// written onto the state object, and game logic never reads it, so headless
// sims stay byte-identical.
let mapRev = 1;
export function getMapRev() { return mapRev; }

// Call whenever a tower is added or removed: refresh fields (+ siege breach
// fields), re-trace overlay paths, and nudge every live enemy onto a fresh
// next-step from the new field.
export function onMazeChanged(state) {
  mapRev++;
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

// Cosmetic event queue (sounds, future haptics). Plain data, capped so
// headless runs (which never drain it) stay bounded; the sim never reads it.
const EVENT_CAP = 64;
export function pushEvent(state, t, d) {
  if (!state.events || state.events.length >= EVENT_CAP) return;
  state.events.push({ t, d });
}
