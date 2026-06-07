// =============================================================================
// shop.js — the economic decisions: buy a tower, upgrade it, sell it.
//
// This is the only layer that touches gold for towers. It validates legality and
// affordability, then delegates the actual entity work to tower.js (which owns
// grid placement + maze re-routing). UI calls these; they return success/values.
// =============================================================================

import { CONFIG } from '../config.js';
import { canAfford, spendGold, addGold } from './economy.js';
import { canBuildAt } from './state.js';
import { addTower, removeTower } from './tower.js';

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
