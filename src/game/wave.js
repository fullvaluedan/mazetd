// =============================================================================
// wave.js — wave scaling, the procedural composition generator, the spawn
// runtime, and boss abilities (BUILD_PROMPT §5).
//
// Type-introduction schedule:
//   1–5 normal · 6+ fast · 10 first boss (every 10th is a boss wave) ·
//   12+ swarm (in packs) · 15+ flyer (wave 15 is a guaranteed flyer wave, and
//   the next-wave preview warns one wave ahead) · 20+ tank · 25+ shield ·
//   30+ healer · 40+ mix 2–3 types & vary which spawns/goals are used ·
//   50 boss flies · 100 two bosses (one flying) + heavy escort.
//
// waveInfo(w) is deterministic per wave (seeded by SEED+w) so the HUD preview
// always matches what actually spawns.
// =============================================================================

import { CONFIG } from '../config.js';
import { makeRng } from '../engine/rng.js';
import { cellCenter } from '../engine/grid.js';
import { Enemy } from './enemy.js';
import { defaultRouting, recomputePaths } from './state.js';

// ---- scaling formulas ------------------------------------------------------
export function baseHp(w) {
  return Math.floor(CONFIG.HP_BASE * (1 + CONFIG.HP_LINEAR * w) * Math.pow(CONFIG.HP_EXP, w));
}
export function bossHpMult(w) {
  const t = Math.min(1, w / CONFIG.WIN_WAVE);
  return CONFIG.BOSS_HP_MULT_MIN + (CONFIG.BOSS_HP_MULT_MAX - CONFIG.BOSS_HP_MULT_MIN) * t;
}
export function waveSpeedFactor(w) {
  return Math.min(CONFIG.SPEED_WAVE_CAP, 1 + CONFIG.SPEED_WAVE_FACTOR * w);
}
export function enemyCount(w) {
  return Math.floor(CONFIG.COUNT_BASE + CONFIG.COUNT_PER_WAVE * w);
}
export function waveBounty(w) {
  return Math.floor(CONFIG.BOUNTY_BASE + CONFIG.BOUNTY_PER_WAVE * w);
}

export function computeStats(state, type, w) {
  const def = CONFIG.ENEMIES[type];
  const hpMult = def.boss ? bossHpMult(w) : def.hpMult;
  const hp = Math.max(1, Math.floor(baseHp(w) * hpMult * CONFIG.DIFFICULTY));
  const speed = CONFIG.ENEMY_BASE_SPEED * def.speedMult * waveSpeedFactor(w);
  const bounty = Math.max(1, Math.floor(waveBounty(w) * def.bountyMult));
  return { hp, speed, bounty };
}

// ---- composition -----------------------------------------------------------
function availableTypes(w) {
  const t = ['normal'];
  if (w >= 6) t.push('fast');
  if (w >= 12) t.push('swarm');
  if (w >= 15) t.push('flyer');
  if (w >= 20) t.push('tank');
  if (w >= 25) t.push('shield');
  if (w >= 30) t.push('healer');
  return t;
}

function mixTypes(w, rng, n) {
  const avail = availableTypes(w);
  const chosen = new Set();
  // Guarantee a flyer wave at 15/17, and sprinkle flyers after that.
  if (w >= 15 && (w === 15 || w === 17 || rng.chance(0.35))) chosen.add('flyer');
  // The newest unlocked type shows up often so the player meets it.
  if (rng.chance(0.6)) chosen.add(avail[avail.length - 1]);
  let guard = 0;
  while (chosen.size < n && guard++ < 20) chosen.add(rng.pick(avail));
  if (chosen.size === 0) chosen.add('normal');
  return [...chosen];
}

// Deterministic per-wave summary used by the preview AND as the type source for
// the actual generator (so they can never disagree).
export function waveInfo(w) {
  const rng = makeRng((CONFIG.SEED * 7919 + w) >>> 0);
  const isBoss = w % 10 === 0;
  const n = isBoss ? (w >= 40 ? 3 : 2) : (w >= 40 ? 3 : w >= 20 ? 2 : 1);
  const types = mixTypes(w, rng, n);
  let hasFlying = types.includes('flyer');
  let bossFlying = false;
  if (isBoss) {
    if (w === 50 || w === 100) { bossFlying = true; hasFlying = true; }
    types.push('boss');
  }
  return { types: [...new Set(types)], hasFlying, isBoss, bossFlying, count: enemyCount(w) };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Decide which spawns are used this wave and which goal each routes to.
function setupWaveRouting(state, w, rng) {
  const spawnIds = state.map.spawns.map((s) => s.id);
  const goalIds = state.map.goals.map((g) => g.id);
  if (w < 40) {
    defaultRouting(state);                 // nearest goal per spawn
    state.activeSpawns = spawnIds.slice();
  } else {
    // vary attack direction: 2–3 spawns, random goal each
    const n = rng.int(2, spawnIds.length);
    state.activeSpawns = shuffle(spawnIds, rng).slice(0, n);
    for (const sid of spawnIds) state.routing[sid] = rng.pick(goalIds);
  }
  recomputePaths(state);
}

// Build the time-ordered spawn list for wave w. Uses waveInfo() for the type set
// (preview-consistent) and a separate rng for placement/timing.
export function buildWave(state, w) {
  const info = waveInfo(w);
  const rng = makeRng((CONFIG.SEED * 104729 + w) >>> 0);
  const active = state.activeSpawns;
  const goalFor = (sid) => state.routing[sid];
  const stagger = CONFIG.SPAWN_STAGGER;
  const entries = [];
  let t = 0;

  if (info.isBoss) {
    const groundTypes = info.types.filter((x) => x !== 'boss');
    const escort = Math.floor(enemyCount(w) * (w === 100 ? 1.2 : 0.7));
    for (let i = 0; i < escort; i++) {
      const sid = active[i % active.length];
      const type = groundTypes.length ? rng.pick(groundTypes) : 'normal';
      pushEnemy(entries, type, sid, goalFor(sid), t);
      t += stagger * 0.6;
    }
    const bossCount = w === 100 ? 2 : 1;
    for (let b = 0; b < bossCount; b++) {
      const sid = active[b % active.length];
      const flying = (w === 50) || (w === 100 && b === 1);
      entries.push({ type: 'boss', spawnId: sid, goalId: goalFor(sid), time: t + 1.0, flying, bossTier: w / 10 });
      t += 2.0;
    }
  } else {
    const types = info.types;
    const count = enemyCount(w);
    for (let i = 0; i < count; i++) {
      const sid = active[i % active.length];
      const type = rng.pick(types);
      pushEnemy(entries, type, sid, goalFor(sid), t);
      // swarm arrives in a tight pack
      if (type === 'swarm') {
        const pack = rng.int(CONFIG.SWARM_PACK_MIN, CONFIG.SWARM_PACK_MAX) - 1;
        for (let k = 0; k < pack; k++) pushEnemy(entries, 'swarm', sid, goalFor(sid), t + 0.06 * (k + 1));
      }
      t += stagger;
    }
  }
  entries.sort((a, b) => a.time - b.time);
  return entries;
}

function pushEnemy(entries, type, spawnId, goalId, time) {
  entries.push({ type, spawnId, goalId, time });
}

// ---- runtime ---------------------------------------------------------------
export function startWave(state, w) {
  const rng = makeRng((CONFIG.SEED * 31337 + w) >>> 0);
  state.wave = w;
  state.maxWave = Math.max(state.maxWave, w);
  setupWaveRouting(state, w, rng);
  state.spawnQueue = buildWave(state, w);
  state.spawnElapsed = 0;
  state.waveActive = true;
  state.status = 'playing';
}

export function processSpawning(state, dt) {
  if (!state.waveActive || !state.spawnQueue) return;
  state.spawnElapsed += dt;
  while (state.spawnQueue.length && state.spawnQueue[0].time <= state.spawnElapsed) {
    const sp = state.spawnQueue.shift();
    const stats = computeStats(state, sp.type, state.wave);
    const opts = {};
    if (sp.flying != null && sp.type === 'boss') opts.flying = sp.flying;
    if (sp.bossTier) opts.bossTier = sp.bossTier;
    state.enemies.push(new Enemy(state, sp.type, sp.spawnId, sp.goalId, stats, opts));
  }
}

// Boss abilities: periodic heal, swarmling spawns, speed burst, slow-immunity.
export function updateBosses(state, dt) {
  for (const e of state.enemies) {
    if (!e.alive || !e.boss) continue;
    const kit = e.bossKit;
    if (kit.heal) {
      e.healTimer -= dt;
      if (e.healTimer <= 0) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05);
        e.healTimer = 6;
        state.effects.push({ kind: 'splash', x: e.x, y: e.y, r: 1.2, color: '#5fce7a', life: 0.3, max: 0.3 });
      }
    }
    if (kit.spawn) {
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) {
        e.spawnTimer = 8;
        const n = 3;
        const stats = computeStats(state, 'swarm', state.wave);
        for (let i = 0; i < n; i++) {
          const s = new Enemy(state, 'swarm', e.spawnId, e.goalId, stats);
          s.x = e.x; s.y = e.y; s.cx = e.cx; s.cy = e.cy;
          if (!s.flying) s.advanceTarget(state);
          state.enemies.push(s);
        }
      }
    }
    if (kit.burst) {
      e.burstTimer -= dt;
      if (e.burstTimer <= 0) { e.burstTimer = 12; e.burstLeft = 2; }
    }
    if (kit.immune) {
      e.immuneTimer -= dt;
      if (e.immuneTimer <= 0) { e.immuneTimer = 14; e.slowImmuneLeft = 2.5; }
    }
  }
}

export function waveComplete(state) {
  return state.waveActive && state.spawnQueue && state.spawnQueue.length === 0 && state.enemies.length === 0;
}
