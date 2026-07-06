// =============================================================================
// projectile.js — projectiles, hitscan, and how a hit actually lands.
//
// dealDamage() is the choke point every weapon goes through: it applies the
// damage (the enemy itself handles armor/magic/shield/shatter) and then any
// on-hit riders (slow, poison DoT, shatter/armor-shred debuffs, stun,
// shield-strip/dispel, the contagion mark, and the execute threshold).
// spawnProjectile/updateProjectiles handle travelling shots; applyChain/
// applyLine/applyTowerHit handle instant hits. Visual effects are pushed to
// state.effects and drawn by render.js.
// =============================================================================

import { CONFIG } from '../config.js';
import { SIZE, cellDist } from '../engine/grid.js';
import { addFloater } from './economy.js';
import { matchup } from './damage.js';
import { pushEvent } from './state.js';

// Global tower-damage multipliers: the Frenzy consumable + permanent shop boosts.
function frenzy(state) {
  return state.frenzyTimer > 0 ? CONFIG.CONSUMABLES.frenzy.mult : 1;
}
function boostMult(state) {
  const tier = (state.towerBoosts && state.towerBoosts.dmg) || 0;
  return 1 + tier * CONFIG.TOWER_BOOSTS.dmg.amount;
}
function baseDamage(state, stats, scale) {
  // buffDmg = strongest Beacon damage-aura covering the firing tower
  // (0 / undefined for hero & consumable ad-hoc stats objects).
  return stats.damage * scale * frenzy(state) * boostMult(state) * (1 + (stats.buffDmg || 0));
}

// The single place damage + on-hit effects are applied to an enemy.
export function dealDamage(state, enemy, amount, stats) {
  if (!enemy.alive) return 0;
  const dealt = enemy.takeDamage(amount, stats.damageType);
  if (stats.slowPct > 0) enemy.applySlow(stats.slowPct, stats.slowDur);
  // DoT is matrix-scaled once here; tickPoison stays armor/shield-free.
  if (stats.dotDps > 0) enemy.applyPoison(stats.dotDps * matchup('poison', enemy.armorType), stats.dotDur, state);
  if (stats.shatter > 0) enemy.applyShatter(stats.shatter, Math.max(1, stats.slowDur || 1.5));
  if (stats.armorShred > 0) enemy.applyArmorShred(stats.armorShred, stats.armorShredDur || 2);
  if (stats.stunDur > 0) enemy.applyStun(stats.stunDur);
  if (stats.disrupt) { enemy.removeShield(); enemy.disrupted = true; }
  if (stats.contagion) enemy._contagion = true;
  // Execute (U6): a survivor left under the threshold hp fraction dies outright.
  // Only hp is zeroed — updateEnemies resolves the death through the normal
  // path (bounty, hero XP, contagion), exactly like any lethal hit. Bosses exempt.
  if (stats.executePct > 0 && !enemy.boss && enemy.hp > 0 && enemy.hp < enemy.maxHp * stats.executePct) {
    enemy.hp = 0;
    addFloater(state, enemy.x, enemy.y - enemy.radius, 'EXECUTED', CONFIG.COLORS.danger);
  }
  return dealt;
}

export function applyTowerHit(state, enemy, stats) {
  return dealDamage(state, enemy, baseDamage(state, stats, 1), stats);
}

// Damage every enemy within `radiusCells` of a world point.
export function applySplash(state, x, y, radiusCells, stats, scale = 1) {
  const amt = baseDamage(state, stats, scale);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.flying && !stats.targetsAir) continue;   // ground splash can't hit air
    const d = cellDist(x / SIZE, y / SIZE, e.x / SIZE, e.y / SIZE);
    if (d <= radiusCells) dealDamage(state, e, amt, stats);
  }
}

// Tesla chain lightning: hop to the nearest unhit enemy, applying falloff.
export function applyChain(state, first, stats, origin, color) {
  const hit = new Set();
  const points = [{ x: origin.x, y: origin.y }];
  let cur = first;
  let dmg = baseDamage(state, stats, 1);
  for (let i = 0; i < stats.chainTargets; i++) {
    if (!cur || !cur.alive) break;
    hit.add(cur.id);
    points.push({ x: cur.x, y: cur.y });
    dealDamage(state, cur, dmg, stats);
    dmg *= stats.chainFalloff;     // 0.6 normal, 1.0 for "Storm" branch
    cur = nearestUnhit(state, cur, hit, stats.chainRange, stats.targetsAir);
  }
  pushChain(state, points, color);
}

// Railgun line (U6): damage every enemy within stats.lineWidth cells of the
// tower→target ray, out to the tower's range. Air gating mirrors applySplash.
export function applyLine(state, tower, target, stats) {
  const ox = tower.px, oy = tower.py;
  let dx = target.x - ox, dy = target.y - oy;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  dx /= len; dy /= len;
  const rangePx = (tower.effectiveRange ? tower.effectiveRange(state) : stats.range) * SIZE;
  const widthPx = (stats.lineWidth || 0.5) * SIZE;
  const amt = baseDamage(state, stats, 1);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.flying && !stats.targetsAir) continue;   // ground line can't hit air
    const ex = e.x - ox, ey = e.y - oy;
    const along = ex * dx + ey * dy;               // px along the ray
    if (along < 0 || along > rangePx) continue;
    const perp = Math.abs(ex * dy - ey * dx);      // px off the ray
    if (perp <= widthPx) dealDamage(state, e, amt, stats);
  }
  pushBeam(state, ox, oy, ox + dx * rangePx, oy + dy * rangePx, (tower.def && tower.def.color) || '#e8ecf3');
}

function nearestUnhit(state, from, hit, rangeCells, targetsAir) {
  let best = null, bestD = Infinity;
  for (const e of state.enemies) {
    if (!e.alive || hit.has(e.id)) continue;
    if (e.flying && !targetsAir) continue;
    const d = cellDist(from.x / SIZE, from.y / SIZE, e.x / SIZE, e.y / SIZE);
    if (d <= rangeCells && d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// --- travelling projectiles -------------------------------------------------
export function spawnProjectile(state, x, y, target, stats, color) {
  pushEvent(state, 'shot', stats.damageType);
  state.projectiles.push({
    x, y,
    tx: target.x, ty: target.y,
    target,
    speed: stats.projectileSpeed * SIZE,    // px/sec
    stats,
    color,
    alive: true,
  });
}

export function updateProjectiles(state, dt) {
  for (const p of state.projectiles) {
    if (!p.alive) continue;
    if (p.target && p.target.alive) { p.tx = p.target.x; p.ty = p.target.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (dist <= step || dist < 0.001) { impact(state, p); p.alive = false; }
    else { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
  }
  if (state.projectiles.some((p) => !p.alive)) {
    state.projectiles = state.projectiles.filter((p) => p.alive);
  }
}

function impact(state, p) {
  const s = p.stats;
  if (s.splashRadius > 0) {
    applySplash(state, p.x, p.y, s.splashRadius, s, 1);
    pushSplash(state, p.x, p.y, s.splashRadius, p.color);
    // Cannon "Cluster" branch: 3 extra mini-blasts that re-splash.
    if (s.cluster > 0) {
      for (let i = 0; i < s.cluster; i++) {
        const ang = (i / s.cluster) * Math.PI * 2;
        const ox = p.x + Math.cos(ang) * SIZE * 0.9;
        const oy = p.y + Math.sin(ang) * SIZE * 0.9;
        applySplash(state, ox, oy, s.splashRadius * 0.8, s, 0.5);
        pushSplash(state, ox, oy, s.splashRadius * 0.8, p.color);
      }
    }
  } else if (p.target && p.target.alive) {
    dealDamage(state, p.target, baseDamage(state, s, 1), s);
    pushSpark(state, p.x, p.y, p.color);
  } else {
    pushSpark(state, p.x, p.y, p.color);
  }
}

// --- visual effects ---------------------------------------------------------
export function pushBeam(state, x1, y1, x2, y2, color) {
  state.effects.push({ kind: 'beam', x1, y1, x2, y2, color, life: 0.12, max: 0.12 });
}
export function pushChain(state, points, color) {
  state.effects.push({ kind: 'chain', points, color, life: 0.18, max: 0.18 });
}
export function pushSplash(state, x, y, r, color) {
  state.effects.push({ kind: 'splash', x, y, r, color, life: 0.25, max: 0.25 });
}
export function pushSpark(state, x, y, color) {
  state.effects.push({ kind: 'spark', x, y, color, life: 0.15, max: 0.15 });
}

export function updateEffects(state, dt) {
  for (const e of state.effects) e.life -= dt;
  if (state.effects.some((e) => e.life <= 0)) {
    state.effects = state.effects.filter((e) => e.life > 0);
  }
  if (state.frenzyTimer > 0) state.frenzyTimer -= dt;
}
