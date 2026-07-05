// Phase M2 checks — Beacon aura tower (cache, stacking, application, saves).
import { CONFIG, TICK_DT } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { createState } from '../src/game/state.js';
import { Enemy } from '../src/game/enemy.js';
import { addTower, getTowerStats, recomputeAuras } from '../src/game/tower.js';
import { applyTowerHit } from '../src/game/projectile.js';
import { tryUpgrade, trySell } from '../src/game/shop.js';
import { cellCenter } from '../src/engine/grid.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };
const enemyAt = (st, type, cx, cy, hp) => {
  const e = new Enemy(st, type, 'S1', st.routing['S1'], { hp, speed: 1e-6, bounty: 1 });
  const c = cellCenter(cx, cy); e.x = c.x; e.y = c.y; e.cx = cx; e.cy = cy; st.enemies.push(e); return e;
};

console.log('Beacon stats & non-attacking:');
{
  const s1 = getTowerStats('beacon', 1, null);
  check('L1 aura 10%/5%/r2.0', s1.auraDmg === 0.10 && s1.auraSpeed === 0.05 && s1.auraRange === 2.0);
  check('L3 aura 20%/10%/r2.8', (() => { const s = getTowerStats('beacon', 3, null); return s.auraDmg === 0.20 && s.auraRange === 2.8; })());
  check('L4A command 35% dmg', getTowerStats('beacon', 4, 'A').auraDmg === 0.35);
  check('L4B haste 25% speed', getTowerStats('beacon', 4, 'B').auraSpeed === 0.25);
  check('damage stays 0', s1.damage === 0);

  const st = createState(makeRng(1));
  const b = addTower(st, 'beacon', 10, 9);
  enemyAt(st, 'normal', 10, 10, 1e6);
  b.update(TICK_DT, st);
  check('beacon never fires', st.projectiles.length === 0 && st.effects.length === 0);
}

console.log('Aura cache & application:');
{
  const st = createState(makeRng(1));
  const archer = addTower(st, 'archer', 10, 9);
  const e = enemyAt(st, 'normal', 11, 10, 1e6);

  const h0 = e.hp; applyTowerHit(st, e, archer.stats); const d0 = h0 - e.hp;
  check('no beacon: no buff', archer.buffDmg === 0 && archer.stats.buffDmg === 0);

  addTower(st, 'beacon', 11, 9);
  check('buff cached on build', archer.buffDmg === 0.10 && archer.stats.buffDmg === 0.10);
  const h1 = e.hp; applyTowerHit(st, e, archer.stats); const d1 = h1 - e.hp;
  check('hit damage +10%', Math.abs(d1 - d0 * 1.10) < 0.01, `${d0} -> ${d1}`);

  // attack-speed: cooldown / (1 + 0.05)
  archer.cooldownLeft = 0;
  archer.update(TICK_DT, st);
  check('cooldown / 1.05', Math.abs(archer.cooldownLeft - archer.stats.cooldown / 1.05) < 1e-9, archer.cooldownLeft.toFixed(3));

  // out-of-range tower gets nothing (beacon r2.0 from (11,9))
  const far = addTower(st, 'archer', 16, 9);
  check('out of radius: no buff', far.buffDmg === 0);
}

console.log('Stacking = per-stat max, never sum:');
{
  const st = createState(makeRng(1));
  const archer = addTower(st, 'archer', 10, 9);
  addTower(st, 'beacon', 11, 9);
  addTower(st, 'beacon', 9, 9);
  check('two L1 beacons -> 0.10 not 0.20', archer.buffDmg === 0.10);

  // mixed levels: strongest wins
  const st2 = createState(makeRng(1));
  st2.gold = 1e6;
  const a2 = addTower(st2, 'archer', 10, 9);
  addTower(st2, 'beacon', 11, 9);
  const b2 = addTower(st2, 'beacon', 9, 9);
  tryUpgrade(st2, b2); tryUpgrade(st2, b2);   // L3: 0.20
  check('strongest beacon wins', a2.buffDmg === 0.20 && a2.stats.buffDmg === 0.20);
}

console.log('Upgrades & sells refresh the cache:');
{
  const st = createState(makeRng(1));
  st.gold = 1e6;
  const archer = addTower(st, 'archer', 10, 9);
  const beacon = addTower(st, 'beacon', 11, 9);

  tryUpgrade(st, beacon); tryUpgrade(st, beacon);       // beacon -> L3
  check('beacon L3 -> buff 0.20', archer.buffDmg === 0.20);
  tryUpgrade(st, beacon, 'A');                          // -> L4 Command
  check('L4A -> 0.35 dmg + 0.10 speed kept', archer.buffDmg === 0.35 && archer.buffSpeed === 0.10);

  tryUpgrade(st, archer);                               // archer L2 replaces stats
  check('archer upgrade keeps stats.buffDmg', archer.stats.buffDmg === 0.35);

  trySell(st, beacon);
  check('sell beacon -> buff drops', archer.buffDmg === 0 && archer.stats.buffDmg === 0);
}

console.log('Save round-trip with a beacon:');
{
  const store = new Map();
  global.localStorage = { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadSnapshot, applySnapshot } = await import('../src/game/save.js');
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  st.gold = 1e6;
  addTower(st, 'archer', 10, 9);
  const b = addTower(st, 'beacon', 11, 9);
  tryUpgrade(st, b); tryUpgrade(st, b);   // L3
  saveGame(st);
  const st2 = applySnapshot(loadSnapshot());
  const a2 = st2.towers.find((t) => t.type === 'archer');
  const b2 = st2.towers.find((t) => t.type === 'beacon');
  check('beacon level restored', b2 && b2.level === 3);
  check('buff recomputed on load', a2 && a2.buffDmg === 0.20 && a2.stats.buffDmg === 0.20);
}

console.log(fails === 0 ? 'AURA_OK' : `AURA_FAIL (${fails})`);
