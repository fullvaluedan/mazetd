// Phase M3 checks — save v2 (tower hp) + v1 backward compatibility.
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { createState } from '../src/game/state.js';
import { addTower } from '../src/game/tower.js';
import { tryUpgrade } from '../src/game/shop.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

const store = new Map();
global.localStorage = { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { saveGame, loadSnapshot, applySnapshot, buildSnapshot } = await import('../src/game/save.js');

console.log('v2 round-trip with a damaged wall + beacon:');
{
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  st.gold = 1e6;
  const a = addTower(st, 'archer', 10, 9);
  const b = addTower(st, 'beacon', 11, 9);
  tryUpgrade(st, b);                       // L2 beacon
  a.hp = Math.floor(a.maxHp * 0.4);        // chewed wall
  saveGame(st);

  const snap = loadSnapshot();
  check('snapshot is v2', snap.v === 2);
  const st2 = applySnapshot(snap);
  const a2 = st2.towers.find((t) => t.type === 'archer');
  const b2 = st2.towers.find((t) => t.type === 'beacon');
  check('damage survives the round-trip', Math.abs(a2.hp - Math.ceil(a.hp)) <= 1, `${a.hp} -> ${a2.hp}`);
  check('maxHp rebuilt from invested', a2.maxHp === CONFIG.TOWER_HP.base + a2.invested * CONFIG.TOWER_HP.perGold);
  check('beacon level + aura survive', b2.level === 2 && a2.buffDmg === CONFIG.TOWERS.beacon.auraByLevel[1].dmg);
}

console.log('v1 snapshots (no hp field) load at full HP:');
{
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  st.gold = 1e6;
  addTower(st, 'cannon', 12, 9);
  const snap = buildSnapshot(st);
  snap.v = 1;
  for (const t of snap.towers) delete t.hp;   // exactly what a pre-siege save looks like
  const st2 = applySnapshot(snap);
  const c2 = st2.towers.find((t) => t.type === 'cannon');
  check('v1 tower at full HP', c2.hp === c2.maxHp, `${c2.hp}/${c2.maxHp}`);
}

console.log(fails === 0 ? 'SAVE_OK' : `SAVE_FAIL (${fails})`);
