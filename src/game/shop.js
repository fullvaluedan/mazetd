// =============================================================================
// shop.js — the economic decisions: buy a tower, upgrade it, sell it.
//
// This is the only layer that touches gold for towers. It validates legality and
// affordability, then delegates the actual entity work to tower.js (which owns
// grid placement + maze re-routing). UI calls these; they return success/values.
// =============================================================================

import { CONFIG } from '../config.js';
import { canAfford, spendGold, addGold, addFloater } from './economy.js';
import { canBuildAt } from './state.js';
import { addTower, removeTower } from './tower.js';
import { applySplash } from './projectile.js';
import { baseHp } from './wave.js';
import { cellCenterX, cellCenterY } from '../engine/grid.js';

export function buildCost(typeId) { return CONFIG.TOWERS[typeId].cost; }

export function tryBuild(state, typeId, x, y) {
  const def = CONFIG.TOWERS[typeId];
  if (!def) return false;
  if (!canBuildAt(state, x, y)) return false;
  if (!canAfford(state, def.cost)) return false;
  spendGold(state, def.cost);
  return addTower(state, typeId, x, y);   // UI selection/arming handled by caller
}

export function trySell(state, tower) {
  const refund = Math.floor(tower.invested * CONFIG.SELL_REFUND);
  removeTower(state, tower);
  addGold(state, refund);
  if (state.selected === tower) state.selected = null;
  return refund;
}

// branchId only needed (and only used) for the L3 -> L4 upgrade.
export function tryUpgrade(state, tower, branchId) {
  if (!tower.canUpgrade()) return false;
  if (tower.level === 3 && !branchId) return false;   // must choose a branch
  const cost = tower.nextUpgradeCost();
  if (!canAfford(state, cost)) return false;
  spendGold(state, cost);
  tower.applyUpgrade(branchId);
  return true;
}

// --- hero stat upgrades (permanent, bought between waves) -------------------
export function heroUpgradeMaxed(state, key) {
  return state.heroUpgrades[key] >= CONFIG.HERO_UPGRADES[key].maxTier;
}
export function heroUpgradeCost(state, key) {
  const def = CONFIG.HERO_UPGRADES[key];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, state.heroUpgrades[key]));
}
export function tryHeroUpgrade(state, key) {
  const h = state.hero;
  if (!h || heroUpgradeMaxed(state, key)) return false;
  const cost = heroUpgradeCost(state, key);
  if (!canAfford(state, cost)) return false;
  spendGold(state, cost);
  const def = CONFIG.HERO_UPGRADES[key];
  const oldMax = h.maxHp;
  if (def.stat === 'maxHp') h.bonuses.maxHpAdd += def.amount;
  else if (def.stat === 'damageMult') h.bonuses.dmgMult += def.amount;
  else if (def.stat === 'abilityCdMult') h.bonuses.abilityCdMult += def.amount;
  else if (def.stat === 'respawnAdd') h.bonuses.respawnAdd += def.amount;
  h.recompute();
  if (h.maxHp > oldMax) h.hp += (h.maxHp - oldMax);   // +HP also heals
  state.heroUpgrades[key]++;
  return true;
}

// --- consumables (one-shot, usable mid-wave) -------------------------------
export function consumableCost(state, key) {
  const def = CONFIG.CONSUMABLES[key];
  let cost = def.baseCost + def.perWave * Math.max(1, state.wave);
  if (key === 'repair') cost *= Math.pow(1.4, state.repairUses);
  return Math.round(cost);
}

export function tryConsumable(state, key, targetCell) {
  const def = CONFIG.CONSUMABLES[key];
  if (def.targetCell && !targetCell) return 'needtarget';
  const cost = consumableCost(state, key);
  if (!canAfford(state, cost)) return false;
  spendGold(state, cost);
  switch (key) {
    case 'repair':
      state.lives += def.lives;
      state.repairUses++;
      addFloater(state, cellCenterX(2), cellCenterY(1), `+${def.lives}♥`, CONFIG.COLORS.hpFront);
      break;
    case 'frenzy':
      state.frenzyTimer = Math.max(state.frenzyTimer, def.dur);
      break;
    case 'freeze':
      for (const e of state.enemies) if (e.alive && !e.boss) e.applyStun(def.dur);
      state.effects.push({ kind: 'splash', x: 448, y: 288, r: 14, color: '#6ec8ff', life: 0.5, max: 0.5 });
      break;
    case 'airstrike': {
      const dmg = baseHp(Math.max(1, state.wave)) * def.dmgWaveMult;
      const px = cellCenterX(targetCell.x), py = cellCenterY(targetCell.y);
      applySplash(state, px, py, def.radius, { damage: dmg, damageType: 'magic', targetsAir: true });
      state.effects.push({ kind: 'splash', x: px, y: py, r: def.radius, color: '#f2c14b', life: 0.5, max: 0.5 });
      break;
    }
  }
  return true;
}
