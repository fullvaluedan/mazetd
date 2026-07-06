// C1 checks — dynamic grid, authored levels, checkpoint-chain routing.
import { CONFIG, TICK_DT } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize, COLS, ROWS, CELL, cellCenter } from '../src/engine/grid.js';
import * as grid from '../src/engine/grid.js';
import { createState, canBuildAt, wouldSealAt, routeFor } from '../src/game/state.js';
import { Enemy, updateEnemies } from '../src/game/enemy.js';
import { addTower } from '../src/game/tower.js';
import { onEnemyKilled, onEnemyLeaked } from '../src/game/economy.js';
import { getLevel, LEVELS, towersUnlockedAt } from '../src/game/levels.js';
import { levelWaveInfo, winWave } from '../src/game/wave.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

function loadLevel(id) {
  const lv = getLevel(id);
  setGridSize(lv.cols, lv.rows);
  return createState(makeRng(1), 1, lv);
}
function tick(st, seconds) {
  const n = Math.round(seconds / TICK_DT);
  for (let i = 0; i < n; i++) { st.time += TICK_DT; updateEnemies(st, TICK_DT, onEnemyKilled, onEnemyLeaked); }
}

console.log('Level 1: small board (U8: 12x16), straight run, leak at the exit:');
{
  const st = loadLevel('l1');
  check('grid resized to 12x16', grid.COLS === 12 && grid.ROWS === 16);
  check('start gold/lives from level', st.gold === 100 && st.lives === 10);
  check('route is just the goal', routeFor(st, 'S1').join(',') === 'G1');
  check('win wave from level', winWave(st) === 10);
  const e = new Enemy(st, 'normal', 'S1', st.routing['S1'], { hp: 1e5, speed: 4, bounty: 1 });
  st.enemies.push(e);
  const lives0 = st.lives;
  tick(st, 8);
  check('enemy crossed and leaked', st.lives < lives0);
}

console.log('Level 5: two flags, stage-by-stage walk (U8: CP1(2,11)/CP2(13,11)):');
{
  const st = loadLevel('l5');
  check('route = CP1,CP2,G1', routeFor(st, 'S1').join(',') === 'CP1,CP2,G1');
  check('flag cells are unbuildable', canBuildAt(st, 2, 11) === false && canBuildAt(st, 13, 11) === false);
  check('overlay path passes through both flags', (() => {
    const p = st.paths['S1'];
    const hit = (x, y) => p.some((c) => c.x === x && c.y === y);
    return p.length > 20 && hit(2, 11) && hit(13, 11);
  })(), `len=${st.paths['S1'].length}`);

  const e = new Enemy(st, 'normal', 'S1', st.routing['S1'], { hp: 1e6, speed: 5, bounty: 1 });
  st.enemies.push(e);
  check('starts at stage 0', e.stage === 0);
  tick(st, 4);
  check('advanced past flag 1', e.stage >= 1, `stage=${e.stage}`);
  const lives0 = st.lives;
  tick(st, 20);
  check('full chain walked -> leak', st.lives < lives0, `stage=${e.stage}`);
}

console.log('Sealing a MIDDLE stage is detected:');
{
  const st = loadLevel('l5');
  // ring CP2 (13,11): blocking its last open neighbour must read as sealing
  const ring = [[12, 11], [13, 10], [13, 12]];
  for (const [x, y] of ring) addTower(st, 'archer', x, y);
  check('spawn->CP1 still open mid-ring', !st.siege);
  check('final ring cell warns wouldSealAt', wouldSealAt(st, 14, 11) === true);
  addTower(st, 'archer', 14, 11);          // allowed — siege mode
  check('siege flips on (CP2 cut off)', st.siege === true);
  check('breach field targets CP2', !!st.siegeFields['CP2']);
}

console.log('Flyers honour the flags:');
{
  const st = loadLevel('l5');
  const f = new Enemy(st, 'flyer', 'S1', st.routing['S1'], { hp: 1e6, speed: 5, bounty: 1 });
  st.enemies.push(f);
  const cp1 = cellCenter(2, 11);
  check('first air target is flag 1', Math.abs(f.targetCenter.x - cp1.x) < 1 && Math.abs(f.targetCenter.y - cp1.y) < 1);
  tick(st, 3.5);
  check('air stage advanced', f.stage >= 1, `stage=${f.stage}`);
}

console.log('Multi-spawn routing (U8: l16 collapsed to a single shared goal):');
{
  // l16 ("Crosswinds"): two spawns funnel through a shared checkpoint chain to
  // ONE goal (see levels.js U8 comment — a second goal made defaultRouting()'s
  // nearest-goal-by-raw-BFS pick unstable across builds; not tested here since
  // there's only one goal to route to any more).
  const st = loadLevel('l16');
  const r1 = routeFor(st, 'S1'), r2 = routeFor(st, 'S2');
  check('both spawns share the checkpoint chain then the one goal', r1.join(',') === 'CP1,CP2,G1' && r2.join(',') === 'CP1,CP2,G1', `${r1} vs ${r2}`);
  const st2 = loadLevel('l13');         // S1,S2 -> single G1
  check('two spawns, one goal both reach it', routeFor(st2, 'S1').slice(-1)[0] === 'G1' && routeFor(st2, 'S2').slice(-1)[0] === 'G1');
}

console.log('Campaign wave composer:');
{
  const l8 = getLevel('l8');     // flyerFrom: 6
  for (let w = 1; w < 6; w++) check(`w${w}: no flyers before flyerFrom`, !levelWaveInfo(l8, w).hasFlying);
  check('flyer wave fires at flyerFrom', levelWaveInfo(l8, 6).hasFlying === true);
  const a = levelWaveInfo(l8, 9), b = levelWaveInfo(l8, 9);
  check('deterministic per (level, wave)', JSON.stringify(a) === JSON.stringify(b));
  const l10 = getLevel('l10');   // U8: bossEvery:10 -> bossWaves [10,20,30,40]
  check('boss wave from bossWaves[]', levelWaveInfo(l10, 10).isBoss === true && !levelWaveInfo(l10, 9).isBoss);
  check('20 campaign levels defined', LEVELS.length === 20);
  check('unlocks grow with progress', towersUnlockedAt(1).join() === 'wall,arrow' && towersUnlockedAt(7).length === 6);
}

console.log('Classic board untouched after restore:');
{
  setGridSize(CONFIG.GRID_COLS, CONFIG.GRID_ROWS);
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  check('28x18 classic', grid.COLS === 28 && grid.ROWS === 18);
  check('classic routes are single-goal', routeFor(st, 'S1').length === 1);
  check('paths still trace', st.paths['S1'].length > 10);
}

console.log(fails === 0 ? 'LEVELS_OK' : `LEVELS_FAIL (${fails})`);
