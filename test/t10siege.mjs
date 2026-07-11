// Phase M3 checks — siege mode: seal -> besiege -> breach -> leak, juggling,
// flyers, and the reference maze staying seal-free.
import { CONFIG, TICK_DT } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { createState, canBuildAt, wouldSealAt } from '../src/game/state.js';
import { Enemy, updateEnemies } from '../src/game/enemy.js';
import { addTower, updateTowers } from '../src/game/tower.js';
import { trySell } from '../src/game/shop.js';
import { onEnemyKilled, onEnemyLeaked } from '../src/game/economy.js';
import { CELL } from '../src/engine/grid.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

function tick(st, seconds) {
  const n = Math.round(seconds / TICK_DT);
  for (let i = 0; i < n; i++) {
    st.time += TICK_DT;
    updateTowers(st, TICK_DT);
    updateEnemies(st, TICK_DT, onEnemyKilled, onEnemyLeaked);
  }
}
function tickUntil(st, maxSeconds, pred) {
  const n = Math.round(maxSeconds / TICK_DT);
  for (let i = 0; i < n; i++) {
    st.time += TICK_DT;
    updateTowers(st, TICK_DT);
    updateEnemies(st, TICK_DT, onEnemyKilled, onEnemyLeaked);
    if (pred(st)) return (i + 1) * TICK_DT;
  }
  return -1;
}
const grunt = (st, hp = 1e5, speed = 3) => {
  const e = new Enemy(st, 'normal', 'S1', st.routing['S1'], { hp, speed, bounty: 1 });
  st.enemies.push(e); return e;
};
// Wall the column with non-attacking Beacons so breach timing is clean.
function buildWall(st, x) {
  const placed = [];
  const open = [];
  for (let y = 1; y < CONFIG.GRID_ROWS - 1; y++) {
    if (st.map.type(x, y) === CELL.OPEN && !st.towerGrid[y][x]) open.push(y);
  }
  for (let i = 0; i < open.length; i++) {
    const y = open[i];
    if (i === open.length - 1) {
      check('final seal cell: still legal', canBuildAt(st, x, y) === true);
      check('final seal cell: wouldSealAt warns', wouldSealAt(st, x, y) === true);
    }
    placed.push(addTower(st, 'wall', x, y));
  }
  return placed;
}

console.log('Seal -> siege -> breach -> leak:');
{
  const st = createState(makeRng(1));
  st.wave = 10;                       // sets the wall-damage dps tier
  check('open maze: not sealed', st.siege === false);
  buildWall(st, 14);
  check('state.siege flips on', st.siege === true);
  check('breach field published', !!st.siegeFields[st.routing['S1']]);

  for (let i = 0; i < 5; i++) grunt(st);
  const tSiege = tickUntil(st, 5, (s) => s.enemies.some((e) => e.siegeTarget));
  check('creeps start chewing within 5s', tSiege > 0, `${tSiege.toFixed(1)}s`);

  const towers0 = st.towers.length;
  const gold0 = st.gold;
  const tBreak = tickUntil(st, 60, (s) => s.towers.length < towers0);
  check('a wall tower falls within 60s', tBreak > 0, `${tBreak > 0 ? tBreak.toFixed(1) : '?'}s`);
  check('no refund on destruction', st.gold === gold0);

  const lives0 = st.lives;
  const tLeak = tickUntil(st, 60, (s) => s.lives < lives0);
  check('creeps walk the breach and leak', tLeak > 0, `${tLeak > 0 ? tLeak.toFixed(1) : '?'}s`);
  check('siege clears once a route opens', st.siege === false);
}

console.log('Juggling: selling a wall resumes the walk instantly:');
{
  const st = createState(makeRng(1));
  st.wave = 10;
  const wall = buildWall(st, 14);
  for (let i = 0; i < 4; i++) grunt(st);
  tickUntil(st, 10, (s) => s.enemies.some((e) => e.siegeTarget));
  check('besieged before the sell', st.enemies.some((e) => e.siegeTarget));
  trySell(st, wall.find((t) => st.towers.includes(t)));
  check('siegeTargets cleared by the sell', st.enemies.every((e) => !e.siegeTarget));
  check('siege flag off after reopening', st.siege === false);
  const moved = tickUntil(st, 2, (s) => s.enemies.some((e) => e.targetCell.x !== e.cx || e.targetCell.y !== e.cy));
  check('creeps walking again', moved >= 0);
}

console.log('Flyers ignore the seal:');
{
  const st = createState(makeRng(1));
  st.wave = 10;
  buildWall(st, 14);
  const f = new Enemy(st, 'flyer', 'S1', st.routing['S1'], { hp: 1e5, speed: 3, bounty: 1 });
  st.enemies.push(f);
  const towers0 = st.towers.length;
  const lives0 = st.lives;
  const tLeak = tickUntil(st, 30, (s) => s.lives < lives0);
  check('flyer leaks straight over the wall', tLeak > 0, `${tLeak > 0 ? tLeak.toFixed(1) : '?'}s`);
  check('no tower harmed by the flyer', st.towers.length === towers0);
}

console.log('Reference build with the seal guard stays open (6 seeds):');
{
  // Obstacles can land in a wall's gap, so SOME serpentine cells would seal —
  // the sim's !wouldSealAt guard skips exactly those. Assert the guarded build
  // always ends with every route open (mirror of autoplay.js serpentineTargets).
  const serpentine = () => {
    const C = CONFIG.GRID_COLS, R = CONFIG.GRID_ROWS, t = [];
    let i = 0;
    for (let x = 3; x <= C - 5; x += 2) {
      const fromTop = (i % 2 === 0); i++;
      if (fromTop) { for (let y = 1; y <= R - 4; y++) t.push({ x, y }); }
      else { for (let y = 3; y <= R - 2; y++) t.push({ x, y }); }
    }
    return t;
  };
  let allOpen = true;
  for (const seed of [1337, 1, 7, 42, 99, 2024]) {
    const st = createState(makeRng(seed), seed);
    let skipped = 0;
    for (const c of serpentine()) {
      if (!canBuildAt(st, c.x, c.y)) continue;
      if (wouldSealAt(st, c.x, c.y)) { skipped++; continue; }   // the sim's guard
      addTower(st, 'wall', c.x, c.y);
    }
    if (st.siege) { allOpen = false; console.log('  sealed on seed', seed); }
    console.log(`  seed ${seed}: towers=${st.towers.length} guard-skipped=${skipped} siege=${st.siege}`);
  }
  check('guarded reference build never ends sealed', allOpen);
}

console.log(fails === 0 ? 'SIEGE_OK' : `SIEGE_FAIL (${fails})`);
