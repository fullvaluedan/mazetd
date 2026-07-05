// =============================================================================
// levels.js — the campaign: 20 hand-authored portrait maps that grow from a
// tiny 7x9 "learn to maze" board to large multi-spawn checkpoint runs, plus
// the tall Endless map.
//
// Design rules (see CAMPAIGN_PLAN.md):
//   - Level 1 teaches pure mazing: 1 spawn (top-left) -> 1 exit (bottom-right),
//     walls + Cannon only.
//   - Checkpoint flags (Gem TD style) appear from level 4: creeps must visit
//     them IN ORDER, shortest path between each — one maze, walked many times.
//   - Maps are authored (fixed obstacles), so every player sees the same
//     puzzle; the classic random-obstacle map remains for Endless/sim.
//   - Tower unlocks are tied to campaign progress (UNLOCK_SCHEDULE below):
//     Cannon (L1), Magic (L3), Falcon (L7). The roster is intentionally small.
// =============================================================================

import { CONFIG } from '../config.js';

// Which towers a player has at a given campaign level (1-based, cumulative).
// The roster starts tiny on purpose: Cannon (land), Magic (slow, land+air),
// Falcon (air only) — more towers join the pool in later content drops.
export const UNLOCK_SCHEDULE = [
  { level: 1, tower: 'wall' },
  { level: 1, tower: 'cannon' },
  { level: 3, tower: 'magic' },
  { level: 7, tower: 'falcon' },   // one level before the first flying wave
];

export function towersUnlockedAt(levelNum) {
  return UNLOCK_SCHEDULE.filter((u) => u.level <= levelNum).map((u) => u.tower);
}
export function unlockLevelFor(towerId) {
  const u = UNLOCK_SCHEDULE.find((s) => s.tower === towerId);
  return u ? u.level : 1;
}

// --- compact level builder ----------------------------------------------------
// waves: { count, types (intro order), swarmFrom?, flyerFrom?, bossWaves?[],
//          hpMult (difficulty vs the global curve), countMult? }
function L(num, name, def) {
  return {
    num, id: 'l' + num, name,
    cols: def.cols, rows: def.rows,
    spawns: def.spawns,
    goals: def.goals,
    checkpoints: def.checkpoints || [],
    obstacles: def.obstacles || [],
    startGold: def.startGold,
    lives: def.lives != null ? def.lives : 10,
    waves: def.waves,
    stars: def.stars || [9, 6],          // lives kept for 3* / 2* (win = 1*)
    endless: false,
  };
}

// Obstacle helpers: rect block + single cells.
function rect(x0, y0, x1, y1) {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}

// ----------------------------------------------------------------------------
// THE CAMPAIGN
// Spawns sit on the top border, exits on the bottom (portrait flow); flags
// are interior cells (walkable, never buildable).
// ----------------------------------------------------------------------------
export const LEVELS = [
  // -- Act 1: learn to maze ---------------------------------------------------
  // Level 1 is HALF the old size: one spawn top-left, one exit bottom-right,
  // diagonal corners — the shortest path is a straight diagonal walk unless
  // you bend it. Pure mazing tutorial.
  L(1, 'First Steps', {
    cols: 7, rows: 9,
    spawns: [{ id: 'S1', cx: 1, cy: 0 }],
    goals: [{ id: 'G1', cx: 5, cy: 8 }],
    startGold: 100,
    waves: { count: 8, types: ['normal'], hpMult: 2.5, bountyMult: 0.3, waveclearMult: 0.15 },
    stars: [10, 7],
  }),
  L(2, 'The Bend', {
    cols: 9, rows: 14,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }],
    goals: [{ id: 'G1', cx: 6, cy: 13 }],
    obstacles: rect(4, 6, 6, 7),
    startGold: 180,
    waves: { count: 10, types: ['normal', 'fast'], hpMult: 3.0, bountyMult: 0.35, waveclearMult: 0.2 },
  }),
  L(3, 'A Touch of Magic', {                    // unlock: magic tower
    cols: 10, rows: 14,
    spawns: [{ id: 'S1', cx: 5, cy: 0 }],
    goals: [{ id: 'G1', cx: 5, cy: 13 }],
    startGold: 200,
    waves: { count: 10, types: ['normal', 'fast', 'swarm'], swarmFrom: 4, hpMult: 3.5, bountyMult: 0.28, waveclearMult: 0.2 },
  }),
  L(4, 'The First Flag', {                      // checkpoints introduced
    cols: 10, rows: 15,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }],
    goals: [{ id: 'G1', cx: 2, cy: 14 }],
    checkpoints: [{ id: 'CP1', cx: 7, cy: 7 }],
    startGold: 310,
    waves: { count: 11, types: ['normal', 'fast', 'swarm'], swarmFrom: 5, hpMult: 0.85 },
  }),
  L(5, 'Cold Snap', {
    cols: 11, rows: 15,
    spawns: [{ id: 'S1', cx: 5, cy: 0 }],
    goals: [{ id: 'G1', cx: 5, cy: 14 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 7 }, { id: 'CP2', cx: 8, cy: 7 }],
    startGold: 340,
    waves: { count: 12, types: ['normal', 'fast', 'swarm', 'tank'], swarmFrom: 4, hpMult: 1 },
  }),
  L(6, 'Broken Ground', {
    cols: 11, rows: 16,
    spawns: [{ id: 'S1', cx: 8, cy: 0 }],
    goals: [{ id: 'G1', cx: 2, cy: 15 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 5 }, { id: 'CP2', cx: 8, cy: 11 }],
    obstacles: [...rect(5, 7, 6, 8), [3, 11], [4, 11]],
    startGold: 360,
    waves: { count: 12, types: ['normal', 'fast', 'swarm', 'tank'], swarmFrom: 4, hpMult: 1.2 },
  }),
  // -- Act 2: the sky and the siege -------------------------------------------
  L(7, "The Falcon's Watch", {                  // unlock: falcon (flyers next level)
    cols: 11, rows: 17,
    spawns: [{ id: 'S1', cx: 5, cy: 0 }],
    goals: [{ id: 'G1', cx: 5, cy: 16 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 8 }, { id: 'CP2', cx: 8, cy: 8 }],
    startGold: 410,
    waves: { count: 13, types: ['normal', 'fast', 'swarm', 'tank', 'healer'], swarmFrom: 4, hpMult: 1.4 },
  }),
  L(8, 'Wings Overhead', {                      // flyers introduced
    cols: 12, rows: 17,
    spawns: [{ id: 'S1', cx: 6, cy: 0 }],
    goals: [{ id: 'G1', cx: 6, cy: 16 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 8 }, { id: 'CP2', cx: 9, cy: 8 }],
    startGold: 450,
    waves: { count: 13, types: ['normal', 'fast', 'swarm', 'tank', 'flyer'], swarmFrom: 4, flyerFrom: 6, hpMult: 1.9 },
  }),
  L(9, 'Verdant Garden', {
    cols: 12, rows: 18,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }],
    goals: [{ id: 'G1', cx: 9, cy: 17 }],
    checkpoints: [{ id: 'CP1', cx: 9, cy: 6 }, { id: 'CP2', cx: 2, cy: 12 }],
    obstacles: rect(5, 8, 7, 9),
    startGold: 480,
    waves: { count: 14, types: ['normal', 'fast', 'swarm', 'tank', 'healer', 'flyer'], swarmFrom: 4, flyerFrom: 7, hpMult: 2.3 },
  }),
  L(10, 'The Wardens', {                        // first boss; Endless unlocks after
    cols: 12, rows: 18,
    spawns: [{ id: 'S1', cx: 6, cy: 0 }],
    goals: [{ id: 'G1', cx: 6, cy: 17 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 6 }, { id: 'CP2', cx: 9, cy: 12 }],
    startGold: 530,
    waves: { count: 15, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'flyer'], swarmFrom: 4, flyerFrom: 7, bossWaves: [15], hpMult: 2.6 },
  }),
  // -- Act 3: the long roads ---------------------------------------------------
  L(11, 'The Long Descent', {
    cols: 12, rows: 19,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }],
    goals: [{ id: 'G1', cx: 8, cy: 18 }],
    checkpoints: [{ id: 'CP1', cx: 8, cy: 6 }, { id: 'CP2', cx: 3, cy: 12 }],
    startGold: 560,
    waves: { count: 15, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 4, flyerFrom: 6, hpMult: 2.6 },
  }),
  L(12, 'Two Roads', {                          // second spawn introduced
    cols: 13, rows: 19,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }, { id: 'S2', cx: 9, cy: 0 }],
    goals: [{ id: 'G1', cx: 6, cy: 18 }],
    checkpoints: [{ id: 'CP1', cx: 6, cy: 9 }],
    startGold: 620,
    waves: { count: 15, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'flyer'], swarmFrom: 4, flyerFrom: 7, hpMult: 2.9 },
  }),
  L(13, 'Storm Warning', {
    cols: 13, rows: 20,
    spawns: [{ id: 'S1', cx: 6, cy: 0 }],
    goals: [{ id: 'G1', cx: 6, cy: 19 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 7 }, { id: 'CP2', cx: 10, cy: 13 }],
    startGold: 660,
    waves: { count: 16, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 4, flyerFrom: 6, bossWaves: [16], hpMult: 3.2 },
  }),
  L(14, 'The Gauntlet', {
    cols: 13, rows: 20,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }, { id: 'S2', cx: 10, cy: 0 }],
    goals: [{ id: 'G1', cx: 6, cy: 19 }],
    checkpoints: [{ id: 'CP1', cx: 6, cy: 6 }, { id: 'CP2', cx: 2, cy: 13 }, { id: 'CP3', cx: 10, cy: 13 }],
    obstacles: rect(6, 12, 6, 14),
    startGold: 700,
    waves: { count: 16, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 6, hpMult: 3.5 },
  }),
  L(15, 'Heart of the Maze', {
    cols: 13, rows: 21,
    spawns: [{ id: 'S1', cx: 6, cy: 0 }],
    goals: [{ id: 'G1', cx: 6, cy: 20 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 5 }, { id: 'CP2', cx: 10, cy: 10 }, { id: 'CP3', cx: 2, cy: 15 }],
    startGold: 760,
    waves: { count: 17, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 5, bossWaves: [17], hpMult: 3.9 },
  }),
  // -- Act 4: mastery -----------------------------------------------------------
  L(16, 'Crosswinds', {
    cols: 14, rows: 21,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }, { id: 'S2', cx: 10, cy: 0 }],
    goals: [{ id: 'G1', cx: 3, cy: 20 }, { id: 'G2', cx: 10, cy: 20 }],
    checkpoints: [{ id: 'CP1', cx: 7, cy: 10 }],
    startGold: 810,
    waves: { count: 17, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 5, hpMult: 4.2 },
  }),
  L(17, 'The Long March', {
    cols: 14, rows: 22,
    spawns: [{ id: 'S1', cx: 7, cy: 0 }],
    goals: [{ id: 'G1', cx: 7, cy: 21 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 6 }, { id: 'CP2', cx: 11, cy: 11 }, { id: 'CP3', cx: 2, cy: 16 }],
    obstacles: [...rect(6, 10, 8, 11)],
    startGold: 870,
    waves: { count: 18, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 5, bossWaves: [18], hpMult: 4.1 },
  }),
  L(18, 'Siegebreakers', {
    cols: 14, rows: 22,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }, { id: 'S2', cx: 11, cy: 0 }],
    goals: [{ id: 'G1', cx: 7, cy: 21 }],
    checkpoints: [{ id: 'CP1', cx: 7, cy: 7 }, { id: 'CP2', cx: 7, cy: 14 }],
    startGold: 920,
    waves: { count: 18, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 5, bossWaves: [12, 18], hpMult: 4.2 },
  }),
  L(19, 'Threefold Path', {
    cols: 14, rows: 22,
    spawns: [{ id: 'S1', cx: 7, cy: 0 }],
    goals: [{ id: 'G1', cx: 7, cy: 21 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 5 }, { id: 'CP2', cx: 11, cy: 9 }, { id: 'CP3', cx: 2, cy: 13 }, { id: 'CP4', cx: 11, cy: 17 }],
    startGold: 980,
    waves: { count: 19, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 4, bossWaves: [19], hpMult: 4.4 },
  }),
  L(20, 'The Demon King', {
    cols: 14, rows: 22,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }, { id: 'S2', cx: 11, cy: 0 }],
    goals: [{ id: 'G1', cx: 7, cy: 21 }],
    checkpoints: [{ id: 'CP1', cx: 7, cy: 6 }, { id: 'CP2', cx: 2, cy: 12 }, { id: 'CP3', cx: 11, cy: 16 }],
    startGold: 1060,
    waves: { count: 20, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 4, bossWaves: [10, 20], hpMult: 4.2 },
    stars: [8, 5],
  }),
];

// Endless: a tall portrait map on the classic procedural 1–100 wave engine.
export const ENDLESS_LEVEL = {
  num: 99, id: 'endless', name: 'Endless Depths',
  cols: 13, rows: 24,
  spawns: [{ id: 'S1', cx: 3, cy: 0 }, { id: 'S2', cx: 9, cy: 0 }],
  goals: [{ id: 'G1', cx: 6, cy: 23 }],
  checkpoints: [{ id: 'CP1', cx: 2, cy: 8 }, { id: 'CP2', cx: 10, cy: 15 }],
  obstacles: [],
  startGold: CONFIG.START_GOLD,
  lives: CONFIG.START_LIVES,
  waves: null,                 // null -> classic procedural waves 1..100
  stars: [18, 10],
  endless: true,
};

export function getLevel(id) {
  if (id === 'endless') return ENDLESS_LEVEL;
  return LEVELS.find((l) => l.id === id) || null;
}
