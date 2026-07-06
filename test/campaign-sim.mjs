// Campaign balance gate: a reference "maze-first" player runs every authored
// level headless — cheap walls form a serpentine, every 3rd piece is a killer
// tower from the player's UNLOCKED set, surplus gold buys upgrades, and walls
// convert to towers late. Usage:
//   node test/campaign-sim.mjs               # all 20 levels + margin gates
//   node test/campaign-sim.mjs l7            # one level, wave-by-wave detail
//   node test/campaign-sim.mjs --careless    # naive-play ceiling gate
//   node test/campaign-sim.mjs --noupgrade   # unupgraded-build-must-fail gate
import { CONFIG, TICK_DT } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize } from '../src/engine/grid.js';
import { createState, canBuildAt, wouldSealAt } from '../src/game/state.js';
import { updateEnemies } from '../src/game/enemy.js';
import { updateTowers } from '../src/game/tower.js';
import { updateProjectiles, updateEffects } from '../src/game/projectile.js';
import { createHero } from '../src/game/hero.js';
import { onEnemyKilled, onEnemyLeaked, payWaveClear, updateFloaters } from '../src/game/economy.js';
import { startWave, processSpawning, waveComplete, updateBosses } from '../src/game/wave.js';
import { tryBuild, tryUpgrade, trySell } from '../src/game/shop.js';
import { LEVELS, getLevel, towersUnlockedAt } from '../src/game/levels.js';

// Horizontal serpentine for portrait boards: a wall row every 2nd row,
// alternating which side keeps the gap. Flags/obstacles just punch holes.
function serpentine(lv) {
  const t = [];
  let i = 0;
  for (let y = 2; y <= lv.rows - 3; y += 2) {
    const fromLeft = (i % 2 === 0); i++;
    if (fromLeft) { for (let x = 1; x <= lv.cols - 4; x++) t.push({ x, y }); }
    else { for (let x = 3; x <= lv.cols - 2; x++) t.push({ x, y }); }
  }
  return t;
}

function build(state, lv, cycle, upgrades = true) {
  if (!state._targets) { state._targets = serpentine(lv); state._ti = 0; state._si = 0; }
  const reserve = 0;
  for (const c of state._targets) {
    if (state.towerGrid[c.y][c.x]) continue;
    if (!canBuildAt(state, c.x, c.y)) continue;
    const budget = state.gold - reserve;
    const wantTower = (state._si % 3 === 0) && cycle.length > 0;
    let type = wantTower ? cycle[state._ti % cycle.length] : 'wall';
    if (CONFIG.TOWERS[type].cost > budget) type = budget >= CONFIG.TOWERS.wall.cost ? 'wall' : null;
    if (!type) break;
    if (wouldSealAt(state, c.x, c.y)) continue;
    if (tryBuild(state, type, c.x, c.y)) {
      state._si++;
      if (type !== 'wall') state._ti++;
    }
  }
  // cheapest-first upgrades (skipped by the 'no-upgrade' strategy: the same
  // maze + tower cycle with zero upgrades is the STRONGEST unupgraded build,
  // so it failing mid-campaign is the strictest honest "upgrades required" gate)
  let guard = 0;
  while (upgrades && guard++ < 400) {
    let best = null, bestCost = Infinity;
    for (const t of state.towers) {
      if (!t.canUpgrade()) continue;
      const c = t.nextUpgradeCost();
      if (c < bestCost) { bestCost = c; best = t; }
    }
    if (!best || state.gold < bestCost) break;
    if (!tryUpgrade(state, best, best.forkChoices() ? 'A' : null)) break;
  }
  // surplus -> convert walls to towers
  let surplus = state.gold - 150;
  if (surplus > 0 && cycle.length) {
    for (const c of state._targets) {
      const t = state.towerGrid[c.y][c.x];
      if (!t || !t.def.wall) continue;
      const type = cycle[state._ti % cycle.length];
      if (CONFIG.TOWERS[type].cost > surplus) break;
      trySell(state, t);
      if (tryBuild(state, type, c.x, c.y)) { state._ti++; surplus -= CONFIG.TOWERS[type].cost; }
      else tryBuild(state, 'wall', c.x, c.y);
    }
  }
}

// The naive-play ceiling: a few scattered archers, NO walls, NO upgrades —
// the way a first-timer who ignores mazing plays. Must fail by mid-campaign.
// (Every 2nd serpentine cell, not 4th: the sim lost its hero warrior when the
// game went hero-less, and the tiny level-1 board only yields 3 cells at %4 —
// this recalibrates the naive ceiling so it still clears the tutorial.)
function carelessBuild(state, lv, cycle) {
  if (!state._ct) state._ct = serpentine(lv).filter((_, i) => i % 2 === 0).slice(0, 10);
  for (const c of state._ct) {
    if (state.towerGrid[c.y][c.x] || !canBuildAt(state, c.x, c.y)) continue;
    const type = cycle.length ? cycle[0] : 'archer';
    if (state.gold < CONFIG.TOWERS[type].cost) break;
    if (wouldSealAt(state, c.x, c.y)) continue;
    tryBuild(state, type, c.x, c.y);
  }
}

export function runLevel(id, verbose = false, strategy = 'reference') {
  const lv = getLevel(id);
  setGridSize(lv.cols, lv.rows);
  const state = createState(makeRng(1), 1, lv);
  // The shipped game is hero-less (CONFIG.HEROES_ENABLED=false); the gates
  // must measure what players actually field. autoplay/t10validate keep theirs.
  if (CONFIG.HEROES_ENABLED) createHero(state, 'warrior');
  // Everything unlocked except the wall rides the tower cycle — support
  // (aura) and gold (income) included: the reference player fields the full
  // roster, so the gates price their value in.
  const cycle = towersUnlockedAt(lv.num).filter((t) => !CONFIG.TOWERS[t].wall);
  let minLives = state.lives;

  // Per-wave sim-time diagnostics: the guard (300 sim-seconds) exists to bound
  // runaway waves, but a TRIPPED guard means enemies were still walking when
  // the wave was cut off — the margin measurement would be corrupt. U8 sizes
  // every board's effective path (~<=270 cells) so this never fires; gTrips is
  // returned (and printed by the gate runners) so a regression is loud.
  const GUARD_TICKS = 60 * 300;
  let maxWaveSecs = 0, gTrips = 0;

  for (let w = 1; w <= lv.waves.count; w++) {
    if (strategy === 'careless') carelessBuild(state, lv, cycle);
    else build(state, lv, cycle, strategy !== 'no-upgrade');
    startWave(state, w);
    let guard = 0;
    while (!waveComplete(state) && state.status !== 'lost' && guard++ < GUARD_TICKS) {
      state.time += TICK_DT;
      processSpawning(state, TICK_DT);
      updateBosses(state, TICK_DT);
      updateTowers(state, TICK_DT);
      updateProjectiles(state, TICK_DT);
      updateEnemies(state, TICK_DT, onEnemyKilled, onEnemyLeaked);
      if (state.hero) state.hero.update(TICK_DT, state);
      updateEffects(state, TICK_DT);
      updateFloaters(state, TICK_DT);
    }
    maxWaveSecs = Math.max(maxWaveSecs, guard / 60);
    if (guard >= GUARD_TICKS) gTrips++;
    minLives = Math.min(minLives, state.lives);
    if (state.status === 'lost') return { won: false, wave: w, lives: 0, minLives, maxWaveSecs, gTrips };
    state.waveActive = false;
    payWaveClear(state, w);
    if (verbose) console.log(`  w${String(w).padStart(3)} lives=${String(state.lives).padStart(2)} gold=${String(Math.floor(state.gold)).padStart(6)} towers=${state.towers.length} simT=${(guard / 60).toFixed(0)}s`);
  }
  return { won: true, lives: state.lives, minLives, towers: state.towers.length, maxWaveSecs, gTrips };
}

const isMain = !!process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
const args = isMain ? process.argv.slice(2) : [];
const careless = args.includes('--careless');
const noupgrade = args.includes('--noupgrade');
const arg = args.find((a) => !a.startsWith('--')) || null;
if (!isMain) {
  // imported as a library (probes/tests): expose runLevel only, no CLI run
} else if (arg) {
  const strategy = careless ? 'careless' : noupgrade ? 'no-upgrade' : 'reference';
  console.log(`Level ${arg}${strategy !== 'reference' ? ` (${strategy})` : ''}:`);
  const r = runLevel(arg, true, strategy);
  console.log(r.won ? `  WON lives=${r.lives} (min=${r.minLives})` : `  DIED wave ${r.wave}`);
} else if (careless) {
  // ceiling gate: naive no-maze play must clear the intro then hit a wall
  let firstLoss = null, l1 = null;
  for (const lv of LEVELS) {
    const r = runLevel(lv.id, false, 'careless');
    console.log(`${lv.id.padEnd(4)} ${lv.name.padEnd(18)} ${r.won ? `won lives=${r.lives}` : `DIED w${r.wave}`}`);
    if (!r.won && firstLoss == null) firstLoss = lv.num;
    if (lv.num === 1) l1 = r;
  }
  const bandOk = firstLoss != null && firstLoss >= 2 && firstLoss <= 10;
  // the tutorial stays winnable for naive play, but it has to feel dangerous
  const l1Ok = l1 && l1.won && l1.lives <= 6;
  console.log(`first careless loss: level ${firstLoss} -> ${bandOk ? 'ok' : 'BAND_FAIL'} (want 2..10)`);
  console.log(`level 1 careless bleeds: lives=${l1 && l1.won ? l1.lives : 'died'} -> ${l1Ok ? 'ok' : 'L1_FAIL'} (want win with <=6)`);
  console.log(bandOk && l1Ok ? 'CARELESS_OK' : 'CARELESS_FAIL');
  if (!bandOk || !l1Ok) process.exitCode = 1;
} else if (noupgrade) {
  // "upgrades required" gate: the strongest UNUPGRADED build (full reference
  // maze + tower cycle + wall conversion, zero upgrades) must hit a wall in
  // the early-mid campaign — playtest 2026-07-06 beat all 20 without upgrading.
  let firstLoss = null, l1 = null;
  for (const lv of LEVELS) {
    const r = runLevel(lv.id, false, 'no-upgrade');
    console.log(`${lv.id.padEnd(4)} ${lv.name.padEnd(18)} ${r.won ? `won lives=${r.lives}` : `DIED w${r.wave}`}`);
    if (!r.won && firstLoss == null) firstLoss = lv.num;
    if (lv.num === 1) l1 = r;
  }
  const bandOk = firstLoss != null && firstLoss >= 3 && firstLoss <= 7;
  // No l1-bleed check here (U7): probes proved the perfect-mazer persona
  // floors at a clean 10 on level 1 in ANY config where careless still wins —
  // the careless "l1 win with <=6 lives" gate owns the tutorial bar. The
  // 3..7 first-loss band above is this gate's teeth.
  console.log(`first no-upgrade loss: level ${firstLoss} -> ${bandOk ? 'ok' : 'BAND_FAIL'} (want 3..7)`);
  console.log(`level 1 no-upgrade: ${l1 ? (l1.won ? `won lives=${l1.lives}` : 'died') : '?'} (informational)`);
  console.log(bandOk ? 'NOUPGRADE_OK' : 'NOUPGRADE_FAIL');
  if (!bandOk) process.exitCode = 1;
} else {
  // Reference gate: wins all 20 AND the margins tighten across the campaign.
  // Interim bands (U20): levels 1-5 finish with >=6 lives; level 10 <=8;
  // level 15 <=6; level 20 <=4. Final margins arrive with U8/U10.
  const MARGIN = { 1: ['>=', 6], 2: ['>=', 6], 3: ['>=', 6], 4: ['>=', 6], 5: ['>=', 6], 10: ['<=', 8], 15: ['<=', 6], 20: ['<=', 4] };
  let allWon = true, marginFails = 0;
  for (const lv of LEVELS) {
    const r = runLevel(lv.id);
    if (!r.won) allWon = false;
    let note = '';
    const band = MARGIN[lv.num];
    if (band && r.won) {
      const [op, n] = band;
      const ok = op === '>=' ? r.lives >= n : r.lives <= n;
      if (!ok) marginFails++;
      note = `  margin ${op}${n} ${ok ? 'ok' : 'MARGIN_FAIL'}`;
    }
    console.log(`${lv.id.padEnd(4)} ${lv.name.padEnd(18)} ${r.won ? `WON  lives=${String(r.lives).padStart(2)} (min=${r.minLives})` : `DIED w${r.wave}`}${note}`);
  }
  const ok = allWon && marginFails === 0;
  console.log(ok ? 'CAMPAIGN_OK' : `CAMPAIGN_FAIL${allWon ? ` (margins: ${marginFails})` : ''}`);
  if (!ok) process.exitCode = 1;
}
