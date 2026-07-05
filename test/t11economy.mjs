// Review gap (testing): the headline maze-first economy rules — wall 100% vs
// tower 70% refund, Falcon air-only / Cannon land-only / Magic land+air, the
// level-3 cap, and escalating upgrade cost — were used by the sim but never
// asserted. Lock them in.
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize, cellCenter } from '../src/engine/grid.js';
import { createState } from '../src/game/state.js';
import { Enemy } from '../src/game/enemy.js';
import { addTower, upgradeCostFor } from '../src/game/tower.js';
import { sellRefund, tryUpgrade } from '../src/game/shop.js';
import { getLevel } from '../src/game/levels.js';
import { startWave, computeStats } from '../src/game/wave.js';
import { payWaveClear } from '../src/game/economy.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

function freshL8() {
  const lv = getLevel('l8');           // big enough board, has flyers
  setGridSize(lv.cols, lv.rows);
  const st = createState(makeRng(1), 1, lv);
  st.gold = 1e6;
  return st;
}
const parkEnemy = (st, type, cx, cy) => {
  const e = new Enemy(st, type, 'S1', st.routing['S1'], { hp: 1e6, speed: 1e-9, bounty: 1 });
  const c = cellCenter(cx, cy); e.x = c.x; e.y = c.y; e.cx = cx; e.cy = cy;
  st.enemies.push(e); return e;
};

console.log('Refunds: walls sell 100%, towers 70%:');
{
  const st = freshL8();
  const wall = addTower(st, 'wall', 3, 3);
  check('wall refund = full invested', sellRefund(wall) === Math.floor(wall.invested * CONFIG.WALL_REFUND) && sellRefund(wall) === wall.invested);
  const cannon = addTower(st, 'cannon', 3, 5);
  check('tower refund = 70%', sellRefund(cannon) === Math.floor(cannon.invested * CONFIG.SELL_REFUND));
  check('the two refund rates differ', CONFIG.WALL_REFUND === 1.0 && CONFIG.SELL_REFUND === 0.70);
}

console.log('Targeting: Falcon air-only, Cannon land-only, Magic both:');
{
  const st = freshL8();
  const falcon = addTower(st, 'falcon', 5, 5);
  parkEnemy(st, 'normal', 5, 6);          // ground in range
  const air = parkEnemy(st, 'flyer', 6, 5);   // air in range
  let c = falcon.candidates(st);
  check('falcon sees only air', c.length === 1 && c[0].e === air);

  const st2 = freshL8();
  const cannon = addTower(st2, 'cannon', 5, 5);
  const ground = parkEnemy(st2, 'normal', 5, 6);
  parkEnemy(st2, 'flyer', 6, 5);
  c = cannon.candidates(st2);
  check('cannon sees only ground', c.length === 1 && c[0].e === ground);

  const st3 = freshL8();
  const magic = addTower(st3, 'magic', 5, 5);
  parkEnemy(st3, 'normal', 5, 6);
  parkEnemy(st3, 'flyer', 6, 5);
  check('magic sees both', magic.candidates(st3).length === 2);
}

console.log('Roster caps at level 3; hidden legacy towers reach 4:');
{
  const st = freshL8();
  const cannon = addTower(st, 'cannon', 5, 5);
  check('L1 can upgrade', cannon.canUpgrade() === true);
  cannon.level = 3; cannon.refreshStats();
  check('L3 cannot upgrade (roster cap)', cannon.canUpgrade() === false);
  const legacy = addTower(st, 'archer', 7, 5);   // hidden: true
  legacy.level = 3; legacy.refreshStats();
  check('hidden tower still upgrades at L3', legacy.canUpgrade() === true);
}

console.log('Upgrades cost MORE than the tower (escalating):');
{
  const base = CONFIG.TOWERS.cannon.cost;     // 15
  check('L2 = 2x base', upgradeCostFor('cannon', 2) === Math.round(base * CONFIG.UPGRADE.costMultL2));
  check('L3 = 4x base', upgradeCostFor('cannon', 3) === Math.round(base * CONFIG.UPGRADE.costMultL3));
  check('each upgrade dearer than the build', upgradeCostFor('cannon', 2) > base && upgradeCostFor('cannon', 3) > upgradeCostFor('cannon', 2));
  // and tryUpgrade actually charges + caps
  const st = freshL8();
  const cannon = addTower(st, 'cannon', 5, 5);
  const g0 = st.gold;
  tryUpgrade(st, cannon, null);
  check('L1->L2 charged 2x base', g0 - st.gold === Math.round(base * CONFIG.UPGRADE.costMultL2) && cannon.level === 2);
}

console.log('U15 feel spike: levels 1-3 deterministic income bands (WC3 scarcity):');
{
  // Deterministic income = kill bounties + wave-clear bonuses (gold pinned to 0
  // before each clear so interest reads 0). Interest/early-start are
  // play-dependent extras on top; the band is the contract U9 must keep.
  const income = (id) => {
    const lv = getLevel(id);
    setGridSize(lv.cols, lv.rows);
    const st = createState(makeRng(1), 1, lv);
    let total = 0;
    for (let w = 1; w <= lv.waves.count; w++) {
      startWave(st, w);
      for (const sp of st.spawnQueue) total += computeStats(st, sp.type, w).bounty;
      st.spawnQueue = []; st.enemies = []; st.waveActive = false;
      st.gold = 0;
      total += payWaveClear(st, w).bonus;
    }
    return total;
  };
  // Playtest verdict 2026-07-06: cannons one-shot everything -> no challenge.
  // Contract: a wave-1 grunt survives one cannon hit; a wave-8 grunt survives two.
  {
    const lv = getLevel('l1');
    setGridSize(lv.cols, lv.rows);
    const st = createState(makeRng(1), 1, lv);
    const cannonHit = CONFIG.TOWERS.cannon.damage * CONFIG.DAMAGE_SCALE
      * CONFIG.DAMAGE_VS_ARMOR.siege.medium;
    check('L1 w1 grunt needs 2+ cannon shots', computeStats(st, 'normal', 1).hp > cannonHit,
      `hp=${computeStats(st, 'normal', 1).hp} hit=${cannonHit}`);
    check('L1 w8 grunt needs 3+ cannon shots', computeStats(st, 'normal', 8).hp > cannonHit * 2,
      `hp=${computeStats(st, 'normal', 8).hp}`);
  }
  const i1 = income('l1'), i2 = income('l2'), i3 = income('l3');
  check('level 1 income in the 280-400 band', i1 >= 280 && i1 <= 400, `i1=${i1}`);
  check('level 2 income scarce (300-600)', i2 >= 300 && i2 <= 600, `i2=${i2}`);
  check('level 3 income scarce (350-750)', i3 >= 350 && i3 <= 750, `i3=${i3}`);
  check('order-of-magnitude cut vs the old ~1400g level 1', i1 < 500, `i1=${i1}`);
}

console.log(fails === 0 ? 'ECONOMY_OK' : `ECONOMY_FAIL (${fails})`);
