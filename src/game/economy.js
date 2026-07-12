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

function goldModeMultiplier(state) {
  return CONFIG.DIFFICULTY_MODES[state && state.difficultyMode] ? CONFIG.DIFFICULTY_MODES[state.difficultyMode].goldMult : 1;
}

export function gainGold(state, amt) {
  const mult = goldModeMultiplier(state);
  const added = amt > 0 ? Math.ceil(amt * mult) : amt;
  state.gold += added;
  return added;
}

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
  const awarded = gainGold(state, e.bounty);
  addFloater(state, e.x, e.y - e.radius, '+' + awarded, CONFIG.COLORS.gold);
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
  // Maze Mode: leaks are the expected end state (nothing can kill the mobs),
  // so a leak just removes the mob — no life loss, no red flash/shake framing.
  // The survival timer, not lives, decides the run.
  if (state.level && state.level.mazeMode) {
    pushEvent(state, 'leak');
    return;
  }
  state.lives -= e.damageToLives;
  // Render-only objective reaction. This does not alter leak accounting.
  state.crystalBreakUntil = Math.max(state.crystalBreakUntil || 0, state.time + 0.72);
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
  // GOLD_PER_ROUND_SCALE (-35%, user 2026-07-08) hits only the wave-clear
  // bonus and (in wave.js computeStats) kill bounties; the difficulty mode
  // multiplier below then scales all earned gold for the chosen preset.
  const bonus = Math.floor((CONFIG.WAVECLEAR_BASE + CONFIG.WAVECLEAR_PER_WAVE * waveNum) * mult * CONFIG.GOLD_PER_ROUND_SCALE);
  const bonusAwarded = gainGold(state, bonus);
  const interest = Math.min(CONFIG.INTEREST_CAP, Math.floor(state.gold * CONFIG.INTEREST_RATE));
  const interestAwarded = gainGold(state, interest);
  // Income towers (U6): flat stats.income gold per tower, paid only here.
  // Added after interest so the interest math is still based on the current
  // post-bonus cash pile.
  let incomeAwarded = 0;
  for (const t of state.towers) {
    const inc = t.stats && t.stats.income;
    if (inc > 0) {
      const awarded = gainGold(state, inc);
      incomeAwarded += awarded;
      addFloater(state, t.px, t.py, '+' + awarded + 'g', CONFIG.COLORS.gold);
    }
  }
  return { bonus: bonusAwarded, interest: interestAwarded, income: incomeAwarded };
}

// Early-start bonus cap for calling wave `w` the instant its build timer
// opens (elapsed=0): 10/15/20/... +5g per wave (user 2026-07-08).
export function earlyStartCap(wave = 1) {
  return CONFIG.WAVE_CALL_BONUS_BASE + CONFIG.WAVE_CALL_BONUS_PER_WAVE * Math.max(0, wave - 1);
}

// Early-start bonus: starts at earlyStartCap(wave) the instant the timer
// opens and decays 1g per second elapsed since then (same rate as before —
// only the starting cap is now wave-dependent instead of flat).
export function payEarlyStart(state, secondsLeft, wave) {
  const elapsed = Math.max(0, CONFIG.BUILD_TIMER - secondsLeft);
  const bonus = Math.max(0, Math.floor(earlyStartCap(wave) - elapsed * CONFIG.EARLY_START_BONUS_PER_SEC));
  return bonus > 0 ? gainGold(state, bonus) : 0;
}

// Advance floating numbers; drop expired ones.
export function updateFloaters(state, dt) {
  for (const f of state.floaters) { f.life -= dt; f.y += f.vy * dt; }
  if (state.floaters.some((f) => f.life <= 0)) {
    state.floaters = state.floaters.filter((f) => f.life > 0);
  }
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.5);
}
