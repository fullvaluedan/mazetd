// U6 combat mechanics: the five data-driven stats keys the U7 roster will
// grant via tiers/forks — income (gold per wave clear), executePct (finisher
// threshold), armorShred (timed matchup-component debuff), lineDamage/lineWidth
// (railgun corridor), stunDur (stun on hit). No live tower def carries any of
// them yet; synthetic defs are injected into CONFIG.TOWERS and deleted after
// (the t11economy U5 pattern).
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize, cellCenter } from '../src/engine/grid.js';
import { createState } from '../src/game/state.js';
import { Enemy, updateEnemies } from '../src/game/enemy.js';
import { addTower, getTowerStats, updateTowers } from '../src/game/tower.js';
import { tryUpgrade } from '../src/game/shop.js';
import { getLevel } from '../src/game/levels.js';
import { payWaveClear, onEnemyKilled, onEnemyLeaked } from '../src/game/economy.js';
import { dealDamage, applyLine } from '../src/game/projectile.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function freshL8() {
  const lv = getLevel('l8');
  setGridSize(lv.cols, lv.rows);
  const st = createState(makeRng(1), 1, lv);
  st.gold = 1e6;
  return st;
}
const parkEnemy = (st, type, cx, cy, stats = { hp: 1e6, speed: 1e-9, bounty: 1 }) => {
  const e = new Enemy(st, type, 'S1', st.routing['S1'], stats);
  const c = cellCenter(cx, cy); e.x = c.x; e.y = c.y; e.cx = cx; e.cy = cy;
  st.enemies.push(e); return e;
};

// Synthetic defs (deleted at the end). All chaos = neutral 1.0 matchups unless
// a spot-check overrides damageType.
const baseDef = {
  glyph: 'X', color: '#fff', cost: 40,
  damage: 10, range: 6, cooldown: 1, damageType: 'chaos',
  targetsAir: false, projectileSpeed: 10, blurb: 'test-only', branches: {},
};
CONFIG.TOWERS.tgold  = { ...baseDef, name: 'GoldTest', damage: 0, income: 7 };
CONFIG.TOWERS.ttinc  = { ...baseDef, name: 'TierIncomeTest', tiers: [{ costMult: 2, mods: { income: 5 } }] };
CONFIG.TOWERS.texec  = { ...baseDef, name: 'ExecTest', executePct: 0.2 };
CONFIG.TOWERS.tshred = { ...baseDef, name: 'ShredTest', armorShred: 0.5, armorShredDur: 1.0 };
CONFIG.TOWERS.tline  = { ...baseDef, name: 'LineTest', hitscan: true, lineDamage: true, lineWidth: 0.5, damage: 40 };
CONFIG.TOWERS.tstun  = { ...baseDef, name: 'StunTest', stunDur: 0.8 };
CONFIG.TOWERS.tplain = { ...baseDef, name: 'PlainTest' };

console.log('Income: paid once per wave clear, exactly the sum:');
{
  const st = freshL8();
  addTower(st, 'tgold', 3, 3);                    // income 7 from the base def
  const ti = addTower(st, 'ttinc', 3, 5);         // income 5 arrives at T2
  check('no income before its tier', ti.stats.income === 0);
  tryUpgrade(st, ti, null);
  check('tier mod grants income at T2 (mods merge)', ti.level === 2 && ti.stats.income === 5);
  addTower(st, 'cannon', 5, 5);                   // income-less bystander
  const g0 = st.gold;
  for (let i = 0; i < 50; i++) updateTowers(st, 0.1);   // 5s of tower ticks
  check('nothing paid mid-wave', st.gold === g0);
  const f0 = st.floaters.length;
  const pay = payWaveClear(st, 3);
  check('wave clear pays exactly the sum (7+5)', pay.income === 12, `income=${pay.income}`);
  check('gold delta = bonus + interest + income', st.gold - g0 === pay.bonus + pay.interest + pay.income);
  check('one gold floater per income tower', st.floaters.length === f0 + 2);
}

console.log('Execute: sub-threshold survivors die via the normal death path:');
{
  const st = freshL8();
  const sExec = getTowerStats('texec', 1, null);  // executePct 0.2, chaos
  const e = parkEnemy(st, 'normal', 5, 6, { hp: 1000, speed: 1e-9, bounty: 37 });
  e.maxHp = 1000; e.hp = 1000;
  dealDamage(st, e, 810, sExec);                  // -> 190 = 19% < 20%
  check('19% survivor executed (hp zeroed)', e.hp <= 0);
  const g0 = st.gold;
  updateEnemies(st, 0.001, onEnemyKilled, onEnemyLeaked);
  check('death resolved normally (bounty paid, removed)', st.gold - g0 === 37 && !st.enemies.includes(e));

  const e2 = parkEnemy(st, 'normal', 5, 7, { hp: 1000, speed: 1e-9, bounty: 1 });
  dealDamage(st, e2, 790, sExec);                 // -> 210 = 21% > 20%
  check('21% survivor lives', close(e2.hp, 210), `hp=${e2.hp}`);

  const b = parkEnemy(st, 'boss', 6, 6, { hp: 1000, speed: 1e-9, bounty: 1 });
  dealDamage(st, b, 810, sExec);                  // -> 190 = 19% but boss
  check('boss exempt from execute', close(b.hp, 190) && b.hp > 0, `hp=${b.hp}`);

  // matrix composition spot-checks (no NaN, matchup applies before the check)
  const fast = parkEnemy(st, 'fast', 7, 6, { hp: 1000, speed: 1e-9, bounty: 1 });   // light armor
  const d1 = dealDamage(st, fast, 540, { ...sExec, damageType: 'pierce' });         // 540*1.5=810 -> 19%
  check('pierce-vs-light hit composes with execute', Number.isFinite(d1) && d1 === 810 && fast.hp <= 0);
  const tank = parkEnemy(st, 'tank', 7, 7, { hp: 1000, speed: 1e-9, bounty: 1 });   // fortified armor
  const d2 = dealDamage(st, tank, 540, { ...sExec, damageType: 'siege' });          // 540*1.5=810 -> 19%
  check('siege-vs-fortified hit composes with execute', Number.isFinite(d2) && d2 === 810 && tank.hp <= 0);
}

console.log('Armor shred: matchup component scaled up while active, then reverts:');
{
  const st = freshL8();
  const sShred = getTowerStats('tshred', 1, null);   // +50% matchup for 1.0s
  const sPlain = getTowerStats('tplain', 1, null);
  const e = parkEnemy(st, 'normal', 5, 6);           // medium armor, chaos = 1.0
  const d0 = dealDamage(st, e, 100, sShred);
  check('the shred-carrying hit itself deals base', d0 === 100, `d0=${d0}`);
  const d1 = dealDamage(st, e, 100, sPlain);
  check('shredded enemy takes +50% from the same hit', d1 === 150, `d1=${d1}`);
  e.step(1.2, st);                                   // past the 1.0s duration
  check('debuff expired after its duration', e.shredTimer <= 0);
  const d2 = dealDamage(st, e, 100, sPlain);
  check('damage reverts after expiry', d2 === 100, `d2=${d2}`);
  dealDamage(st, e, 1, sShred);
  dealDamage(st, e, 1, sShred);                      // reapply: refresh, no stack
  const d3 = dealDamage(st, e, 100, sPlain);
  check('one instance only (reapply refreshes, no stack)', d3 === 150, `d3=${d3}`);

  // matrix composition spot-checks (magic bypasses shields, so the heavy
  // Warden's shield can't mask the multiplier)
  const hv = parkEnemy(st, 'shield', 6, 6);          // heavy armor
  dealDamage(st, hv, 1, sShred);
  const m1 = dealDamage(st, hv, 100, { ...sPlain, damageType: 'magic' });   // 1.5*1.5
  check('magic-vs-heavy under shred = 225', Number.isFinite(m1) && close(m1, 225), `m1=${m1}`);
  const ft = parkEnemy(st, 'tank', 6, 7);            // fortified armor
  dealDamage(st, ft, 1, sShred);
  const m2 = dealDamage(st, ft, 100, { ...sPlain, damageType: 'magic' });   // 0.5*1.5
  check('magic-vs-fortified under shred = 75', Number.isFinite(m2) && close(m2, 75), `m2=${m2}`);
}

console.log('Line damage: corridor along the ray, range- and air-gated:');
{
  const st = freshL8();
  const t = addTower(st, 'tline', 5, 5);   // range 6, width 0.5 cells, no air
  const a = parkEnemy(st, 'normal', 5, 6);
  const b = parkEnemy(st, 'normal', 5, 7);
  const c = parkEnemy(st, 'normal', 5, 8);      // the aimed target
  const off = parkEnemy(st, 'normal', 7, 7);    // 2 cells off-axis
  const far = parkEnemy(st, 'normal', 5, 12);   // colinear but 7 cells out
  const fly = parkEnemy(st, 'flyer', 5, 7);     // on the line, airborne
  const hp0 = [a, b, c, off, far, fly].map((x) => x.hp);
  applyLine(st, t, c, t.stats);
  const dmg = t.stats.damage;                   // chaos vs medium = 1.0, no boosts
  check('three colinear enemies hit for full damage',
    close(a.hp, hp0[0] - dmg) && close(b.hp, hp0[1] - dmg) && close(c.hp, hp0[2] - dmg));
  check('off-axis enemy beyond width missed', off.hp === hp0[3]);
  check('colinear enemy beyond range missed', far.hp === hp0[4]);
  check('air not hit without targetsAir', fly.hp === hp0[5]);
  check('beam visual pushed', st.effects.some((fx) => fx.kind === 'beam'));
}

console.log('Stun on hit: frozen for the stated duration, then moves:');
{
  const st = freshL8();
  const sStun = getTowerStats('tstun', 1, null);   // 0.8s
  const e = parkEnemy(st, 'normal', 5, 6, { hp: 1e6, speed: 1.0, bounty: 1 });
  e.advanceTarget(st);                             // aim at a real neighbour
  dealDamage(st, e, 1, sStun);
  check('stun timer set to stats.stunDur', e.stunTimer === 0.8);
  const x0 = e.x, y0 = e.y;
  e.step(0.4, st);
  check('no movement at 0.4s', e.x === x0 && e.y === y0);
  e.step(0.3, st);
  check('still frozen at 0.7s', e.x === x0 && e.y === y0);
  e.step(0.2, st);                                 // 0.9s total: stun over
  check('moves once the stun expires', e.x !== x0 || e.y !== y0,
    `pos=(${e.x},${e.y}) target=(${e.targetCenter.x},${e.targetCenter.y})`);
}

delete CONFIG.TOWERS.tgold;
delete CONFIG.TOWERS.ttinc;
delete CONFIG.TOWERS.texec;
delete CONFIG.TOWERS.tshred;
delete CONFIG.TOWERS.tline;
delete CONFIG.TOWERS.tstun;
delete CONFIG.TOWERS.tplain;

console.log(fails === 0 ? 'MECHANICS_OK' : `MECHANICS_FAIL (${fails})`);
