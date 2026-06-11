// =============================================================================
// hero.js — the single commandable hero (Kingdom Rush style).
//
// The hero is NOT a tower: you right-click to move it (it pathfinds through the
// maze like an enemy), it auto-attacks the nearest valid enemy when in range,
// takes contact damage from enemies that crowd it, can be downed and respawns at
// the base, earns XP to level 10 (raising stats + ability power), and casts two
// abilities on cooldowns. Stats are recomputed from base def + level + the
// permanent shop bonuses applied in Phase 7.
// =============================================================================

import { CONFIG } from '../config.js';
import { SIZE, cellCenter, cellCenterX, cellCenterY, cellDist, worldToCell, inBounds } from '../engine/grid.js';
import { aStar } from '../engine/pathfinding.js';
import { makeWalkable } from './state.js';
import { dealDamage, applySplash, spawnProjectile, pushSpark, pushSplash, pushBeam } from './projectile.js';

export function xpForLevel(n) {
  return Math.floor(CONFIG.HERO_XP_BASE * Math.pow(CONFIG.HERO_XP_GROWTH, n - 1));
}

export class Hero {
  constructor(state, heroId) {
    this.id = heroId;
    this.def = CONFIG.HEROES[heroId];
    this.attackType = this.def.attackType;
    this.targetsAir = this.def.targetsAir;
    this.melee = this.def.range <= 1.6;

    this.level = 1;
    this.xp = 0;
    // permanent shop bonuses (Phase 7)
    this.bonuses = { maxHpAdd: 0, dmgMult: 0, abilityCdMult: 0, respawnAdd: 0 };

    // abilities -> instances with live cooldowns
    this.abilities = this.def.abilities.map((a) => ({ ...a, cdLeft: 0 }));

    // base position = an interior cell next to the first goal
    const base = findBase(state);
    this.baseCell = base;
    const c = cellCenter(base.x, base.y);
    this.x = c.x; this.y = c.y;
    this.cx = base.x; this.cy = base.y;

    this.path = null; this.pathIndex = 0;
    this.moveTarget = null;
    this.guardPost = { x: base.x, y: base.y };   // auto-engage anchor (KR style)
    this.atkCd = 0;
    this.angle = 0;
    this.lunge = 0;             // cosmetic melee-swing timer (renderer only)
    this.hitFlash = 0;          // cosmetic took-a-hit timer (renderer only)
    this.downed = false;
    this.respawnLeft = 0;
    this.buffLeft = 0; this.buffRangeAdd = 0; this.buffDmgMult = 1;

    this.recompute();
    this.hp = this.maxHp;
  }

  recompute() {
    const d = this.def;
    const lvl = this.level - 1;
    this.maxHp = Math.round((d.maxHp + this.bonuses.maxHpAdd) * (1 + CONFIG.HERO_LEVEL_HP_GAIN * lvl));
    this.damage = d.damage * (1 + CONFIG.HERO_LEVEL_DMG_GAIN * lvl) * (1 + this.bonuses.dmgMult);
    this.range = d.range + (this.buffLeft > 0 ? this.buffRangeAdd : 0);
    this.cooldown = d.cooldown;
    this.speed = d.speed;
    this.abilityCdMult = Math.max(0.3, 1 + this.bonuses.abilityCdMult);
    this.respawnTime = Math.max(2, CONFIG.HERO_RESPAWN_BASE + this.level + this.bonuses.respawnAdd);
  }

  // --- XP / levels ----------------------------------------------------------
  gainXp(amount, state) {
    if (this.level >= CONFIG.HERO_MAX_LEVEL) return;
    this.xp += amount;
    while (this.level < CONFIG.HERO_MAX_LEVEL && this.xp >= xpForLevel(this.level + 1)) {
      this.xp -= xpForLevel(this.level + 1);
      this.level++;
      this.recompute();
      this.hp = this.maxHp;   // level-up fully heals
      if (state) state.effects.push({ kind: 'splash', x: this.x, y: this.y, r: 1.4, color: '#ffe08a', life: 0.4, max: 0.4 });
    }
    if (this.level >= CONFIG.HERO_MAX_LEVEL) this.xp = 0;
  }

  xpToNext() { return this.level >= CONFIG.HERO_MAX_LEVEL ? 1 : xpForLevel(this.level + 1); }

  // --- movement -------------------------------------------------------------
  commandMove(state, x, y) {
    if (this.downed || !inBounds(x, y)) return;
    const walk = makeWalkable(state);
    // if the exact cell is blocked, the hero just goes as close as it can
    const path = aStar(walk, this.cx, this.cy, x, y);
    if (path && path.length > 1) {
      this.path = path; this.pathIndex = 1; this.moveTarget = { x, y };
      this.guardPost = { x, y };          // orders move the guard post too
    }
  }

  onMazeChanged(state) {
    if (this.downed || !this.moveTarget) return;
    this.commandMove(state, this.moveTarget.x, this.moveTarget.y);
  }

  moveAlong(dt) {
    if (!this.path || this.pathIndex >= this.path.length) { this.path = null; return; }
    let remaining = this.speed * SIZE * dt;
    let guard = 0;
    while (remaining > 0 && this.pathIndex < this.path.length && guard++ < 16) {
      const cell = this.path[this.pathIndex];
      const tx = cellCenterX(cell.x), ty = cellCenterY(cell.y);
      const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy);
      if (dist <= remaining || dist < 0.001) {
        this.x = tx; this.y = ty; remaining -= dist;
        this.cx = cell.x; this.cy = cell.y;
        this.pathIndex++;
      } else {
        this.x += (dx / dist) * remaining; this.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
    if (this.pathIndex >= this.path.length) { this.path = null; this.moveTarget = null; }
  }

  // --- combat ---------------------------------------------------------------
  // Nearest valid enemy in range — but anything actively chewing a wall
  // outranks everything else (the hero is the wall's bodyguard).
  acquire(state) {
    let best = null, bestScore = Infinity;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.flying && !this.targetsAir) continue;
      const d = cellDist(this.x / SIZE, this.y / SIZE, e.x / SIZE, e.y / SIZE);
      if (d > this.range) continue;
      const score = d - (e.siegeTarget ? 1000 : 0);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  attackStats(mult = 1) {
    return {
      damage: this.damage * (this.buffLeft > 0 ? this.buffDmgMult : 1) * mult,
      damageType: this.attackType,
      targetsAir: this.targetsAir,
      splashRadius: this.def.splashRadius || 0,
    };
  }

  attack(state, tgt) {
    this.angle = Math.atan2(tgt.y - this.y, tgt.x - this.x);
    const stats = this.attackStats();
    if (this.melee) {
      dealDamage(state, tgt, stats.damage, stats);
      this.lunge = 0.18;                                  // visible swing (renderer)
      pushBeam(state, this.x, this.y, tgt.x, tgt.y, this.def.color);
      pushSpark(state, tgt.x, tgt.y, this.def.color);
    } else {
      stats.projectileSpeed = CONFIG.HERO_PROJECTILE_SPEED;
      this.lunge = 0.1;
      spawnProjectile(state, this.x, this.y, tgt, stats, this.def.color);
    }
  }

  takeContactDamage(dt, state) {
    let dps = 0;
    const r = CONFIG.HERO_CONTACT_RADIUS;
    const per = CONFIG.HERO_CONTACT_DPS_BASE + CONFIG.HERO_CONTACT_DPS_PER_WAVE * state.wave;
    for (const e of state.enemies) {
      if (!e.alive || e.flying) continue;       // ground enemies only crowd the hero
      const d = cellDist(this.x / SIZE, this.y / SIZE, e.x / SIZE, e.y / SIZE);
      // each type's attack-power stat drives how hard it hits the hero too
      if (d <= r) dps += per * (e.def.atk != null ? e.def.atk : 1) * (e.boss ? 1.5 : 1);
    }
    if (dps > 0) { this.hp -= dps * dt; this.hitFlash = 0.12; }
  }

  // --- guard-post auto-engage (KR style) -------------------------------------
  // With no player order in progress: fight whatever threatens the post —
  // wall-chewers first, then the nearest enemy in aggro range. Chase only
  // within the leash; drift back to the post when the area is clear.
  autoEngage(state) {
    if (this.moveTarget || this.downed) return;   // explicit orders win
    const post = this.guardPost;
    let best = null, bestScore = Infinity;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.flying && !this.targetsAir) continue;
      const d = cellDist(post.x, post.y, e.x / SIZE - 0.5, e.y / SIZE - 0.5);
      if (d > CONFIG.HERO_AGGRO_RANGE) continue;
      const score = d - (e.siegeTarget ? 100 : 0);      // defend the walls first
      if (score < bestScore) { bestScore = score; best = e; }
    }
    const walk = makeWalkable(state);
    if (!best) {
      // area clear: head home if we've drifted and aren't already walking
      if (!this.path && (this.cx !== post.x || this.cy !== post.y)) {
        const path = aStar(walk, this.cx, this.cy, post.x, post.y);
        if (path && path.length > 1) { this.path = path; this.pathIndex = 1; }
      }
      return;
    }
    // close the gap when the target is outside attack range (short hops so we
    // re-evaluate every step), but never beyond the leash
    const dToTarget = cellDist(this.x / SIZE, this.y / SIZE, best.x / SIZE, best.y / SIZE);
    if (dToTarget > this.range * 0.9 && !this.path) {
      const tc = worldToCell(best.x, best.y);
      if (cellDist(post.x, post.y, tc.x, tc.y) <= CONFIG.HERO_LEASH_RANGE) {
        const path = aStar(walk, this.cx, this.cy, tc.x, tc.y);
        if (path && path.length > 1) { this.path = path.slice(0, 3); this.pathIndex = 1; }
      }
    }
  }

  down(state) {
    this.downed = true;
    this.respawnLeft = this.respawnTime;
    this.path = null; this.moveTarget = null;
    state.effects.push({ kind: 'splash', x: this.x, y: this.y, r: 1.6, color: '#e24b4a', life: 0.5, max: 0.5 });
  }

  respawn() {
    this.downed = false;
    this.hp = this.maxHp;
    const c = cellCenter(this.baseCell.x, this.baseCell.y);
    this.x = c.x; this.y = c.y; this.cx = this.baseCell.x; this.cy = this.baseCell.y;
  }

  // --- abilities ------------------------------------------------------------
  canCast(i) { return !this.downed && this.abilities[i] && this.abilities[i].cdLeft <= 0; }

  // Returns true if cast; 'needtarget' if it needs a cell click first.
  cast(state, i, targetCell) {
    const ab = this.abilities[i];
    if (!this.canCast(i)) return false;
    if (ab.targetCell && !targetCell) return 'needtarget';
    this.applyAbility(state, ab, targetCell);
    ab.cdLeft = ab.cooldown * this.abilityCdMult;
    return true;
  }

  applyAbility(state, ab, targetCell) {
    const dmg = this.damage * (ab.dmgMult || 1);
    const at = (cellX, cellY, type, slow) => {
      const px = cellCenterX(cellX), py = cellCenterY(cellY);
      const stats = { damage: dmg, damageType: type, targetsAir: true,
        slowPct: slow ? ab.slowPct : 0, slowDur: slow ? ab.slowDur : 0 };
      applySplash(state, px, py, ab.radius, stats);
      pushSplash(state, px, py, ab.radius, this.def.color);
    };
    switch (ab.id) {
      case 'whirlwind': {
        const stats = { damage: dmg, damageType: 'chaos', targetsAir: false };
        applySplash(state, this.x, this.y, ab.radius, stats);
        pushSplash(state, this.x, this.y, ab.radius, '#e0773b');
        break;
      }
      case 'taunt': {
        for (const e of state.enemies) {
          if (!e.alive || e.flying) continue;
          if (cellDist(this.x / SIZE, this.y / SIZE, e.x / SIZE, e.y / SIZE) <= ab.radius) {
            // pull toward the hero, then stun and re-path from the new cell
            const ang = Math.atan2(this.y - e.y, this.x - e.x);
            e.x += Math.cos(ang) * SIZE * 0.8; e.y += Math.sin(ang) * SIZE * 0.8;
            const c = worldToCell(e.x, e.y); e.cx = c.x; e.cy = c.y;
            if (!e.flying) e.advanceTarget(state);
            e.applyStun(ab.stun);
          }
        }
        pushSplash(state, this.x, this.y, ab.radius, '#e0773b');
        break;
      }
      case 'meteor': at(targetCell.x, targetCell.y, 'magic', false); break;
      case 'frostnova': at(targetCell.x, targetCell.y, 'magic', true); break;
      case 'volley': {
        // distribute `shots` hits among enemies in the area
        const px = cellCenterX(targetCell.x), py = cellCenterY(targetCell.y);
        const inArea = state.enemies.filter((e) => e.alive && (this.targetsAir || !e.flying) &&
          cellDist(px / SIZE, py / SIZE, e.x / SIZE, e.y / SIZE) <= ab.radius);
        const stats = this.attackStats(ab.dmgMult);
        for (let s = 0; s < ab.shots; s++) {
          const e = inArea[s % Math.max(1, inArea.length)];
          if (e && e.alive) { dealDamage(state, e, stats.damage, stats); pushSpark(state, e.x, e.y, this.def.color); }
        }
        pushSplash(state, px, py, ab.radius, this.def.color);
        break;
      }
      case 'hawkeye':
        this.buffLeft = ab.dur; this.buffRangeAdd = ab.rangeAdd; this.buffDmgMult = ab.dmgMult;
        this.recompute();
        state.effects.push({ kind: 'splash', x: this.x, y: this.y, r: 1.2, color: '#5fce7a', life: 0.4, max: 0.4 });
        break;
    }
  }

  // --- per-tick -------------------------------------------------------------
  update(dt, state) {
    for (const ab of this.abilities) if (ab.cdLeft > 0) ab.cdLeft -= dt;
    if (this.buffLeft > 0) { this.buffLeft -= dt; if (this.buffLeft <= 0) this.recompute(); }
    if (this.lunge > 0) this.lunge -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    if (this.downed) { this.respawnLeft -= dt; if (this.respawnLeft <= 0) this.respawn(); return; }

    this.moveAlong(dt);
    this.autoEngage(state);
    this.takeContactDamage(dt, state);
    if (this.hp <= 0) { this.down(state); return; }

    this.atkCd -= dt;
    if (this.atkCd <= 0) {
      const tgt = this.acquire(state);
      if (tgt) { this.attack(state, tgt); this.atkCd = this.cooldown; }
    }
  }
}

// Find a walkable interior cell next to the first goal to use as the base.
function findBase(state) {
  const g = state.map.goals[0];
  for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
    const x = g.cx + dx, y = g.cy + dy;
    if (makeWalkable(state)(x, y)) return { x, y };
  }
  // fallback: map center
  return { x: (CONFIG.GRID_COLS / 2) | 0, y: (CONFIG.GRID_ROWS / 2) | 0 };
}

export function createHero(state, heroId) {
  state.hero = new Hero(state, heroId);
  return state.hero;
}
