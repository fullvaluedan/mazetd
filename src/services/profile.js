// =============================================================================
// profile.js — the persistent player profile (localStorage): campaign stars,
// level unlocks, the chosen hero with its level/XP carried BETWEEN levels, and
// permanent star-bought hero upgrades. UI-layer only; the sim never reads it.
// =============================================================================

import { CONFIG } from '../config.js';
import { LEVELS } from '../game/levels.js';

const KEY = 'mazecore_profile_v1';

// Star price of tier i (0-based) of any track: 1, 2, 3, ... stars.
export function starUpgradeCost(tier) { return tier + 1; }

const DEFAULT = () => ({
  v: 1,
  stars: {},                         // levelId -> best stars earned (1..3)
  hero: { id: null, level: 1, xp: 0 },
  starUpgrades: { hp: 0, dmg: 0, cooldown: 0, respawn: 0 },   // tiers bought
});

let cache = null;

export function getProfile() {
  if (cache) return cache;
  try { cache = { ...DEFAULT(), ...JSON.parse(localStorage.getItem(KEY) || 'null') }; }
  catch { cache = DEFAULT(); }
  if (!cache.stars) cache.stars = {};
  if (!cache.hero) cache.hero = DEFAULT().hero;
  if (!cache.starUpgrades) cache.starUpgrades = DEFAULT().starUpgrades;
  return cache;
}

export function saveProfile() {
  try { localStorage.setItem(KEY, JSON.stringify(getProfile())); } catch { /* private mode */ }
}

// Test seam only: drop the in-memory singleton so a headless test can re-read
// a freshly cleared localStorage. Never called by the game.
export function _resetCache() { cache = null; }

// --- stars / unlocks ----------------------------------------------------------
export function starsForLevel(id) { return getProfile().stars[id] || 0; }

export function recordStars(id, n) {
  const p = getProfile();
  if (n > (p.stars[id] || 0)) { p.stars[id] = n; saveProfile(); }
}

export function totalStarsEarned() {
  return Object.values(getProfile().stars).reduce((a, b) => a + b, 0);
}

export function starsSpent() {
  const p = getProfile();
  let spent = 0;
  for (const tier of Object.values(p.starUpgrades)) {
    for (let i = 0; i < tier; i++) spent += starUpgradeCost(i);
  }
  return spent;
}

export function starsAvailable() { return totalStarsEarned() - starsSpent(); }

// Level n is open once the previous level has at least one star.
export function isLevelUnlocked(num) {
  if (num <= 1) return true;
  const prev = LEVELS.find((l) => l.num === num - 1);
  return !!(prev && starsForLevel(prev.id) >= 1);
}

export function endlessUnlocked() { return starsForLevel('l10') >= 1; }

export function highestUnlocked() {
  let n = 1;
  while (n < LEVELS.length && isLevelUnlocked(n + 1)) n++;
  return n;
}

// --- star-bought hero upgrades --------------------------------------------------
export function canBuyStarUpgrade(key) {
  const p = getProfile();
  const def = CONFIG.HERO_UPGRADES[key];
  const tier = p.starUpgrades[key] || 0;
  return tier < def.maxTier && starsAvailable() >= starUpgradeCost(tier);
}

export function buyStarUpgrade(key) {
  if (!canBuyStarUpgrade(key)) return false;
  getProfile().starUpgrades[key]++;
  saveProfile();
  return true;
}

// The permanent bonuses object a fresh hero starts with (same shape the
// in-level gold shop stacks on top of).
export function starBonuses() {
  const p = getProfile();
  const b = { maxHpAdd: 0, dmgMult: 0, abilityCdMult: 0, respawnAdd: 0 };
  const map = { hp: 'maxHpAdd', dmg: 'dmgMult', cooldown: 'abilityCdMult', respawn: 'respawnAdd' };
  for (const [key, def] of Object.entries(CONFIG.HERO_UPGRADES)) {
    b[map[key]] += def.amount * (p.starUpgrades[key] || 0);
  }
  return b;
}

// --- the persistent hero ---------------------------------------------------------
export function setHeroId(id) {
  const p = getProfile();
  p.hero.id = id;
  saveProfile();
}

// Apply the saved progression to a freshly created in-level hero.
export function applyHeroProfile(hero) {
  const p = getProfile();
  hero.level = Math.max(1, Math.min(CONFIG.HERO_MAX_LEVEL, p.hero.level || 1));
  hero.xp = p.hero.xp || 0;
  hero.bonuses = starBonuses();
  hero.recompute();
  hero.hp = hero.maxHp;
}

// Persist whatever the hero earned this run (level only ever goes up).
export function recordHeroProgress(hero) {
  if (!hero) return;
  const p = getProfile();
  if (hero.level > p.hero.level || (hero.level === p.hero.level && hero.xp > p.hero.xp)) {
    p.hero.level = hero.level;
    p.hero.xp = hero.xp;
    saveProfile();
  }
}
