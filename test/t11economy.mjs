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
import { earlyStartCap, payEarlyStart, payWaveClear, onEnemyKilled, onEnemyLeaked } from '../src/game/economy.js';
import { ringRadiusFor, RING_ITEM, RING_GAP } from '../src/ui/radial.js';
import { Radial } from '../src/ui/radial.js';
import { installFakeDom } from './fakedom.mjs';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

function freshL8(mode = 'expert', rich = true) {
  const lv = getLevel('l8');           // big enough board, has flyers
  setGridSize(lv.cols, lv.rows);
  const st = createState(makeRng(1), 1, lv, { difficultyMode: mode });
  if (rich) st.gold = 1e6;
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

console.log('Difficulty modes: expert baseline, normal +40% gold/+20% tower dmg, easy +100% gold/+50% tower dmg:');
{
  const expert = freshL8('expert', false);
  const normal = freshL8('normal', false);
  const easy = freshL8('easy', false);
  const startBase = getLevel('l8').startGold != null ? getLevel('l8').startGold : CONFIG.START_GOLD;
  check('expert keeps baseline start gold', expert.gold === startBase, `${expert.gold}`);
  check('normal starts with 40% more gold', normal.gold === Math.round(startBase * 1.4), `${normal.gold}`);
  check('easy starts with 100% more gold', easy.gold === Math.round(startBase * 2), `${easy.gold}`);

  const eStats = getTowerStats('arrow', 1, null, 'expert');
  const nStats = getTowerStats('arrow', 1, null, 'normal');
  const hStats = getTowerStats('arrow', 1, null, 'easy');
  check('normal tower damage is +20%', Math.abs(nStats.damage - eStats.damage * 1.2) < 1e-9, `${eStats.damage} -> ${nStats.damage}`);
  check('easy tower damage is +50%', Math.abs(hStats.damage - eStats.damage * 1.5) < 1e-9, `${eStats.damage} -> ${hStats.damage}`);

  const bountyEnemy = { bounty: 10, x: 0, y: 0, radius: 0, color: '#fff', boss: false, maxHp: 100 };
  const pay = (st) => {
    st.gold = 0;
    onEnemyKilled(st, bountyEnemy);
    return st.gold;
  };
  const normalKill = pay(normal);
  const easyKill = pay(easy);
  check('normal kill bounty is +40%', normalKill === 14, `${normalKill}`);
  check('easy kill bounty is +100%', easyKill === 20, `${easyKill}`);

  const wavePay = (st) => {
    st.gold = 0;
    st.waveActive = false;
    return payWaveClear(st, 1);
  };
  const expertWave = wavePay(expert);
  const normalWave = wavePay(normal);
  const easyWave = wavePay(easy);
  check('normal wave-clear bonus is +40%', normalWave.bonus === Math.ceil(expertWave.bonus * 1.4), `${expertWave.bonus} -> ${normalWave.bonus}`);
  check('easy wave-clear bonus is +100%', easyWave.bonus === Math.ceil(expertWave.bonus * 2), `${expertWave.bonus} -> ${easyWave.bonus}`);
}

console.log('Early-wave bonus: immediate reward decays predictably over build time:');
{
  const st = freshL8('expert', false);
  st.gold = 0;
  const wave = 3;
  const cap = earlyStartCap(wave);
  check('later waves advertise their increasing immediate cap', cap === CONFIG.WAVE_CALL_BONUS_BASE + CONFIG.WAVE_CALL_BONUS_PER_WAVE * 2, `${cap}`);
  check('calling immediately pays the full cap', payEarlyStart(st, CONFIG.BUILD_TIMER, wave) === cap && st.gold === cap, `${st.gold}`);
  st.gold = 0;
  check('waiting five seconds loses five gold at the configured rate', payEarlyStart(st, CONFIG.BUILD_TIMER - 5, wave) === Math.max(0, cap - 5), `${st.gold}`);
  st.gold = 0;
  const expired = Math.max(0, Math.floor(cap - CONFIG.BUILD_TIMER * CONFIG.EARLY_START_BONUS_PER_SEC));
  check('the end of the build window uses the same configured decay formula', payEarlyStart(st, 0, wave) === expired && st.gold === expired, `${st.gold}`);
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
  // cannon.cost is 5 since the 2026-07-07 rebalance (base cost x0.30, was 15);
  // this block reads it dynamically so the 2.5/5/10/20 curve is asserted as
  // ratios, not absolutes — L2 = round(5*2.5) = 13, L3 = 25, L4 = 50, L5 = 100.
  // CONFIG.UPGRADE_COST_SCALE (roster-only, +100% since 2026-07-08) then
  // multiplies every tier's cost on top of that ratio — read dynamically too.
  const base = CONFIG.TOWERS.cannon.cost;     // 5 (was 15 pre-rebalance)
  const scale = CONFIG.UPGRADE_COST_SCALE;
  check('L2 = 2.5x base', upgradeCostFor('cannon', 2) === Math.round(base * 2.5 * scale));
  check('L3 = 5x base', upgradeCostFor('cannon', 3) === base * 5 * scale);
  check('L4 = 10x, L5 = 20x', upgradeCostFor('cannon', 4) === base * 10 * scale && upgradeCostFor('cannon', 5) === base * 20 * scale);
  check('each upgrade dearer than the build', upgradeCostFor('cannon', 2) > base && upgradeCostFor('cannon', 3) > upgradeCostFor('cannon', 2));
  // legacy defs stay on the old CONFIG.UPGRADE chain (UPGRADE_COST_SCALE is roster-only)
  const lbase = CONFIG.TOWERS.cannonL.cost;
  check('legacy clone still 2x/4x', upgradeCostFor('cannonL', 2) === Math.round(lbase * CONFIG.UPGRADE.costMultL2)
    && upgradeCostFor('cannonL', 3) === Math.round(lbase * CONFIG.UPGRADE.costMultL3));
  // and tryUpgrade actually charges + caps
  const st = freshL8();
  const cannon = addTower(st, 'cannon', 5, 5);
  const g0 = st.gold;
  tryUpgrade(st, cannon, null);
  check('L1->L2 charged 2.5x base', g0 - st.gold === Math.round(base * 2.5 * scale) && cannon.level === 2);
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
  // Starter towers must not one-shot -> no challenge otherwise. Re-derived for
  // the 2026-07-07 rebalance (base dmg x0.10): a single T1 hit now barely
  // dents a grunt, so mazing is mandatory. On the shipped SEED an arrow hit is
  // 0.5*3.0*1.0 = 1.5 and a cannon hit 0.6*3.0*1.0 = 1.8; a L1 w1 grunt has
  // 21 HP (arrow ~14 shots, cannon ~12) and a L1 w8 grunt 58 HP (arrow ~39).
  // We assert the "many hits" floor as a multiple of a single hit, not the old
  // 2-3-shot numbers (which were written for the pre-rebalance strong towers).
  {
    const lv = getLevel('l1');
    setGridSize(lv.cols, lv.rows);
    const st = createState(makeRng(1), 1, lv);
    const arrowHit = CONFIG.TOWERS.arrow.damage * CONFIG.DAMAGE_SCALE
      * CONFIG.DAMAGE_VS_ARMOR.pierce.medium;
    const cannonHit = CONFIG.TOWERS.cannon.damage * CONFIG.DAMAGE_SCALE
      * CONFIG.DAMAGE_VS_ARMOR.siege.medium;
    const hp1 = computeStats(st, 'normal', 1).hp;
    const hp8 = computeStats(st, 'normal', 8).hp;
    check('L1 w1 grunt needs many (>=6) arrow shots', hp1 > arrowHit * 6,
      `hp=${hp1} arrowHit=${arrowHit} shots=${Math.ceil(hp1 / arrowHit)}`);
    check('L1 w8 grunt needs many (>=12) arrow shots', hp8 > arrowHit * 12,
      `hp=${hp8} shots=${Math.ceil(hp8 / arrowHit)}`);
    // the prompt's cannon spot-check: a weak T1 cannon also needs many hits now
    check('L1 w1 grunt needs many (>=6) cannon shots', hp1 > cannonHit * 6,
      `hp=${hp1} cannonHit=${cannonHit} shots=${Math.ceil(hp1 / cannonHit)}`);
  }
  // GOLD_PER_ROUND_SCALE (-35% on wave-clear bonus + bounties, user
  // 2026-07-08) cut every band below by that same ~0.65x. Re-measured on the
  // shipped SEED post-cut: l1=213, l2=276, l3=823 — banded with ~20% headroom.
  const i1 = income('l1'), i2 = income('l2'), i3 = income('l3');
  check('level 1 income in the 170-260 band', i1 >= 170 && i1 <= 260, `i1=${i1}`);
  check('level 2 income scarce (220-330)', i2 >= 220 && i2 <= 330, `i2=${i2}`);
  check('level 3 income in the 650-990 band', i3 >= 650 && i3 <= 990, `i3=${i3}`);
  check('order-of-magnitude cut vs the old ~1400g level 1', i1 < 500, `i1=${i1}`);

  // U20 mid/late spot checks: per-level bounty/waveclear mults now cover 4-20.
  // Re-measured post GOLD_PER_ROUND_SCALE on the shipped SEED:
  // l8=1823, l14=5823, l20=10997 — banded with ~20% headroom each way.
  // Boss levels (10/13/15/17/18/20) still carry deliberately higher
  // bountyMult: the income pays for the boss-killing DPS.
  const i8 = income('l8'), i14 = income('l14'), i20 = income('l20');
  check('level 8 income in the 1450-2200 band', i8 >= 1450 && i8 <= 2200, `i8=${i8}`);
  check('level 14 income in the 4650-7000 band', i14 >= 4650 && i14 <= 7000, `i14=${i14}`);
  check('level 20 income in the 8800-13200 band', i20 >= 8800 && i20 <= 13200, `i20=${i20}`);
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
  const scale = CONFIG.UPGRADE_COST_SCALE;   // ttest has def.tiers -> roster-scaled like any live tower
  check('tier cost curve 2.5/5/10/20',
    upgradeCostFor('ttest', 2) === Math.round(base * 2.5 * scale)
    && upgradeCostFor('ttest', 3) === base * 5 * scale
    && upgradeCostFor('ttest', 4) === base * 10 * scale
    && upgradeCostFor('ttest', 5) === base * 20 * scale);

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
  // build (1x, unscaled) + tiers 2.5/5/10/20 each x UPGRADE_COST_SCALE
  check('invested = (1 + 37.5x scale)x base through T5', t.invested === base * (1 + 37.5 * scale), `${t.invested} scale=${scale}`);

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

  // tier + branch survive the v4 save round-trip
  const snap = buildSnapshot(st);
  check('snapshot is v5', snap.v === 5);
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
  check('support builds and buffs the adjacent tower', !!sup && arrow.buffDmg === 0.15 && arrow.stats.buffDmg === 0.15);
  check('support T5A/B fork declared (dmg aura vs income)', (() => {
    const f = CONFIG.TOWERS.support.tiers[3].forks;
    return f && f.A.mods.auraDmg === 0.65 && f.B.mods.income === 150;
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
  check('gold T5 signature: large income', getTowerStats('gold', 5, null).income === 600);
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

console.log('U7 radial anchor: the center X stays on the selected cell:');
{
  const { doc } = installFakeDom();
  const ui = doc.createElement('div');
  ui.clientWidth = 280;
  ui.clientHeight = 220;
  const vp = { worldToUi: () => ({ x: 14, y: 18 }) };
  const radial = new Radial(ui, vp);
  radial.open({ x: 2, y: 2 }, [
    { glyph: 'A', onTap() {} },
    { glyph: 'B', onTap() {} },
    { glyph: 'C', onTap() {} },
  ], 'build', null);
  check('ring center anchored to selected cell', radial.root.style.left === '14px' && radial.root.style.top === '18px',
    `left=${radial.root.style.left} top=${radial.root.style.top}`);
  radial.close();
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
