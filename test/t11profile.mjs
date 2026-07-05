// Review gap (testing): profile.js — the campaign's star economy, level-unlock
// gating, and cross-level hero persistence — had zero tests. Correctness review
// verified the logic by hand; this locks it in with EXACT-value assertions.
import { CONFIG } from '../src/config.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

// localStorage shim (same shape as t10save.mjs)
const store = new Map();
global.localStorage = {
  getItem: (k) => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const p = await import('../src/services/profile.js');
const fresh = () => { store.clear(); p._resetCache?.(); };

console.log('Star cost curve (triangular: tier n costs n+1):');
{
  check('cost 0..3 = 1,2,3,4', [0, 1, 2, 3].map(p.starUpgradeCost).join() === '1,2,3,4');
}

console.log('Stars: record only-raises, totals, availability:');
{
  fresh();
  p.recordStars('l1', 3); p.recordStars('l2', 2);
  check('total earned = 5', p.totalStarsEarned() === 5);
  p.recordStars('l1', 1);                          // a worse replay
  check('best star never lowered', p.starsForLevel('l1') === 3 && p.totalStarsEarned() === 5);
  check('available = earned when nothing spent', p.starsAvailable() === 5);
}

console.log('Level unlock gating + endless:')
{
  fresh();
  check('level 1 always open', p.isLevelUnlocked(1) === true);
  check('level 2 locked with no stars', p.isLevelUnlocked(2) === false);
  p.recordStars('l1', 1);
  check('level 2 opens after l1 star', p.isLevelUnlocked(2) === true);
  check('level 12 still locked (no l11 star)', p.isLevelUnlocked(12) === false);
  check('endless locked before l10', p.endlessUnlocked() === false);
  p.recordStars('l10', 1);
  check('endless unlocks at l10 star', p.endlessUnlocked() === true);
}

console.log('Star upgrades: spend, escalate, cap, affordability:');
{
  fresh();
  for (const id of ['l1', 'l2', 'l3', 'l4', 'l5']) p.recordStars(id, 3);   // 15 stars
  const before = p.starsAvailable();
  check('15 stars available', before === 15);
  check('first hp buy ok', p.buyStarUpgrade('hp') === true);
  check('spent exactly 1', p.starsAvailable() === before - 1);
  check('second buy costs 2', (p.buyStarUpgrade('hp'), p.starsAvailable()) === before - 3);
  check('hp bonus = 40 * tier', p.starBonuses().maxHpAdd === CONFIG.HERO_UPGRADES.hp.amount * 2);
}

console.log('Star upgrade caps at maxTier (fully funded):');
{
  fresh();
  for (let i = 1; i <= 12; i++) p.recordStars('l' + i, 3);   // 36 stars, plenty
  let guard = 0;
  while (p.canBuyStarUpgrade('hp') && guard++ < 30) p.buyStarUpgrade('hp');
  check('maxes at maxTier', p.getProfile().starUpgrades.hp === CONFIG.HERO_UPGRADES.hp.maxTier);
  check('maxed -> cannot buy again', p.canBuyStarUpgrade('hp') === false);
}

console.log('Cannot buy with zero stars:');
{
  fresh();
  check('no stars -> no buy', p.canBuyStarUpgrade('hp') === false && p.buyStarUpgrade('hp') === false);
}

console.log('Hero persists across levels (level only ever rises):');
{
  fresh();
  p.setHeroId('warrior');
  // a fresh hero stub with the in-game shape applyHeroProfile expects
  const heroStub = () => ({ level: 1, xp: 0, bonuses: {}, maxHp: 100, hp: 1, recompute() { this.maxHp = 100 + (this.bonuses.maxHpAdd || 0); } });
  const h1 = heroStub();
  p.applyHeroProfile(h1);
  check('fresh hero starts L1', h1.level === 1);
  h1.level = 5; h1.xp = 30;
  p.recordHeroProgress(h1);
  const h2 = heroStub();
  p.applyHeroProfile(h2);
  check('next level loads L5/xp30', h2.level === 5 && h2.xp === 30);
  h2.level = 3;                                     // a worse run must not regress the profile
  p.recordHeroProgress(h2);
  const h3 = heroStub();
  p.applyHeroProfile(h3);
  check('progress never lowers', h3.level === 5);
  check('star bonuses applied to hero hp', h3.maxHp === 100);   // no upgrades bought here
}

console.log(fails === 0 ? 'PROFILE_OK' : `PROFILE_FAIL (${fails})`);
