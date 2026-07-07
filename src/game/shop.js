// =============================================================================
// shop.js — the economic decisions: buy a tower, upgrade it, sell it.
//
// This is the only layer that touches gold for towers. It validates legality and
// affordability, then delegates the actual entity work to tower.js (which owns
// grid placement + maze re-routing). UI calls these; they return success/values.
// =============================================================================

import { CONFIG } from '../config.js';
import { canAfford, spendGold, addGold, addFloater } from './economy.js';
import { canBuildAt, pushEvent } from './state.js';
import { addTower, removeTower, recomputeAuras } from './tower.js';
import { applySplash } from './projectile.js';
import { baseHp } from './wave.js';
import { COLS, ROWS, SIZE, cellCenterX, cellCenterY } from '../engine/grid.js';

export function buildCost(typeId) { return CONFIG.TOWERS[typeId].cost; }

export function tryBuild(state, typeId, x, y) {
  const def = CONFIG.TOWERS[typeId];
  if (!def) return false;
  if (!canBuildAt(state, x, y)) return false;
  if (!canAfford(state, def.cost)) return false;
  spendGold(state, def.cost);
  return addTower(state, typeId, x, y);   // UI selection/arming handled by caller
}

// Walls refund in full (juggling is a core mechanic, not a tax); towers 70%.
export function sellRefund(tower) {
  const rate = tower.def.wall ? CONFIG.WALL_REFUND : CONFIG.SELL_REFUND;
  return Math.floor(tower.invested * rate);
}

export function trySell(state, tower) {
  const refund = sellRefund(tower);
  removeTower(state, tower);
  addGold(state, refund);
  if (state.selected === tower) state.selected = null;
  return refund;
}

// --- marquee batches (U21) ---------------------------------------------------

// Every cell the world-px rect between two drag points intersects (inclusive
// bounds, clamped to the grid), ordered row-major FROM THE DRAG-START corner —
// batchBuild fills in this order, so walls grow away from where the drag began.
export function marqueeCells(ax, ay, bx, by) {
  const cellOf = (w, n) => Math.min(Math.max(Math.floor(w / SIZE), 0), n - 1);
  const x0 = cellOf(ax, COLS), y0 = cellOf(ay, ROWS);
  const x1 = cellOf(bx, COLS), y1 = cellOf(by, ROWS);
  const sx = x0 <= x1 ? 1 : -1, sy = y0 <= y1 ? 1 : -1;
  const cells = [];
  for (let y = y0; ; y += sy) {
    for (let x = x0; ; x += sx) {
      cells.push({ x, y });
      if (x === x1) break;
    }
    if (y === y1) break;
  }
  return cells;
}

// Build one type across a marquee. Invalid cells (border/obstacle/flag/
// occupied/enemy-underfoot) are SKIPPED without aborting the batch;
// affordable-prefix semantics — building simply stops adding towers once gold
// runs out. `of` counts the valid cells so callers report "Built X of N".
// ONE build sfx event for the whole batch, not one per wall.
export function batchBuild(state, typeId, cells) {
  const def = CONFIG.TOWERS[typeId];
  const res = { built: 0, of: 0, spent: 0 };
  if (!def) return res;
  for (const c of cells) {
    if (!canBuildAt(state, c.x, c.y)) continue;
    res.of++;
    if (tryBuild(state, typeId, c.x, c.y)) { res.built++; res.spent += def.cost; }
  }
  if (res.built > 0) pushEvent(state, 'build');
  return res;
}

// Sell every tower under the batch. Items may be cells ({x, y}) or tower
// entities; empty cells pass through harmlessly. ONE sell sfx event per batch.
export function batchSell(state, items) {
  const res = { sold: 0, refund: 0 };
  const seen = new Set();
  for (const it of items) {
    const t = it && it.def ? it : (state.towerGrid[it.y] && state.towerGrid[it.y][it.x]);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    res.refund += trySell(state, t);
    res.sold++;
  }
  if (res.sold > 0) pushEvent(state, 'sell');
  return res;
}

// Batch-upgrade every tower under the selection by one tier, cheapest-first
// while gold lasts. Skips walls/maxed towers and any tower whose next step is
// a FORK choice (those pick a branch individually so the player isn't locked
// into A by a bulk action). Items may be cells or tower entities. ONE sfx.
export function batchUpgrade(state, items) {
  const res = { upgraded: 0, of: 0, spent: 0, forkSkipped: 0 };
  const seen = new Set();
  const towers = [];
  for (const it of items) {
    const t = it && it.def ? it : (state.towerGrid[it.y] && state.towerGrid[it.y][it.x]);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    if (!t.canUpgrade()) continue;      // walls + maxed towers
    res.of++;
    if (t.forkChoices()) { res.forkSkipped++; continue; }   // needs a per-tower branch pick
    towers.push(t);
  }
  towers.sort((a, b) => a.nextUpgradeCost() - b.nextUpgradeCost());
  for (const t of towers) {
    const g0 = state.gold;
    if (tryUpgrade(state, t, null)) { res.upgraded++; res.spent += g0 - state.gold; }
  }
  if (res.upgraded > 0) pushEvent(state, 'build');
  return res;
}

// branchId only needed (and only used) at the tier that declares forks.
export function tryUpgrade(state, tower, branchId) {
  if (!tower.canUpgrade()) return false;
  if (tower.forkChoices() && !branchId) return false;   // must choose a branch
  const cost = tower.nextUpgradeCost();
  if (!canAfford(state, cost)) return false;
  spendGold(state, cost);
  tower.applyUpgrade(branchId);
  // upgrading replaces the tower's stats object (and may change a Beacon's
  // aura strength/radius) — refresh every tower's received buff
  recomputeAuras(state);
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

// --- global tower boosts (permanent, bought between waves) ------------------
export function towerBoostMaxed(state, key) {
  return state.towerBoosts[key] >= CONFIG.TOWER_BOOSTS[key].maxTier;
}
export function towerBoostCost(state, key) {
  const def = CONFIG.TOWER_BOOSTS[key];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, state.towerBoosts[key]));
}
export function tryTowerBoost(state, key) {
  if (towerBoostMaxed(state, key)) return false;
  const cost = towerBoostCost(state, key);
  if (!canAfford(state, cost)) return false;
  spendGold(state, cost);
  state.towerBoosts[key]++;
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
      applySplash(state, px, py, def.radius, { damage: dmg, damageType: 'chaos', targetsAir: true });
      state.effects.push({ kind: 'splash', x: px, y: py, r: def.radius, color: '#f2c14b', life: 0.5, max: 0.5 });
      break;
    }
  }
  return true;
}
