// The headline maze-first economy rules — wall 100% vs tower 70% refund,
// air/ground gating per roster def, tier caps, escalating upgrade cost — plus
// the U7 roster contract: all 8 towers buildable and firing headlessly, the
// gold tower's no-attack/income path, hidden-legacy save compat (magic/falcon
// in a v2 Endless save), the unlock schedule, and the radial ring geometry
// bar (>=44px hit areas, >=8px apart, fits a 375px viewport).
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize, cellCenter } from '../src/engine/grid.js';
import { createState } from '../src/game/state.js';
import { Enemy, updateEnemies } from '../src/game/enemy.js';
import { addTower, upgradeCostFor, getTowerStats, updateTowers } from '../src/game/tower.js';
import { updateProjectiles } from '../src/game/projectile.js';
import { sellRefund, tryBuild, tryUpgrade } from '../src/game/shop.js';
import { buildSnapshot, applySnapshot } from '../src/game/save.js';
import { getLevel, towersUnlockedAt, UNLOCK_SCHEDULE } from '../src/game/levels.js';
import { startWave, computeStats } from '../src/game/wave.js';
import { payWaveClear, onEnemyKilled, onEnemyLeaked } from '../src/game/economy.js';
import { ringRadiusFor, RING_ITEM, RING_GAP } from '../src/ui/radial.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

function freshL8() {
  const lv = getLevel('l8');           // big enough board, has flyers
  setGridSize(lv.cols, lv.rows);
  const st = createState(makeRng(1), 1, lv);
  st.gold = 1e6;
  return st;
}
const parkEnemy = (st, type, cx, cy, stats = null) => {
  const e = new Enemy(st, type, 'S1', st.routing['S1'], stats || { hp: 1e6, speed: 1e-9, bounty: 1 });
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

console.log('Targeting: air/ground gating per roster def:');
{
  // land-only: cannon (siege) + poison (DoT)
  for (const id of ['cannon', 'poison']) {
    const st = freshL8();
    const t = addTower(st, id, 5, 5);
    const ground = parkEnemy(st, 'normal', 5, 6);
    parkEnemy(st, 'flyer', 6, 5);
    const c = t.candidates(st);
    check(`${id} sees only ground`, c.length === 1 && c[0].e === ground);
  }
  // land+air: arrow, frost, sniper, lightning
  for (const id of ['arrow', 'frost', 'sniper', 'lightning']) {
    const st = freshL8();
    const t = addTower(st, id, 5, 5);
    parkEnemy(st, 'normal', 5, 6);
    parkEnemy(st, 'flyer', 6, 5);
    check(`${id} sees both land and air`, t.candidates(st).length === 2);
  }
  // hidden legacy (retired campaign towers keep their exact gating)
  const st = freshL8();
  const falcon = addTower(st, 'falcon', 5, 5);
  parkEnemy(st, 'normal', 5, 6);
  const air = parkEnemy(st, 'flyer', 6, 5);
  const c = falcon.candidates(st);
  check('legacy falcon sees only air', c.length === 1 && c[0].e === air);
  const st3 = freshL8();
  const magic = addTower(st3, 'magic', 5, 5);
  parkEnemy(st3, 'normal', 5, 6);
  parkEnemy(st3, 'flyer', 6, 5);
  check('legacy magic sees both', magic.candidates(st3).length === 2);
}

console.log('Caps: roster reaches L5; hidden legacy keep their old caps:');
{
  const st = freshL8();
  const cannon = addTower(st, 'cannon', 5, 5);
  check('L1 can upgrade', cannon.canUpgrade() === true);
  cannon.level = 5; cannon.refreshStats();
  check('roster caps at L5 (4 tiers + base)', cannon.canUpgrade() === false);
  const legacy = addTower(st, 'archer', 7, 5);   // hidden, L4 branch tier
  legacy.level = 3; legacy.refreshStats();
  check('hidden legacy archer still upgrades at L3', legacy.canUpgrade() === true);
  legacy.level = 4; legacy.refreshStats();
  check('hidden legacy archer caps at L4', legacy.canUpgrade() === false);
  const demoted = addTower(st, 'magic', 9, 5);   // demoted campaign tower, branchless
  demoted.level = 3; demoted.refreshStats();
  check('demoted magic keeps its old L3 cap', demoted.canUpgrade() === false);
}

console.log('Upgrades cost MORE than the tower (2.5/5/10/20 roster curve):');
{
  const base = CONFIG.TOWERS.cannon.cost;     // 15
  check('L2 = 2.5x base', upgradeCostFor('cannon', 2) === Math.round(base * 2.5));
  check('L3 = 5x base', upgradeCostFor('cannon', 3) === base * 5);
  check('L4 = 10x, L5 = 20x', upgradeCostFor('cannon', 4) === base * 10 && upgradeCostFor('cannon', 5) === base * 20);
  check('each upgrade dearer than the build', upgradeCostFor('cannon', 2) > base && upgradeCostFor('cannon', 3) > upgradeCostFor('cannon', 2));
  // legacy defs stay on the old CONFIG.UPGRADE chain
  const lbase = CONFIG.TOWERS.cannonL.cost;
  check('legacy clone still 2x/4x', upgradeCostFor('cannonL', 2) === Math.round(lbase * CONFIG.UPGRADE.costMultL2)
    && upgradeCostFor('cannonL', 3) === Math.round(lbase * CONFIG.UPGRADE.costMultL3));
  // and tryUpgrade actually charges + caps
  const st = freshL8();
  const cannon = addTower(st, 'cannon', 5, 5);
  const g0 = st.gold;
  tryUpgrade(st, cannon, null);
  check('L1->L2 charged 2.5x base', g0 - st.gold === Math.round(base * 2.5) && cannon.level === 2);
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
  // Playtest verdict 2026-07-06: starter towers must not one-shot -> no
  // challenge otherwise. Contract, kept on the CHEAPEST starter damage tower
  // (arrow since U7): a wave-1 grunt survives one hit; a wave-8 grunt two.
  {
    const lv = getLevel('l1');
    setGridSize(lv.cols, lv.rows);
    const st = createState(makeRng(1), 1, lv);
    const arrowHit = CONFIG.TOWERS.arrow.damage * CONFIG.DAMAGE_SCALE
      * CONFIG.DAMAGE_VS_ARMOR.pierce.medium;
    check('L1 w1 grunt needs 2+ arrow shots', computeStats(st, 'normal', 1).hp > arrowHit,
      `hp=${computeStats(st, 'normal', 1).hp} hit=${arrowHit}`);
    check('L1 w8 grunt needs 3+ arrow shots', computeStats(st, 'normal', 8).hp > arrowHit * 2,
      `hp=${computeStats(st, 'normal', 8).hp}`);
  }
  const i1 = income('l1'), i2 = income('l2'), i3 = income('l3');
  check('level 1 income in the 280-400 band', i1 >= 280 && i1 <= 400, `i1=${i1}`);
  check('level 2 income scarce (300-600)', i2 >= 300 && i2 <= 600, `i2=${i2}`);
  check('level 3 income scarce (350-750)', i3 >= 350 && i3 <= 750, `i3=${i3}`);
  check('order-of-magnitude cut vs the old ~1400g level 1', i1 < 500, `i1=${i1}`);

  // U20 mid/late spot checks: per-level bounty/waveclear mults now cover 4-20.
  // Bands bracket the tuned values (l8=1378, l14=2946, l20=8876) with room for
  // future wave-composition drift but not for a return of the fat economy
  // (l20 under the old mult-free defaults paid ~18k). Boss levels (10/13/15/
  // 17/18/20) carry deliberately higher bountyMult: the income pays for the
  // boss-killing DPS; l20 is the extreme (bountyMult 0.9 + two boss bounties).
  const i8 = income('l8'), i14 = income('l14'), i20 = income('l20');
  check('level 8 income in the 1100-1700 band', i8 >= 1100 && i8 <= 1700, `i8=${i8}`);
  check('level 14 income in the 2400-3600 band', i14 >= 2400 && i14 <= 3600, `i14=${i14}`);
  check('level 20 income in the 7000-11000 band', i20 >= 7000 && i20 <= 11000, `i20=${i20}`);
}

console.log('U5 tier machinery: per-tier tables, forks only where declared:');
{
  // Synthetic defs on the NEW roster cost curve (2.5/5/10/20 — U7's towers
  // will declare tables like these; live towers stay on the legacy table).
  // One single-signature tower (capability at T3, fork-less T5) and one that
  // forks at T5. Injected for this block only, deleted after the round-trip.
  const baseDef = {
    glyph: 'X', color: '#fff', cost: 40,
    damage: 10, range: 2.0, cooldown: 1.0, damageType: 'pierce',
    targetsAir: true, projectileSpeed: 10,
    blurb: 'test-only', branches: {},
  };
  CONFIG.TOWERS.ttest = {
    ...baseDef, name: 'TierTest',
    tiers: [
      { costMult: 2.5, mods: { damageMult: 2, cooldownMult: 0.5 } },   // T2
      { costMult: 5,   mods: { damageMult: 2, splashRadius: 1.2 } },   // T3 capability
      { costMult: 10,  mods: { damageMult: 2 } },                      // T4
      { costMult: 20,  mods: { damageMult: 2, multishot: 3 } },        // T5 signature, no fork
    ],
  };
  CONFIG.TOWERS.ttestFork = {
    ...baseDef, name: 'ForkTest',
    tiers: [
      { costMult: 2.5, mods: { damageMult: 2 } },
      { costMult: 5,   mods: { damageMult: 2 } },
      { costMult: 10,  mods: { damageMult: 2 } },
      { costMult: 20,  forks: {
        A: { name: 'Alpha', desc: '+200% dmg', mods: { damageMult: 3 } },
        B: { name: 'Beta',  desc: 'slows',     mods: { slowPct: 0.4, slowDur: 2 } },
      } },
    ],
  };
  CONFIG.TOWERS.ttestShort = { ...baseDef, name: 'ShortTest', tiers: [{ costMult: 2.5 }] };

  const base = CONFIG.TOWERS.ttest.cost;
  check('tier cost curve 2.5/5/10/20',
    upgradeCostFor('ttest', 2) === Math.round(base * 2.5)
    && upgradeCostFor('ttest', 3) === base * 5
    && upgradeCostFor('ttest', 4) === base * 10
    && upgradeCostFor('ttest', 5) === base * 20);

  // per-tier mods land at their tier, not before
  check('T2 cooldownMult applies', getTowerStats('ttest', 2, null).cooldown === 0.5);
  check('T3 capability unlocks at T3, not T2',
    getTowerStats('ttest', 2, null).splashRadius === 0
    && getTowerStats('ttest', 3, null).splashRadius === 1.2);
  check('T5 signature only at T5',
    getTowerStats('ttest', 4, null).multishot === 1
    && getTowerStats('ttest', 5, null).multishot === 3);
  check('damage stacks 2x per tier',
    getTowerStats('ttest', 5, null).damage === 10 * 16 * CONFIG.DAMAGE_SCALE);

  const st = freshL8();
  const t = addTower(st, 'ttest', 5, 5);
  for (let lvl = 2; lvl <= 5; lvl++) {
    const noFork = t.forkChoices() === null;
    check(`L${lvl - 1}->L${lvl} straight (no fork offered)`, noFork && tryUpgrade(st, t, null) && t.level === lvl);
  }
  check('caps at L5 (tiers.length + 1)', t.canUpgrade() === false && t.nextUpgradeCost() === 0);
  check('invested = 38.5x base through T5', t.invested === base * 38.5, `${t.invested}`);

  const f = addTower(st, 'ttestFork', 7, 5);
  tryUpgrade(st, f, null); tryUpgrade(st, f, null); tryUpgrade(st, f, null);   // -> L4
  check('fork offered exactly at the declaring tier',
    f.level === 4 && f.forkChoices() && Object.keys(f.forkChoices()).join('') === 'AB');
  check('fork tier refuses a branchless upgrade', tryUpgrade(st, f, null) === false && f.level === 4);
  tryUpgrade(st, f, 'B');
  check('branch sticks at the fork tier', f.level === 5 && f.branch === 'B' && f.stats.slowPct === 0.4);

  const sh = addTower(st, 'ttestShort', 9, 5);
  tryUpgrade(st, sh, null);
  check('short table caps early (1 tier -> L2 max)', sh.level === 2 && sh.canUpgrade() === false);

  // tier + branch survive the v3 save round-trip
  const snap = buildSnapshot(st);
  check('snapshot is v3', snap.v === 3);
  const st2 = applySnapshot(snap);
  const f2 = st2.towers.find((x) => x.type === 'ttestFork');
  const t2 = st2.towers.find((x) => x.type === 'ttest');
  check('tier + branch survive the round-trip',
    f2 && f2.level === 5 && f2.branch === 'B' && f2.stats.slowPct === 0.4);
  check('single-signature tier survives the round-trip',
    t2 && t2.level === 5 && t2.stats.multishot === 3 && !t2.canUpgrade());

  delete CONFIG.TOWERS.ttest;
  delete CONFIG.TOWERS.ttestFork;
  delete CONFIG.TOWERS.ttestShort;
}

console.log('U7 roster: every damage tower builds and gets a kill headlessly:');
{
  // land towers see a grunt, land-only ones would ignore a flyer (gated above)
  for (const id of ['arrow', 'cannon', 'frost', 'poison', 'sniper', 'lightning']) {
    const st = freshL8();
    const t = tryBuild(st, id, 5, 5);
    const e = parkEnemy(st, 'normal', 5, 6, { hp: 5, speed: 1e-9, bounty: 3 });
    let killed = false;
    for (let i = 0; i < 200 && !killed; i++) {
      updateTowers(st, 0.05);
      updateProjectiles(st, 0.05);
      updateEnemies(st, 0.05, onEnemyKilled, onEnemyLeaked);
      killed = !st.enemies.includes(e);
    }
    check(`${id} builds and kills`, !!t && killed);
  }
  // support: builds, never fires, buffs the neighbour
  const st = freshL8();
  const sup = tryBuild(st, 'support', 5, 5);
  const arrow = addTower(st, 'arrow', 6, 5);
  check('support builds and buffs the adjacent tower', !!sup && arrow.buffDmg === 0.10 && arrow.stats.buffDmg === 0.10);
  check('support T5A/B fork declared (dmg aura vs income)', (() => {
    const f = CONFIG.TOWERS.support.tiers[3].forks;
    return f && f.A.mods.auraDmg === 0.45 && f.B.mods.income === 25;
  })());
}

console.log('U7 gold tower: never targets, pays income per wave:');
{
  const st = freshL8();
  const g = tryBuild(st, 'gold', 5, 5);
  const e = parkEnemy(st, 'normal', 5, 6, { hp: 50, speed: 1e-9, bounty: 1 });
  check('gold builds', !!g);
  check('gold never appears in targeting candidates', g.candidates(st).length === 0);
  const hp0 = e.hp;
  for (let i = 0; i < 100; i++) { updateTowers(st, 0.1); updateProjectiles(st, 0.1); }
  check('gold never fires (no projectiles, target unhurt)', st.projectiles.length === 0 && e.hp === hp0);
  st.waveActive = false;
  const pay = payWaveClear(st, 1);
  check('gold pays its income at wave clear', pay.income === CONFIG.TOWERS.gold.income, `income=${pay.income}`);
  check('gold T5 signature: large income', getTowerStats('gold', 5, null).income === 100);
}

console.log('U7 unlock schedule: roster spreads across levels 1-13:');
{
  check('L1 = wall + arrow only', towersUnlockedAt(1).join() === 'wall,arrow');
  const gates = { cannon: 2, frost: 3, poison: 5, sniper: 7, lightning: 9, support: 11, gold: 13 };
  for (const [id, lvl] of Object.entries(gates)) {
    check(`${id} unlocks exactly at level ${lvl}`,
      towersUnlockedAt(lvl).includes(id) && !towersUnlockedAt(lvl - 1).includes(id));
  }
  check('full 9-item roster by level 13', towersUnlockedAt(13).length === 9);
  check('schedule ids all exist and are visible', UNLOCK_SCHEDULE.every((u) => {
    const d = CONFIG.TOWERS[u.tower];
    return d && !d.hidden;
  }));
}

console.log('U7 ring geometry: 9 items, >=44px hit areas, >=8px apart, 375px-safe:');
{
  const n = Object.values(CONFIG.TOWERS).filter((d) => !d.hidden).length;
  check('build ring shows 9 items (wall + 8 towers)', n === 9);
  const R = ringRadiusFor(n);
  const chord = 2 * R * Math.sin(Math.PI / n);   // adjacent item center distance
  check('hit area >=44 CSS px', RING_ITEM >= 44, `${RING_ITEM}px`);
  check('adjacent hit areas >=8px apart', chord - RING_ITEM >= RING_GAP, `gap=${(chord - RING_ITEM).toFixed(1)}`);
  check('one ring fits a 375px viewport (no two-ring fallback needed)',
    2 * (R + RING_ITEM / 2 + 6) <= 375, `${2 * (R + RING_ITEM / 2 + 6)}px`);
}

console.log('U7 legacy compat: a v2 Endless save with magic + falcon loads:');
{
  const snap = {
    v: 2, levelId: 'endless', seed: 1337, wave: 12, maxWave: 12, gold: 500, lives: 15,
    autoStart: false, repairUses: 0, reviveUsed: false, heroUpgrades: {}, towerBoosts: {},
    hero: null,
    towers: [
      { type: 'magic',  cx: 3, cy: 3, level: 3, branch: null, targetMode: 'first', invested: 154, hp: 100 },
      { type: 'falcon', cx: 5, cy: 3, level: 2, branch: null, targetMode: 'first', invested: 54,  hp: 80 },
      { type: 'cannon', cx: 7, cy: 3, level: 1, branch: null, targetMode: 'first', invested: 15,  hp: 60 },
      { type: 'wall',   cx: 9, cy: 3, level: 1, branch: null, targetMode: 'first', invested: 5,   hp: 160 },
    ],
  };
  const st = applySnapshot(snap);
  const m = st.towers.find((t) => t.type === 'magic');
  const f = st.towers.find((t) => t.type === 'falcon');
  check('all four v2 towers restored', st.towers.length === 4 && m && f);
  check('legacy magic keeps its old L3 cap', m.level === 3 && !m.canUpgrade());
  check('legacy falcon still air-only with live stats', f.stats.airOnly === true && f.stats.damage > 0);
  check('gold/lives restored', st.gold === 500 && st.lives === 15);
}

console.log(fails === 0 ? 'ECONOMY_OK' : `ECONOMY_FAIL (${fails})`);
