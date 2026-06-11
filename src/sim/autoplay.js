// =============================================================================
// autoplay.js — headless balance simulation (BUILD_PROMPT Phase 8).
//
// Runs a fixed "reference" player strategy through the whole game with NO canvas
// and NO DOM, then reports how far it got. It's the tuning instrument used to set
// DIFFICULTY / costs / bounties so a competent build clears wave 100 with low
// margin while a careless build dies in the teaching zone (~waves 25–60).
//
// Run it:  node src/sim/autoplay.js          (uses npm run sim)
//          node src/sim/autoplay.js careless
// =============================================================================

import { CONFIG, TICK_DT } from '../config.js';
import { makeRng } from '../engine/rng.js';
import { SIZE, cellDist, worldToCell } from '../engine/grid.js';
import { createState, canBuildAt, wouldSealAt } from '../game/state.js';
import { updateEnemies } from '../game/enemy.js';
import { updateTowers } from '../game/tower.js';
import { updateProjectiles, updateEffects } from '../game/projectile.js';
import { createHero } from '../game/hero.js';
import { onEnemyKilled, onEnemyLeaked, updateFloaters, payWaveClear } from '../game/economy.js';
import { startWave, processSpawning, waveComplete, updateBosses } from '../game/wave.js';
import { tryBuild, tryUpgrade, trySell, tryConsumable } from '../game/shop.js';

// Mix favouring anti-air (tesla/arcane/archer/frost can hit flyers). Ordered
// cheap-first so the early maze fills out before pricey towers appear. One
// Beacon per cycle: inline in the wall, its aura covers the adjacent walls.
const TYPE_CYCLE = ['archer', 'cannon', 'frost', 'arcane', 'venom', 'archer', 'tesla', 'beacon', 'frost', 'arcane', 'cannon'];

function cheapestAffordable(budget) {
  let best = null, bestCost = Infinity;
  for (const [id, def] of Object.entries(CONFIG.TOWERS)) {
    if (def.wall) continue;                       // walls don't shoot
    if (def.cost <= budget && def.cost < bestCost) { bestCost = def.cost; best = id; }
  }
  return best;
}

function preferredBranch(type, t) {
  if (type === 'frost') return 'B';                 // Shatter: team-wide amp
  if (type === 'arcane') return (t.uid % 2 === 0) ? 'B' : 'A'; // some Disrupt, some Archmage
  return 'A';                                       // offense branches otherwise
}

// Serpentine wall-maze target cells: vertical walls every 2 cols. Each wall is
// anchored to one border (so there's no open lane along the top/bottom edge) and
// leaves a 2-cell gap at the opposite end, alternating — forcing enemies to snake
// up-and-down the full height past every wall. (Anchoring to the border is the
// key: an earlier version started walls at y=2 and left the y=1 row as a straight
// highway, so the path never lengthened.)
function serpentineTargets(state) {
  const COLS = CONFIG.GRID_COLS, ROWS = CONFIG.GRID_ROWS;
  const targets = [];
  let i = 0;
  for (let x = 3; x <= COLS - 5; x += 2) {
    const fromTop = (i % 2 === 0); i++;
    if (fromTop) { for (let y = 1; y <= ROWS - 4; y++) targets.push({ x, y }); }  // anchored top, gap bottom
    else { for (let y = 3; y <= ROWS - 2; y++) targets.push({ x, y }); }          // anchored bottom, gap top
  }
  return targets;
}

// Maze-first reference (Wintermaul economy): cheap WALLS form most of the
// serpentine; every 3rd cell is a killer tower from the cycle. Surplus gold
// buys the cheapest upgrades (walls can't upgrade, so towers soak it all).
function referenceBuild(state, reserve) {
  if (!state._targets) { state._targets = serpentineTargets(state); state._ti = 0; state._si = 0; }
  for (const c of state._targets) {
    if (state.towerGrid[c.y][c.x]) continue;
    const budget = state.gold - reserve;
    const wantTower = (state._si % 3 === 0);
    let type = wantTower ? TYPE_CYCLE[state._ti % TYPE_CYCLE.length] : 'wall';
    if (CONFIG.TOWERS[type].cost > budget) type = (budget >= CONFIG.TOWERS.wall.cost) ? 'wall' : null;
    if (!type) break;                       // can't afford anything
    // wouldSealAt guard: canBuildAt now ALLOWS sealing (siege mode); the
    // reference player must never wall itself in.
    if (canBuildAt(state, c.x, c.y) && !wouldSealAt(state, c.x, c.y) && tryBuild(state, type, c.x, c.y)) {
      state._si++;
      if (type !== 'wall') state._ti++;
    }
  }
  let guard = 0;
  while (guard++ < 1000) {
    let best = null, bestCost = Infinity;
    for (const t of state.towers) {
      if (!t.canUpgrade()) continue;
      const c = t.nextUpgradeCost();
      if (c < bestCost) { bestCost = c; best = t; }
    }
    if (!best || state.gold - bestCost < reserve) break;
    if (!tryUpgrade(state, best, best.level === 3 ? preferredBranch(best.type, best) : null)) break;
  }

  // Late game: once upgrades saturate and gold piles up, convert walls into
  // killer towers (sell at 100%, rebuild same cell — maze shape unchanged).
  let surplus = state.gold - reserve - 600;
  if (surplus > 0) {
    for (const c of state._targets) {
      const t = state.towerGrid[c.y][c.x];
      if (!t || !t.def.wall) continue;
      const type = TYPE_CYCLE[state._ti % TYPE_CYCLE.length];
      if (CONFIG.TOWERS[type].cost > surplus) break;
      trySell(state, t);
      if (tryBuild(state, type, c.x, c.y)) {
        state._ti++;
        surplus -= CONFIG.TOWERS[type].cost;
      } else {
        tryBuild(state, 'wall', c.x, c.y);   // enemy in the cell etc: restore the maze
      }
    }
  }
}

// "Careless but trying" build: a short, partial maze of cheap archers/cannons
// (~20 towers) that is NEVER upgraded — i.e. the classic new-player mistakes
// (short maze, thin anti-air, no upgrades). Falls behind the HP curve mid-game.
function carelessBuild(state) {
  if (!state._ctargets) { state._ctargets = serpentineTargets(state).slice(0, 20); state._cti = 0; }
  for (const c of state._ctargets) {
    if (state.towerGrid[c.y][c.x]) continue;
    const type = (state._cti % 2 === 0) ? 'archer' : 'cannon';
    if (state.gold < CONFIG.TOWERS[type].cost) continue;
    if (canBuildAt(state, c.x, c.y) && !wouldSealAt(state, c.x, c.y) && tryBuild(state, type, c.x, c.y)) state._cti++;
  }
  // deliberately never upgrades
}

function bestClusterCell(state, radius) {
  let best = null, bestN = -1;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    let n = 0;
    for (const o of state.enemies) {
      if (!o.alive) continue;
      if (cellDist(e.x / SIZE, e.y / SIZE, o.x / SIZE, o.y / SIZE) <= radius) n++;
    }
    if (n > bestN) { bestN = n; best = e; }
  }
  return best ? worldToCell(best.x, best.y) : null;
}

function heroAI(state) {
  const h = state.hero;
  if (!h || h.downed) return;
  for (let i = 0; i < 2; i++) {
    if (!h.canCast(i)) continue;
    const ab = h.abilities[i];
    if (ab.targetCell) {
      const cell = bestClusterCell(state, ab.radius);
      if (cell) h.cast(state, i, cell);
    } else {
      const near = state.enemies.some((e) => e.alive && !e.flying &&
        cellDist(h.x / SIZE, h.y / SIZE, e.x / SIZE, e.y / SIZE) <= ab.radius);
      if (near || ab.id === 'hawkeye') h.cast(state, i, null);
    }
  }
}

// Buy panic consumables: repair when low on lives, frenzy on boss waves.
function consumableAI(state) {
  if (state.lives <= 6) tryConsumable(state, 'repair', null);
  if (state.wave % 10 === 0 && state.frenzyTimer <= 0 && state.gold > 400) tryConsumable(state, 'frenzy', null);
}

function onKill(s, e) { s._kills = (s._kills || 0) + 1; onEnemyKilled(s, e); }
function onLeak(s, e) { s._leaks = (s._leaks || 0) + 1; onEnemyLeaked(s, e); }

function simStep(state, dt) {
  state.time += dt;
  processSpawning(state, dt);
  updateBosses(state, dt);
  updateTowers(state, dt);
  updateProjectiles(state, dt);
  updateEnemies(state, dt, onKill, onLeak);
  if (state.hero) state.hero.update(dt, state);
  updateEffects(state, dt);
  updateFloaters(state, dt);
}

export function runReferenceGame(opts = {}) {
  const { seed = CONFIG.SEED, heroId = 'ranger', strategy = 'reference', maxWave = CONFIG.WIN_WAVE, dt = 1 / 30, verbose = false } = opts;
  const state = createState(makeRng(seed));
  createHero(state, heroId);

  let minLives = state.lives;
  const deaths = [];   // waves where lives dropped a lot

  for (let w = 1; w <= maxWave; w++) {
    // ---- build phase ----
    if (strategy === 'reference') referenceBuild(state, 0);
    else carelessBuild(state);
    consumableAI(state);

    // ---- run the wave ----
    state._kills = 0; state._leaks = 0;
    startWave(state, w);
    let guard = 0;
    while (!waveComplete(state) && state.lives > 0 && guard < 30 * 400) {
      simStep(state, dt);
      heroAI(state);
      consumableAI(state);
      guard++;
    }
    if (opts.onWave) opts.onWave({ wave: w, lives: state.lives, towers: state.towers.length, gold: Math.floor(state.gold), kills: state._kills, leaks: state._leaks, pathLen: (state.paths.S1 || []).length, heroLevel: state.hero.level });
    if (state.lives <= 0) { state.status = 'lost'; break; }
    payWaveClear(state, w);
    minLives = Math.min(minLives, state.lives);
    if (verbose && (w % 10 === 0 || w === 1)) {
      console.log(`  w${String(w).padStart(3)}  lives=${String(state.lives).padStart(2)}  gold=${String(Math.floor(state.gold)).padStart(6)}  towers=${state.towers.length}  heroL${state.hero.level}`);
    }
  }

  const won = state.lives > 0 && state.maxWave >= maxWave;
  return {
    won, reachedWave: won ? maxWave : state.wave, lives: state.lives, minLives,
    gold: Math.floor(state.gold), towers: state.towers.length, heroLevel: state.hero.level,
    difficulty: CONFIG.DIFFICULTY,
  };
}

// ----- CLI -----
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('autoplay.js')) {
  const mode = process.argv[2] || 'reference';
  console.log(`Mazecore TD autoplay — strategy="${mode}", DIFFICULTY=${CONFIG.DIFFICULTY}`);
  if (mode === 'careless') {
    const r = runReferenceGame({ strategy: 'careless', heroId: 'ranger', verbose: false });
    console.log(`Careless build: ${r.won ? 'WON' : 'died wave ' + r.reachedWave}, lives=${r.lives}`);
  } else {
    const r = runReferenceGame({ strategy: 'reference', heroId: 'ranger', verbose: true });
    console.log(r.won
      ? `RESULT: cleared all ${CONFIG.WIN_WAVE} waves with ${r.lives} lives left (min during run: ${r.minLives}). towers=${r.towers} heroL${r.heroLevel}`
      : `RESULT: died on wave ${r.reachedWave}. lives=${r.lives} towers=${r.towers} heroL${r.heroLevel}`);
  }
}
