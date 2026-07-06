// =============================================================================
// tower.js — tower entities: stats, targeting, firing, and the upgrade tree.
//
// getTowerStats(type, level, branch) is the single source of truth for a tower's
// numbers at any level. Upgrades are per-tier data tables (U5/KTD3): def.tiers[i]
// describes the tier entered at level i+2 — { costMult, mods?, forks? } — and
// each reached tier's mods fold onto the stats cumulatively; a tier with forks
// applies the chosen fork's mods on top. Towers without a declared table get a
// legacy-equivalent one derived from CONFIG.UPGRADE, so the existing roster
// (L3 cap) and hidden sim towers (L4 branch) keep their exact numbers. Towers
// pick a target each cooldown (respecting targetsAir and the player's target
// mode) and either fire a homing projectile or apply a hitscan effect (frost
// beam / tesla chain).
// =============================================================================

import { CONFIG } from '../config.js';
import { SIZE, cellCenter, cellCenterX, cellCenterY, cellDist } from '../engine/grid.js';
import { fieldAt } from '../engine/pathfinding.js';
import { onMazeChanged, pushEvent } from './state.js';
import { spawnProjectile, applyTowerHit, applyChain, pushBeam, pushSplash } from './projectile.js';
import { addShake, addFloater } from './economy.js';

// The per-tier upgrade table for a def (KTD3). Entry i = the tier entered at
// level i+2: { costMult, mods?, forks?: { A: {name, desc, mods}, B: {...} } }.
// Max level = tiers.length + 1. Defs without a declared `tiers` get a
// legacy-equivalent table built from CONFIG.UPGRADE: the old costMultL2/L3/L4
// chain + per-level stat multipliers, roster capped at MAX_TOWER_LEVEL and
// hidden sim towers keeping their L4 branch tier — nothing changes for them.
export function tierTable(def) {
  if (def.tiers) return def.tiers;
  if (!def._legacyTiers) {
    const U = CONFIG.UPGRADE;
    // Aura towers scale via auraByLevel, so the generic per-level multipliers
    // were always a no-op for them — their legacy tiers carry no mods.
    const mods = def.aura ? null : {
      damageMult: U.dmgMultPerLevel,
      rangeMult: U.rangeMultPerLevel,
      cooldownMult: U.cooldownMultPerLevel,
    };
    const tiers = [];
    for (let lvl = 2; lvl <= CONFIG.MAX_TOWER_LEVEL; lvl++) {
      tiers.push({ costMult: U['costMultL' + lvl], mods });
    }
    // hidden legacy towers keep their L4 branch tier (regression sims only)
    if (def.hidden) tiers.push({ costMult: U.costMultL4, forks: def.branches });
    def._legacyTiers = tiers;
  }
  return def._legacyTiers;
}

// Fold one "mods" bag onto a stats object — shared by per-tier mods and fork
// (branch) mods. *Mult keys stack multiplicatively across tiers; the rest
// assign/replace. New capability keys land here so tiers/forks can grant them.
function applyMods(s, m) {
  if (m.auraDmg) s.auraDmg = m.auraDmg;
  if (m.auraSpeed) s.auraSpeed = m.auraSpeed;
  if (m.damageType) s.damageType = m.damageType;
  if (m.damageMult) s.damage *= m.damageMult;
  if (m.rangeMult) s.range *= m.rangeMult;
  if (m.cooldownMult) s.cooldown *= m.cooldownMult;
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

// Resolve a tower's stats at a given level + branch choice.
export function getTowerStats(typeId, level, branchId) {
  const def = CONFIG.TOWERS[typeId];
  const s = {
    damage: def.damage, range: def.range, cooldown: def.cooldown,
    damageType: def.damageType,
    targetsAir: !!def.targetsAir,
    airOnly: !!def.airOnly,        // Falcon: can't touch ground enemies
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

  // Aura towers (Beacon): strength/radius come from auraByLevel, not the tier
  // mods. These are the EMITTED values; the buff a tower RECEIVES lives in
  // stats.buffDmg (written by recomputeAuras).
  if (def.aura) {
    const a = def.auraByLevel[Math.min(level, def.auraByLevel.length) - 1];
    s.auraDmg = a.dmg;
    s.auraSpeed = a.speed;
    s.auraRange = a.range;
    s.range = a.range;          // so generic range displays/rings read sanely
  }

  // Fold every reached tier's mods on cumulatively; a fork tier applies the
  // chosen branch's mods on top (the old L4 branch merge, now per-tier data).
  const tiers = tierTable(def);
  const reached = Math.min(level - 1, tiers.length);
  for (let i = 0; i < reached; i++) {
    const t = tiers[i];
    if (t.mods) applyMods(s, t.mods);
    if (t.forks && branchId && t.forks[branchId]) applyMods(s, t.forks[branchId].mods);
  }
  s.damage *= CONFIG.DAMAGE_SCALE;   // global balance knob (Phase 8)
  return s;
}

// Cost to upgrade INTO a given level (tier entry costMult x base cost).
export function upgradeCostFor(typeId, toLevel) {
  const def = CONFIG.TOWERS[typeId];
  const tier = tierTable(def)[toLevel - 2];
  return tier ? Math.round(def.cost * tier.costMult) : 0;
}

// The fork definition a chosen branch points at (name/desc for the UI). Scans
// the tier table so tiers-declared forks and legacy def.branches both resolve.
export function forkDef(def, branchId) {
  if (!branchId) return null;
  const tiers = tierTable(def);
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (tiers[i].forks && tiers[i].forks[branchId]) return tiers[i].forks[branchId];
  }
  return null;
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
    this.branch = null;            // 'A' | 'B' once chosen at the fork tier
    this.targetMode = 'first';
    this.cooldownLeft = 0;
    this.angle = -Math.PI / 2;     // facing up by default
    this.invested = this.def.cost; // total gold sunk in (for sell refund)
    this.buffDmg = 0;              // strongest Beacon damage-aura covering us
    this.buffSpeed = 0;            // strongest Beacon speed-aura covering us
    this.alive = true;             // false once besieging creeps destroy us
    this.underAttack = 0;          // red-flash timer while being chewed
    this.refreshStats();
    this.muzzle = 0;               // brief flash timer for render
  }

  refreshStats() {
    this.stats = getTowerStats(this.type, this.level, this.branch);
    // stats was just replaced — re-copy the received aura buff onto it
    // (projectiles/splash read the firing tower's stats, not the tower).
    if (!this.def.aura) this.stats.buffDmg = this.buffDmg || 0;
    // Siege HP: walls are the tough maze pieces; towers scale with gold sunk in.
    this.maxHp = this.def.wall
      ? CONFIG.TOWER_HP.wallBase
      : CONFIG.TOWER_HP.base + this.invested * CONFIG.TOWER_HP.perGold;
    if (this.hp == null || this.hp > this.maxHp) this.hp = this.maxHp;
  }

  // Max level = tier table length + 1 (legacy tables encode the old rule:
  // roster caps at L3, hidden sim towers keep their L4 branch tier).
  canUpgrade() {
    if (this.def.wall) return false;
    return this.level < tierTable(this.def).length + 1;
  }
  nextUpgradeCost() { return this.canUpgrade() ? upgradeCostFor(this.type, this.level + 1) : 0; }

  // The A/B fork declared at the NEXT tier, if any (null = straight upgrade).
  forkChoices() {
    if (!this.canUpgrade()) return null;
    const t = tierTable(this.def)[this.level - 1];   // tier entered at level+1
    return (t && t.forks) || null;
  }

  applyUpgrade(branchId) {
    if (!this.canUpgrade()) return false;
    const cost = this.nextUpgradeCost();
    this.invested += cost;
    this.level += 1;
    // the branch sticks at whichever tier declared the fork
    const tier = tierTable(this.def)[this.level - 2];
    if (tier && tier.forks) this.branch = branchId;
    this.refreshStats();
    this.hp = this.maxHp;     // upgrading repairs the wall (gold sink perk)
    return true;
  }

  cycleTargetMode() {
    const modes = CONFIG.TARGET_MODES;
    const i = modes.indexOf(this.targetMode);
    this.targetMode = modes[(i + 1) % modes.length];
  }

  // --- targeting ------------------------------------------------------------
  remaining(state, e) {
    // "how far from escaping" — smaller = more progressed. Stage-aware since
    // the checkpoint rework (an enemy on its last flag outranks one on its
    // first even if the raw distance is similar).
    return e.remainingDist(state);
  }

  // Effective range including the global shop range-boost tiers.
  effectiveRange(state) {
    const tier = (state.towerBoosts && state.towerBoosts.range) || 0;
    return this.stats.range * (1 + tier * CONFIG.TOWER_BOOSTS.range.amount);
  }

  candidates(state) {
    const list = [];
    const r = this.effectiveRange(state);
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.flying && !this.stats.targetsAir) continue;
      if (!e.flying && this.stats.airOnly) continue;   // Falcon hunts the skies only
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
    if (this.underAttack > 0) this.underAttack -= dt;
    if (this.def.aura || this.def.wall) return;   // Beacons buff, walls just stand
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
      pushEvent(state, 'shot', this.stats.damageType);   // beams spawn no projectile
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
    // attack-speed shop boost + Beacon haste aura shorten the effective cooldown
    const spdTier = (state.towerBoosts && state.towerBoosts.speed) || 0;
    this.cooldownLeft = this.stats.cooldown /
      ((1 + spdTier * CONFIG.TOWER_BOOSTS.speed.amount) * (1 + (this.buffSpeed || 0)));
  }
}

// Recompute the strongest-aura buff each tower receives. Called whenever the
// tower set or a tower's stats change (build/sell/upgrade/load) — NOT per shot.
// Stacking rule: per-stat MAX across all Beacons in range; same-stat auras
// never stack (kills aura farms, mixed Command+Haste still combines).
export function recomputeAuras(state) {
  const auras = state.towers.filter((t) => t.def.aura);
  for (const t of state.towers) {
    let d = 0, s = 0;
    if (!t.def.aura) {
      for (const a of auras) {
        if (cellDist(t.cx, t.cy, a.cx, a.cy) <= a.stats.auraRange) {
          d = Math.max(d, a.stats.auraDmg || 0);
          s = Math.max(s, a.stats.auraSpeed || 0);
        }
      }
    }
    t.buffDmg = d;
    t.buffSpeed = s;
    if (!t.def.aura && t.stats) t.stats.buffDmg = d;
  }
}

// --- lifecycle (no gold logic here — that's shop.js) ------------------------
export function addTower(state, typeId, x, y) {
  const t = new Tower(typeId, x, y);
  t.builtAt = state.time || 0;   // cosmetic: build pop-in (renderer only)
  state.towerGrid[y][x] = t;
  state.towers.push(t);
  onMazeChanged(state);   // rebuild fields + reroute every enemy
  recomputeAuras(state);
  return t;
}

export function removeTower(state, tower) {
  state.towerGrid[tower.cy][tower.cx] = null;
  const i = state.towers.indexOf(tower);
  if (i >= 0) state.towers.splice(i, 1);
  onMazeChanged(state);
  recomputeAuras(state);
}

// Besieging creeps chewed through this tower: gone for good, NO refund.
export function destroyTower(state, tower) {
  tower.alive = false;
  if (state.selected === tower) state.selected = null;
  removeTower(state, tower);    // grid + list + reroute + aura refresh
  pushSplash(state, tower.px, tower.py, 1.0, '#e24b4a');
  addShake(state, 5);
  addFloater(state, tower.px, tower.py, 'DESTROYED', '#e24b4a');
  pushEvent(state, 'walldown');
}

export function updateTowers(state, dt) {
  for (const t of state.towers) t.update(dt, state);
}
