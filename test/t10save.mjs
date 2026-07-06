// Phase M3 checks — save round-trip + v1/v2 backward compatibility, plus the
// U5 version gate: snapshots write v3 and anything newer than the client
// refuses to load (returns null) instead of half-loading.
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

console.log('v3 round-trip with a damaged wall + beacon:');
{
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  st.gold = 1e6;
  const a = addTower(st, 'archer', 10, 9);
  const b = addTower(st, 'beacon', 11, 9);
  tryUpgrade(st, b);                       // L2 beacon
  a.hp = Math.floor(a.maxHp * 0.4);        // chewed wall
  saveGame(st);

  const snap = loadSnapshot();
  check('snapshot is v3', snap.v === 3);
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

console.log('v2 snapshots still load; towers keep their caps:');
{
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  st.gold = 1e6;
  const c = addTower(st, 'cannon', 12, 9);
  const a = addTower(st, 'archer', 10, 9);
  tryUpgrade(st, c); tryUpgrade(st, c);        // L3 roster cannon
  a.level = 4; a.branch = 'A'; a.refreshStats(); // L4 branched legacy archer
  const snap = buildSnapshot(st);
  snap.v = 2;                                  // exactly what a tester's save looks like
  const st2 = applySnapshot(snap);
  const c2 = st2.towers.find((t) => t.type === 'cannon');
  const a2 = st2.towers.find((t) => t.type === 'archer');
  // U7: cannon is a roster tower on the 5-tier table now — a v2 save's L3
  // cannon loads intact and may keep upgrading (T4/T5 exist); the old L3 cap
  // lives on in the hidden legacy defs (cannonL, magic, falcon).
  check('v2 roster tower loads at L3, upgrades onward', c2.level === 3 && c2.canUpgrade());
  check('v2 legacy tower at its L4 cap, branch kept', a2.level === 4 && a2.branch === 'A' && !a2.canUpgrade());
}

console.log('future-versioned snapshots refuse to load:');
{
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  const snap = buildSnapshot(st);
  snap.v = 99;
  store.set('mazecore_save_v1', JSON.stringify(snap));
  check('v99 save returns null', loadSnapshot() === null);
  store.delete('mazecore_save_v1');
}

console.log(fails === 0 ? 'SAVE_OK' : `SAVE_FAIL (${fails})`);
