// =============================================================================
// economy.js — gold, lives, and the events that change them.
//
// Kills award bounty (+ hero XP). Leaks cost lives based on the enemy's
// damageToLives. Wave clears pay a bonus plus optional interest on savings, and
// calling a wave in early pays an early-start bonus. All numbers come from CONFIG.
// =============================================================================

import { CONFIG } from '../config.js';
import { pushEvent } from './state.js';

export function canAfford(state, cost) { return state.gold >= cost; }

export function spendGold(state, cost) {
  if (state.gold < cost) return false;
  state.gold -= cost;
  return true;
}

export function addGold(state, amt) { state.gold += amt; }

// Floating number helper (damage/gold popups).
export function addFloater(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 0.9, max: 0.9, vy: -28 });
}

// --- juice: screen shake + death particles -------------------------------
export function addShake(state, amt) { state.shake = Math.min(12, (state.shake || 0) + amt); }

const PARTICLE_CAP = 160;   // bounds headless runs (which never drain the list)
function spawnParticles(state, x, y, color, n) {
  if (!state.particles || state.particles.length > PARTICLE_CAP) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 70;
    state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, max: 0.7, color });
  }
}

export function updateParticles(state, dt) {
  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; }
  if (state.particles.some((p) => p.life <= 0)) state.particles = state.particles.filter((p) => p.life > 0);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
}

export function onEnemyKilled(state, e) {
  addGold(state, e.bounty);
  addFloater(state, e.x, e.y - e.radius, '+' + e.bounty, CONFIG.COLORS.gold);
  spawnParticles(state, e.x, e.y, e.color, e.boss ? 18 : 4);
  pushEvent(state, 'death');
  if (e.boss) addShake(state, 8);
  // Hero XP (Phase 6): the hero, if present, earns XP for kills near it / overall.
  if (state.hero && typeof state.hero.gainXp === 'function') {
    state.hero.gainXp(e.boss ? 60 : Math.max(2, Math.round(e.maxHp * 0.02)), state);
  }
  // Contagion (Venom L4B): on death, spread remaining poison to nearby enemies.
  if (e._contagion && e.poison.length) spreadContagion(state, e);
}

function spreadContagion(state, e) {
  const r = 1.6; // cells
  const best = e.poison.reduce((a, b) => (b.dps > a.dps ? b : a), e.poison[0]);
  for (const o of state.enemies) {
    if (!o.alive || o === e) continue;
    const dxc = (o.x - e.x) / CONFIG.CELL, dyc = (o.y - e.y) / CONFIG.CELL;
    if (dxc * dxc + dyc * dyc <= r * r) o.applyPoison(best.dps, 2.5, state);
  }
}

export function onEnemyLeaked(state, e) {
  state.lives -= e.damageToLives;
  addFloater(state, e.x, e.y, '-' + e.damageToLives + '♥', CONFIG.COLORS.danger);
  pushEvent(state, 'leak');
  state.flash = Math.min(1, (state.flash || 0) + 0.5);   // red screen flash
  addShake(state, 3 + e.damageToLives);
  if (state.lives <= 0) {
    state.lives = 0;
    state.status = 'lost';
  }
}

// Wave-clear payout: flat bonus + interest on current gold (capped).
// Campaign levels scale the flat bonus with waves.waveclearMult — the global
// constants were tuned for the 100-wave classic board and drown small maps.
export function payWaveClear(state, waveNum) {
  const lv = state.level && state.level.waves;
  const mult = lv && lv.waveclearMult != null ? lv.waveclearMult : 1;
  const bonus = Math.floor((CONFIG.WAVECLEAR_BASE + CONFIG.WAVECLEAR_PER_WAVE * waveNum) * mult);
  addGold(state, bonus);
  const interest = Math.min(CONFIG.INTEREST_CAP, Math.floor(state.gold * CONFIG.INTEREST_RATE));
  addGold(state, interest);
  return { bonus, interest };
}

// Early-start bonus: gold for each whole second left on the build timer.
export function payEarlyStart(state, secondsLeft) {
  const bonus = Math.max(0, Math.floor(secondsLeft * CONFIG.EARLY_START_BONUS_PER_SEC));
  if (bonus > 0) addGold(state, bonus);
  return bonus;
}

// Advance floating numbers; drop expired ones.
export function updateFloaters(state, dt) {
  for (const f of state.floaters) { f.life -= dt; f.y += f.vy * dt; }
  if (state.floaters.some((f) => f.life <= 0)) {
    state.floaters = state.floaters.filter((f) => f.life > 0);
  }
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.5);
}
