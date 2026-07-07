// =============================================================================
// levels.js — the campaign: 20 hand-authored portrait maps that grow from a
// 12x16 "learn to maze" board to a 28x44 100-wave finale, plus the tall
// Endless map.
//
// U8 design rules (docs/plans/2026-07-06-001 curve table + Open Question 5):
//   - Grids ramp 12x16 (level 1, fits the screen) -> 28x44 (level 20); the
//     camera (U2-U4) owns anything beyond one screen.
//   - Wave counts ramp 10 -> 100 (pins: l1:10 l3:15 l5:22 l8:35 l10:45 l13:62
//     l16:80 l18:90 l20:100; the rest interpolated).
//   - PATH BUDGET (Open Q5, measured via the reference serpentine): a fully
//     mazed board must keep the effective walk (path length x times walked
//     via checkpoints) inside ~60 (l1) ramping to the WC3 reference band of
//     150-250 cells (l10+), and NEVER much past ~270 — that bounds wave
//     duration (sim guard 300s; slowed tank ~1.3-1.9 cells/s) and keeps the
//     100-wave finale playable. A bare 28x44 serpentine walks ~520 cells
//     (2x over the band), so the big boards carry authored TERRAIN BANDS —
//     full-width obstacle massifs with a narrow pass — that bound the
//     mazeable area; the pass usually holds a checkpoint flag (unbuildable,
//     so the pass can never be fully sealed). Grid cap 28x44 CONFIRMED.
//   - Checkpoint flags (Gem TD style) appear from level 4: creeps must visit
//     them IN ORDER, shortest path between each — one maze, walked many times
//     on the small/mid boards, walked once through gated zones on the big ones.
//   - Multi-spawn from level 13 (two gates), level 19 runs three.
//   - Boss cadence (U8): long levels (l10+) run a boss wave every 10th wave
//     (waves.bossEvery expands to bossWaves [10,20,...]); the boss tier is
//     wave-indexed (wave.js: floor(w/10)) so kits escalate INSIDE a level.
//   - Economy is per-level data (KTD4): startGold/bountyMult/waveclearMult
//     on the U15 budget philosophy — income scales with level length so tier
//     purchases stay affordable but scarce; globals never move.
//   - hpMult NOTE: the knob calibrates against the GLOBAL per-wave HP curve
//     (HP_EXP 1.05 compounding across a level's whole wave count), so it
//     FALLS as wave counts grow while end-of-level effective HP still rises
//     monotonically (l1 w10 ~100hp -> l20 w100 ~9,000hp). Do not "fix" the
//     descending values back to a rising curve.
//   - Tower unlocks are tied to campaign progress (UNLOCK_SCHEDULE below):
//     the 8-tower roster spreads across levels 1-13 (arrow first, gold last).
// =============================================================================

import { CONFIG } from '../config.js';

// Which towers a player has at a given campaign level (1-based, cumulative).
// The 8-tower WC3 roster (U7) spreads across levels 1-13; everything stays
// available once unlocked, and levels 14-20 run the full roster by design.
export const UNLOCK_SCHEDULE = [
  { level: 1,  tower: 'wall' },
  { level: 1,  tower: 'arrow' },     // the cheap starter — mazing + arrows
  { level: 2,  tower: 'cannon' },    // splash vs the first packs
  { level: 3,  tower: 'frost' },     // slow utility
  { level: 5,  tower: 'poison' },    // DoT vs the first tanks
  { level: 7,  tower: 'sniper' },    // one level before the first flying wave (hits air)
  { level: 9,  tower: 'lightning' }, // chain vs the dense mid-campaign waves
  { level: 11, tower: 'support' },   // aura once real tower clusters exist
  { level: 13, tower: 'gold' },      // income once levels are long enough to pay back
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
//          bossEvery? (expands to bossWaves [n, 2n, ...] up to count),
//          hpMult (difficulty vs the global curve), bountyMult, waveclearMult,
//          countMult? }
function L(num, name, def) {
  const waves = { ...def.waves };
  if (waves.bossEvery) {
    waves.bossWaves = [];
    for (let w = waves.bossEvery; w <= waves.count; w += waves.bossEvery) waves.bossWaves.push(w);
    delete waves.bossEvery;
  }
  return {
    num, id: 'l' + num, name,
    cols: def.cols, rows: def.rows,
    spawns: def.spawns,
    goals: def.goals,
    checkpoints: def.checkpoints || [],
    obstacles: def.obstacles || [],
    startGold: def.startGold,
    lives: def.lives != null ? def.lives : 10,
    waves,
    stars: def.stars || [9, 6],          // lives kept for 3* / 2* (win = 1*)
    endless: false,
  };
}

// Obstacle helpers: rect block + full-width terrain band with a pass.
function rect(x0, y0, x1, y1) {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}
// band: obstacle rows y0..y1 across the whole interior (1..cols-2) except the
// pass gx0..gx1 — the authored chokepoints that bound big boards' path budget.
function band(cols, y0, y1, gx0, gx1) {
  const out = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = 1; x <= cols - 2; x++) if (x < gx0 || x > gx1) out.push([x, y]);
  }
  return out;
}

// ----------------------------------------------------------------------------
// THE CAMPAIGN
// Spawns sit on the top border, exits on the bottom (portrait flow); flags
// are interior cells (walkable, never buildable).
// ----------------------------------------------------------------------------
export const LEVELS = [
  // -- Act 1: learn to maze (small boards, no flags) ---------------------------
  L(1, 'First Steps', {
    cols: 12, rows: 16,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }],
    // goal sits under the spawn column (not the far corner): on the grown
    // 12x16 board the careless persona's fixed 10-tower budget only ever
    // covers the top few serpentine rows, so a corner-to-corner path let it
    // walk clean past the un-mazed bottom half (careless was winning w/ 9-10
    // lives). Forcing the exit back under the entry keeps the whole route
    // inside the covered band -> careless bleeds to a real 3-life scrape
    // while the reference maze (which serpentines the entire board
    // regardless of goal position) is unaffected. Geometry fix, not hpMult.
    goals: [{ id: 'G1', cx: 2, cy: 15 }],
    startGold: 100,
    waves: { count: 10, types: ['normal'], hpMult: 2.8, bountyMult: 0.19, waveclearMult: 0.14 },
    stars: [10, 7],
  }),
  L(2, 'The Bend', {
    cols: 13, rows: 18,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }],
    goals: [{ id: 'G1', cx: 9, cy: 17 }],
    obstacles: rect(5, 9, 8, 9),
    startGold: 180,
    waves: { count: 12, types: ['normal', 'fast'], hpMult: 3.4, bountyMult: 0.18, waveclearMult: 0.14 },
  }),
  L(3, 'Spawnling Tide', {
    cols: 14, rows: 20,
    spawns: [{ id: 'S1', cx: 7, cy: 0 }],
    goals: [{ id: 'G1', cx: 7, cy: 19 }],
    obstacles: [...rect(3, 9, 4, 10), ...rect(9, 9, 10, 10)],
    startGold: 200,
    waves: { count: 15, types: ['normal', 'fast', 'swarm'], swarmFrom: 4, hpMult: 3.55, bountyMult: 0.08, waveclearMult: 0.13 },
  }),
  // -- Act 2: flags and the first walls ----------------------------------------
  L(4, 'The First Flag', {                      // checkpoints introduced
    // grid pulled in from 15x22 (uncurved-table interpolation) to 11x16: at
    // 15x22 the reference-builder's serpentine offers so many buildable
    // cells that BOTH the upgrading reference and the no-upgrade strategy
    // hit the same final tower count (gold-limited, not cell-limited) and
    // never diverge — no hpMult made no-upgrade fail before the reference
    // gate's own l1-5 ">=6 lives" floor broke first. A tighter board caps
    // both strategies at the SAME small tower count, so reference's upgrade
    // spend (impossible for no-upgrade) becomes the deciding factor — this
    // is the no-upgrade separator's actual home (see hpMult note below);
    // verified by sweep this is the only level in 3-7 where the gap exists.
    cols: 11, rows: 16,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }],
    goals: [{ id: 'G1', cx: 8, cy: 15 }],
    checkpoints: [{ id: 'CP1', cx: 5, cy: 8 }],
    startGold: 250,
    // hpMult retuned 13.05->6.0 for the 2026-07-07 tower rebalance (base dmg
    // x0.10): the old 13.05 was calibrated to the strong pre-rebalance towers
    // and now DIES at wave 3. Cliff sweep: max-winning ~8.05 (2 lives); 6.0
    // wins clean at 10 lives, above the l1-5 >=6 band. The no-upgrade/careless
    // separators no longer live here (both now fail in the tutorial by design —
    // see campaign-sim gate comments), so this level is tuned purely for the
    // reference win margin.
    waves: { count: 18, types: ['normal', 'fast', 'swarm'], swarmFrom: 5, hpMult: 6.0, bountyMult: 0.085, waveclearMult: 0.13 },
  }),
  L(5, 'Cold Snap', {
    cols: 16, rows: 24,
    spawns: [{ id: 'S1', cx: 8, cy: 0 }],
    goals: [{ id: 'G1', cx: 8, cy: 23 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 11 }, { id: 'CP2', cx: 13, cy: 11 }],
    startGold: 280,
    waves: { count: 22, types: ['normal', 'fast', 'swarm', 'tank'], swarmFrom: 4, hpMult: 3.0, bountyMult: 0.065, waveclearMult: 0.125 },
  }),
  L(6, 'Broken Ground', {
    cols: 17, rows: 25,
    spawns: [{ id: 'S1', cx: 13, cy: 0 }],
    goals: [{ id: 'G1', cx: 3, cy: 24 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 9 }, { id: 'CP2', cx: 14, cy: 15 }],
    obstacles: [...rect(4, 7, 6, 7), ...rect(10, 15, 12, 15), [8, 11]],
    startGold: 320,
    waves: { count: 26, types: ['normal', 'fast', 'swarm', 'tank'], swarmFrom: 4, hpMult: 2.8, bountyMult: 0.05, waveclearMult: 0.12 },
  }),
  L(7, 'The Long Watch', {                      // unlock: sniper (flyers next level)
    cols: 17, rows: 26,
    spawns: [{ id: 'S1', cx: 8, cy: 0 }],
    goals: [{ id: 'G1', cx: 8, cy: 25 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 13 }, { id: 'CP2', cx: 14, cy: 13 }],
    obstacles: [...rect(7, 7, 9, 7), ...rect(7, 19, 9, 19)],
    startGold: 360,
    // hpMult retuned 1.9->0.7 for the 2026-07-07 tower rebalance (base dmg
    // x0.10): the weaker towers now lose at w27 at 1.9. Cliff sweep: max-winning
    // ~0.98 (a sharp single-leak-wave cliff, wins full at 10 below it); 0.7
    // wins clean at 10 lives with real headroom.
    waves: { count: 30, types: ['normal', 'fast', 'swarm', 'tank', 'healer'], swarmFrom: 4, hpMult: 0.7, bountyMult: 0.04, waveclearMult: 0.11 },
  }),
  L(8, 'Wings Overhead', {                      // flyers introduced
    cols: 18, rows: 28,
    spawns: [{ id: 'S1', cx: 9, cy: 0 }],
    goals: [{ id: 'G1', cx: 9, cy: 27 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 13 }, { id: 'CP2', cx: 15, cy: 13 }],
    obstacles: rect(6, 20, 11, 21),
    startGold: 400,
    // retuned 1.8->1.2 for the 2026-07-07 tower rebalance (base dmg x0.10):
    // weaker towers now lose at w20 at 1.8. Cliff sweep: max-winning ~1.69
    // (1 life); 1.2 wins clean at 10 lives with headroom below the cliff.
    waves: { count: 35, types: ['normal', 'fast', 'swarm', 'tank', 'flyer'], swarmFrom: 4, flyerFrom: 6, hpMult: 1.2, bountyMult: 0.045, waveclearMult: 0.1 },
  }),
  L(9, 'Verdant Garden', {                      // authored hedge rows: free walls
    cols: 19, rows: 30,
    spawns: [{ id: 'S1', cx: 9, cy: 0 }],
    goals: [{ id: 'G1', cx: 9, cy: 29 }],
    checkpoints: [{ id: 'CP1', cx: 15, cy: 9 }, { id: 'CP2', cx: 2, cy: 17 }, { id: 'CP3', cx: 15, cy: 25 }],
    obstacles: [...rect(1, 8, 13, 8), ...rect(4, 16, 17, 16), ...rect(1, 24, 13, 24)],
    startGold: 440,
    // retuned 1.5->0.5 for the 2026-07-07 tower rebalance (base dmg x0.10):
    // weaker towers now lose at w18 at 1.5. Cliff sweep: max-winning ~0.71
    // (sharp single-leak cliff); 0.5 wins clean at 10 lives with headroom.
    waves: { count: 39, types: ['normal', 'fast', 'swarm', 'tank', 'healer', 'flyer'], swarmFrom: 4, flyerFrom: 7, hpMult: 0.5, bountyMult: 0.04, waveclearMult: 0.1 },
  }),
  // -- Act 3: bosses and the terrain bands --------------------------------------
  L(10, 'The Wardens', {                        // first boss level; Endless unlocks
    cols: 20, rows: 32,
    spawns: [{ id: 'S1', cx: 10, cy: 0 }],
    goals: [{ id: 'G1', cx: 10, cy: 31 }],
    checkpoints: [{ id: 'CP1', cx: 16, cy: 10 }, { id: 'CP2', cx: 2, cy: 21 }, { id: 'CP3', cx: 10, cy: 27 }],
    obstacles: [...band(20, 10, 11, 15, 17), ...band(20, 21, 22, 1, 3)],
    startGold: 480,
    lives: 8,
    // retuned 0.6->0.45 for the 2026-07-07 tower rebalance (base dmg x0.10):
    // weaker towers now lose at w26 at 0.6. Cliff sweep: max-winning ~0.55
    // (6 lives). U8 gate band: l10 margin <=8 lives — 0.45 lands at 8.
    waves: { count: 45, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'flyer'], swarmFrom: 4, flyerFrom: 7, bossEvery: 10, hpMult: 0.45, bountyMult: 0.04, waveclearMult: 0.095 },
    stars: [8, 6],
  }),
  L(11, 'The Long Descent', {
    cols: 20, rows: 33,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }],
    goals: [{ id: 'G1', cx: 10, cy: 32 }],
    checkpoints: [{ id: 'CP1', cx: 16, cy: 10 }, { id: 'CP2', cx: 2, cy: 20 }, { id: 'CP3', cx: 16, cy: 27 }],
    obstacles: [...band(20, 10, 11, 15, 17), ...band(20, 20, 21, 1, 3), ...band(20, 27, 28, 15, 17)],
    startGold: 520,
    // retuned 0.5->0.22 for the 2026-07-07 tower rebalance (base dmg x0.10):
    // weaker towers now lose at w38 at 0.5. Cliff sweep: max-winning ~0.29
    // (sharp single-leak cliff); 0.22 wins clean at 10 lives with headroom.
    waves: { count: 50, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 4, flyerFrom: 6, bossEvery: 10, hpMult: 0.22, bountyMult: 0.03, waveclearMult: 0.09 },
    stars: [8, 6],
  }),
  L(12, 'The Narrows', {                        // canyon: massif walls + one gate
    cols: 21, rows: 34,
    spawns: [{ id: 'S1', cx: 10, cy: 0 }],
    goals: [{ id: 'G1', cx: 10, cy: 33 }],
    checkpoints: [{ id: 'CP1', cx: 10, cy: 11 }, { id: 'CP2', cx: 10, cy: 24 }],
    obstacles: [...rect(1, 8, 6, 14), ...rect(14, 8, 19, 14), ...band(21, 24, 25, 9, 11)],
    startGold: 560,
    // retuned 0.33->0.22 for the 2026-07-07 tower rebalance (base dmg x0.10):
    // weaker towers now lose at w51 at 0.33. Cliff sweep: max-winning ~0.30;
    // 0.22 wins clean at 10 lives with headroom below the cliff.
    waves: { count: 56, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 4, flyerFrom: 6, bossEvery: 10, hpMult: 0.22, bountyMult: 0.027, waveclearMult: 0.09 },
    stars: [8, 6],
  }),
  L(13, 'Two Roads', {                          // second spawn introduced
    cols: 22, rows: 36,
    spawns: [{ id: 'S1', cx: 4, cy: 0 }, { id: 'S2', cx: 17, cy: 0 }],
    goals: [{ id: 'G1', cx: 10, cy: 35 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 13 }, { id: 'CP2', cx: 19, cy: 25 }],
    obstacles: [...band(22, 12, 15, 1, 3), ...band(22, 24, 27, 18, 20)],
    startGold: 600,
    // retuned from 1.45 (sweep max-winning ~0.33).
    waves: { count: 62, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 4, flyerFrom: 6, bossEvery: 10, hpMult: 0.28, bountyMult: 0.026, waveclearMult: 0.085 },
    stars: [7, 5],
  }),
  L(14, 'The Gauntlet', {                       // central massifs, weaving flags
    cols: 22, rows: 37,
    spawns: [{ id: 'S1', cx: 2, cy: 0 }, { id: 'S2', cx: 19, cy: 0 }],
    goals: [{ id: 'G1', cx: 10, cy: 36 }],
    checkpoints: [{ id: 'CP1', cx: 10, cy: 8 }, { id: 'CP2', cx: 10, cy: 18 }, { id: 'CP3', cx: 10, cy: 30 }],
    obstacles: [...rect(6, 10, 15, 15), ...rect(6, 22, 15, 27)],
    startGold: 650,
    // retuned from 1.35 (sweep max-winning ~0.34).
    waves: { count: 68, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 6, bossEvery: 10, hpMult: 0.28, bountyMult: 0.023, waveclearMult: 0.085 },
    stars: [7, 5],
  }),
  L(15, 'Heart of the Maze', {                  // the lake: forced west passage
    cols: 23, rows: 38,
    spawns: [{ id: 'S1', cx: 11, cy: 0 }],
    goals: [{ id: 'G1', cx: 11, cy: 37 }],
    checkpoints: [{ id: 'CP1', cx: 11, cy: 11 }, { id: 'CP2', cx: 2, cy: 19 }, { id: 'CP3', cx: 11, cy: 27 }],
    obstacles: rect(5, 13, 17, 24),
    startGold: 700,
    lives: 6,
    // retuned from 1.25 (sweep max-winning ~0.235 at 3 lives). U8 gate band:
    // l15 margin <=6 lives — 0.2 lands at 3, well inside.
    waves: { count: 74, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 5, bossEvery: 10, hpMult: 0.2, bountyMult: 0.021, waveclearMult: 0.085 },
    stars: [6, 4],
  }),
  // -- Act 4: mastery ------------------------------------------------------------
  L(16, 'Crosswinds', {                         // two gates crossing, one exit
    cols: 24, rows: 40,
    spawns: [{ id: 'S1', cx: 4, cy: 0 }, { id: 'S2', cx: 19, cy: 0 }],
    // single shared goal (not twin exits): defaultRouting() (state.js) picks
    // each spawn's nearest goal by raw obstacle-only BFS on the CURRENT maze,
    // blind to checkpoints — with two goals that pick is only as stable as
    // the player's OWN tower placement. Proven with the reference mazer on a
    // BARE 24x40 board (no authored terrain at all): its generic serpentine
    // isn't left/right-symmetric, so it made G2 the nearer goal for BOTH
    // spawns and G1's whole side went undefended (unwinnable at ANY hpMult).
    // Widening/doubling the gap geometry didn't help — the asymmetry comes
    // from the reference build order itself, outside level-data control. One
    // goal removes the only lever that pick depends on; every other
    // multi-spawn level (l13/14/18/19/20) already uses one goal for the
    // same reason. The crossing flavor survives via the checkpoint chain,
    // which both spawns still funnel through in order.
    goals: [{ id: 'G1', cx: 12, cy: 39 }],
    // checkpoints sit INSIDE each band's own gap column (x=3 matches the
    // first band's 2-4 gap, x=20 matches the second band's 20-22 gap) at
    // rows past both bands — a checkpoint placed BEFORE a band, or off in
    // the band's solid middle, forces every early path through one single
    // cell with no redundancy, so the reference mazer's very first tower
    // placement trips wouldSealAt() and the maze never gets built at all
    // (0 towers, instant multi-leak). This layout is proven buildable.
    checkpoints: [{ id: 'CP1', cx: 3, cy: 20 }, { id: 'CP2', cx: 20, cy: 20 }],
    obstacles: [...band(24, 9, 14, 2, 4), ...band(24, 25, 32, 20, 22)],
    startGold: 750,
    lives: 6,
    // flyerFrom pushed from 5 to 7 (vs l9's identical 7 on a similar-scale
    // board): at 5 the guaranteed 11-flyer wave lands before the reference
    // mazer has built deep enough into a 360-cell board (only ~78 towers by
    // wave 4) to have ANY anti-air near the edge columns the checkpoints
    // route through — a coincidence of the tower-type cycle, not hpMult;
    // even hpMult~0 still leaked the whole wave. Two extra waves of build
    // time is enough coverage density to hold.
    waves: { count: 80, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 7, bossEvery: 10, hpMult: 0.15, bountyMult: 0.02, waveclearMult: 0.08 },
    stars: [6, 4],
  }),
  L(17, 'The Long March', {                     // three passes: right, left, right
    cols: 25, rows: 41,
    spawns: [{ id: 'S1', cx: 12, cy: 0 }],
    goals: [{ id: 'G1', cx: 12, cy: 40 }],
    checkpoints: [{ id: 'CP1', cx: 22, cy: 13 }, { id: 'CP2', cx: 2, cy: 23 }, { id: 'CP3', cx: 22, cy: 33 }],
    obstacles: [...band(25, 11, 16, 21, 23), ...band(25, 21, 26, 1, 3), ...band(25, 31, 36, 21, 23)],
    startGold: 800,
    lives: 5,
    // retuned from 1.1 (sweep max-winning ~0.177 at 5 lives).
    waves: { count: 85, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 5, bossEvery: 10, hpMult: 0.15, bountyMult: 0.02, waveclearMult: 0.075 },
    stars: [5, 3],
  }),
  L(18, 'Siegebreakers', {                      // the fortress gate
    cols: 26, rows: 42,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }, { id: 'S2', cx: 22, cy: 0 }],
    goals: [{ id: 'G1', cx: 12, cy: 41 }],
    checkpoints: [{ id: 'CP1', cx: 12, cy: 12 }, { id: 'CP2', cx: 2, cy: 23 }, { id: 'CP3', cx: 22, cy: 33 }],
    obstacles: [...band(26, 10, 15, 11, 14), ...band(26, 21, 26, 1, 4), ...band(26, 31, 36, 20, 23)],
    startGold: 850,
    lives: 5,
    // retuned from 1.0 (sweep max-winning ~0.114 at 5 lives).
    waves: { count: 90, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 5, bossEvery: 10, hpMult: 0.095, bountyMult: 0.02, waveclearMult: 0.07 },
    stars: [5, 3],
  }),
  L(19, 'Threefold Path', {                     // three gates for three roads
    cols: 27, rows: 43,
    spawns: [{ id: 'S1', cx: 4, cy: 0 }, { id: 'S2', cx: 13, cy: 0 }, { id: 'S3', cx: 22, cy: 0 }],
    goals: [{ id: 'G1', cx: 13, cy: 42 }],
    checkpoints: [{ id: 'CP1', cx: 2, cy: 11 }, { id: 'CP2', cx: 24, cy: 21 }, { id: 'CP3', cx: 13, cy: 32 }],
    obstacles: [...band(27, 9, 14, 1, 3), ...band(27, 19, 24, 23, 25), ...band(27, 29, 36, 12, 15)],
    startGold: 900,
    lives: 5,
    // retuned from 0.95 (sweep max-winning ~0.125 at 5 lives).
    waves: { count: 95, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 4, bossEvery: 10, hpMult: 0.105, bountyMult: 0.02, waveclearMult: 0.065 },
    stars: [5, 3],
  }),
  L(20, 'The Demon King', {                     // the 100-wave finale
    cols: 28, rows: 44,
    spawns: [{ id: 'S1', cx: 3, cy: 0 }, { id: 'S2', cx: 24, cy: 0 }],
    goals: [{ id: 'G1', cx: 13, cy: 43 }],
    checkpoints: [{ id: 'CP1', cx: 23, cy: 9 }, { id: 'CP2', cx: 3, cy: 21 }, { id: 'CP3', cx: 13, cy: 31 }],
    obstacles: [...band(28, 7, 12, 22, 25), ...band(28, 17, 24, 2, 5), ...band(28, 29, 34, 12, 15)],
    startGold: 950,
    lives: 4,
    // retuned from 0.9 (sweep max-winning ~0.064, a steep wave-100 cliff).
    // U8 gate band: l20 margin <=4 lives (the tightest in the campaign) —
    // 0.05 lands at exactly 4, with real headroom below the ~0.064 cliff.
    waves: { count: 100, types: ['normal', 'fast', 'swarm', 'tank', 'shield', 'healer', 'flyer'], swarmFrom: 3, flyerFrom: 4, bossEvery: 10, hpMult: 0.05, bountyMult: 0.02, waveclearMult: 0.06 },
    stars: [4, 2],
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
