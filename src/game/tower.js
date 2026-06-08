// =============================================================================
// tower.js — tower entities: stats, targeting, firing, and the upgrade tree.
//
// getTowerStats(type, level, branch) is the single source of truth for a tower's
// numbers at any level. Levels 2 and 3 apply flat multipliers from CONFIG.UPGRADE;
// level 4 applies one of the two branch "mods". Towers pick a target each cooldown
// (respecting targetsAir and the player's target mode) and either fire a homing
// projectile or apply a hitscan effect (frost beam / tesla chain).
// =============================================================================

import { CONFIG } from '../config.js';
import { SIZE, cellCenter, cellCenterX, cellCenterY, cellDist } from '../engine/grid.js';
import { fieldAt } from '../engine/pathfinding.js';
import { onMazeChanged } from './state.js';
import { spawnProjectile, applyTowerHit, applyChain, pushBeam } from './projectile.js';

// Resolve a tower's stats at a given level + branch choice.
export function getTowerStats(typeId, level, branchId) {
  const def = CONFIG.TOWERS[typeId];
  const U = CONFIG.UPGRADE;
  let damage = def.damage, range = def.range, cooldown = def.cooldown;

  // L2 and L3 each apply the per-level stat multipliers.
  const ups = Math.min(level, 3) - 1;
  for (let i = 0; i < ups; i++) {
    damage *= U.dmgMultPerLevel;
    range *= U.rangeMultPerLevel;
    cooldown *= U.cooldownMultPerLevel;
  }

  const s = {
    damage, range, cooldown,
    damageType: def.damageType,
    targetsAir: !!def.targetsAir,
    hitscan: !!def.hitscan,
    projectileSpeed: def.projectileSpeed || 10,
    splashRadius: def.splashRadius || 0,
    slowPct: def.slowPct || 0,
    slowDur: def.slowDur || 0,
    dotDps: def.dotDps || 0,
    dotDur: def.dotDur || 0,
    chainTargets: def.chainTargets || 0,
    chainFalloff: def.chainFalloff != null ? def.chainFalloff : 1,
    chainRange: def.chainRange || 1.6,
    multishot: 1,
    shatter: 0,
    disrupt: false,
    contagion: false,
    cluster: 0,
  };

  if (level >= 4 && branchId && def.branches[branchId]) {
    const m = def.branches[branchId].mods;
    if (m.damageMult) s.damage *= m.damageMult;
    if (m.rangeMult) s.range *= m.rangeMult;
    if (m.multishot) s.multishot = m.multishot;
    if (m.splashRadius) s.splashRadius = m.splashRadius;
    if (m.slowPct) s.slowPct = m.slowPct;
    if (m.slowDur) s.slowDur = m.slowDur;
    if (m.dotDpsMult) s.dotDps *= m.dotDpsMult;
    if (m.dotDur) s.dotDur = m.dotDur;
    if (m.chainTargets) s.chainTargets = m.chainTargets;
    if (m.chainFalloff != null) s.chainFalloff = m.chainFalloff;
    if (m.shatter) s.shatter = m.shatter;
    if (m.disrupt) s.disrupt = true;
    if (m.contagion) s.contagion = true;
    if (m.cluster) s.cluster = m.cluster;
  }
  s.damage *= CONFIG.DAMAGE_SCALE;   // global balance knob (Phase 8)
  return s;
}

// Cost to upgrade INTO a given level (2, 3 or 4).
export function upgradeCostFor(typeId, toLevel) {
  const base = CONFIG.TOWERS[typeId].cost;
  const U = CONFIG.UPGRADE;
  if (toLevel === 2) return Math.round(base * U.costMultL2);
  if (toLevel === 3) return Math.round(base * U.costMultL3);
  if (toLevel === 4) return Math.round(base * U.costMultL4);
  return 0;
}

let NEXT_TID = 1;

export class Tower {
  constructor(typeId, cx, cy) {
    this.uid = NEXT_TID++;
    this.type = typeId;
    this.def = CONFIG.TOWERS[typeId];
    this.cx = cx;
    this.cy = cy;
    this.px = cellCenterX(cx);
    this.py = cellCenterY(cy);
    this.level = 1;
    this.branch = null;            // 'A' | 'B' once chosen at L4
    this.targetMode = 'first';
    this.cooldownLeft = 0;
    this.angle = -Math.PI / 2;     // facing up by default
    this.invested = this.def.cost; // total gold sunk in (for sell refund)
    this.refreshStats();
    this.muzzle = 0;               // brief flash timer for render
  }

  refreshStats() { this.stats = getTowerStats(this.type, this.level, this.branch); }

  canUpgrade() { return this.level < 4; }
  // At L3->L4 the player must pick a branch; below that, upgrade is straight.
  nextUpgradeCost() { return this.canUpgrade() ? upgradeCostFor(this.type, this.level + 1) : 0; }

  applyUpgrade(branchId) {
    if (this.level >= 4) return false;
    const cost = this.nextUpgradeCost();
    this.invested += cost;
    this.level += 1;
    if (this.level === 4) this.branch = branchId;
    this.refreshStats();
    return true;
  }

  cycleTargetMode() {
    const modes = CONFIG.TARGET_MODES;
    const i = modes.indexOf(this.targetMode);
    this.targetMode = modes[(i + 1) % modes.length];
  }

  // --- targeting ------------------------------------------------------------
  remaining(state, e) {
    // "how far from the exit" — smaller = nearer the goal = more progressed.
    if (e.flying) {
      const g = e.goalCell;
      return cellDist(e.x / SIZE, e.y / SIZE, cellCenterX(g.x) / SIZE, cellCenterY(g.y) / SIZE);
    }
    return fieldAt(state.fields[e.goalId], e.cx, e.cy);
  }

  candidates(state) {
    const list = [];
    const r = this.stats.range;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.flying && !this.stats.targetsAir) continue;
      const d = cellDist(this.px / SIZE, this.py / SIZE, e.x / SIZE, e.y / SIZE);
      if (d <= r) list.push({ e, d });
    }
    return list;
  }

  pickTargets(state, n) {
    const list = this.candidates(state);
    if (list.length === 0) return [];
    const mode = this.targetMode;
    list.sort((a, b) => {
      switch (mode) {
        case 'last': return this.remaining(state, b.e) - this.remaining(state, a.e);
        case 'strongest': return b.e.hp - a.e.hp;
        case 'closest': return a.d - b.d;
        case 'first':
        default: return this.remaining(state, a.e) - this.remaining(state, b.e);
      }
    });
    return list.slice(0, n).map((c) => c.e);
  }

  // --- firing ---------------------------------------------------------------
  update(dt, state) {
    if (this.muzzle > 0) this.muzzle -= dt;
    this.cooldownLeft -= dt;
    if (this.cooldownLeft > 0) return;

    const shots = this.stats.multishot || 1;
    const targets = this.pickTargets(state, shots);
    if (targets.length === 0) return;

    const primary = targets[0];
    this.angle = Math.atan2(primary.y - this.py, primary.x - this.px);
    this.muzzle = 0.08;

    if (this.stats.hitscan) {
      if (this.stats.chainTargets > 0) {
        applyChain(state, primary, this.stats, { x: this.px, y: this.py }, this.def.color);
      } else {
        // frost-style instant beam (+ slow / shatter handled in applyTowerHit)
        applyTowerHit(state, primary, this.stats);
        pushBeam(state, this.px, this.py, primary.x, primary.y, this.def.color);
      }
    } else {
      for (let i = 0; i < shots; i++) {
        const tgt = targets[i] || primary; // extra arrows pile onto the primary
        spawnProjectile(state, this.px, this.py, tgt, this.stats, this.def.color);
      }
    }
    this.cooldownLeft = this.stats.cooldown;
  }
}

// --- lifecycle (no gold logic here — that's shop.js) ------------------------
export function addTower(state, typeId, x, y) {
  const t = new Tower(typeId, x, y);
  state.towerGrid[y][x] = t;
  state.towers.push(t);
  onMazeChanged(state);   // rebuild fields + reroute every enemy
  return t;
}

export function removeTower(state, tower) {
  state.towerGrid[tower.cy][tower.cx] = null;
  const i = state.towers.indexOf(tower);
  if (i >= 0) state.towers.splice(i, 1);
  onMazeChanged(state);
}

export function updateTowers(state, dt) {
  for (const t of state.towers) t.update(dt, state);
}
