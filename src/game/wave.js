// =============================================================================
// wave.js — wave scaling formulas + the spawn runtime.
//
// The scaling math (HP/speed/count/bounty) and the spawn runtime (a time-ordered
// queue that releases enemies on a stagger) are the final versions. Only the
// *composition* — which enemy types appear in a wave — is expanded in Phase 5;
// Phase 2 uses a plain stream of Grunts so we can watch them traverse and leak.
// =============================================================================

import { CONFIG } from '../config.js';
import { Enemy } from './enemy.js';

// ---- scaling formulas (BUILD_PROMPT §5) ------------------------------------
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

// Compute concrete stats for one enemy of `type` on wave `w`.
export function computeStats(state, type, w) {
  const def = CONFIG.ENEMIES[type];
  let hpMult = def.boss ? bossHpMult(w) : def.hpMult;
  const hp = Math.max(1, Math.floor(baseHp(w) * hpMult * CONFIG.DIFFICULTY));
  const speed = CONFIG.ENEMY_BASE_SPEED * def.speedMult * waveSpeedFactor(w);
  const bounty = Math.max(1, Math.floor(waveBounty(w) * def.bountyMult));
  return { hp, speed, bounty };
}

// ---- composition -----------------------------------------------------------
// Returns a list of {type, spawnId, goalId, time} ordered by spawn time.
// Phase 2: Grunts only, spread across all spawns. (Phase 5 makes this the full
// procedural generator with the type-introduction schedule and boss waves.)
export function buildWave(state, w) {
  const entries = [];
  const spawns = state.map.spawns;
  const count = enemyCount(w);
  for (let i = 0; i < count; i++) {
    const spawn = spawns[i % spawns.length];
    entries.push({
      type: 'normal',
      spawnId: spawn.id,
      goalId: state.routing[spawn.id],
      time: i * CONFIG.SPAWN_STAGGER,
    });
  }
  entries.sort((a, b) => a.time - b.time);
  return entries;
}

// ---- runtime ---------------------------------------------------------------
export function startWave(state, w) {
  state.wave = w;
  state.maxWave = Math.max(state.maxWave, w);
  state.spawnQueue = buildWave(state, w);
  state.spawnElapsed = 0;
  state.waveActive = true;
  state.status = 'playing';
}

// Release any enemies whose scheduled time has arrived.
export function processSpawning(state, dt) {
  if (!state.waveActive || !state.spawnQueue) return;
  state.spawnElapsed += dt;
  while (state.spawnQueue.length && state.spawnQueue[0].time <= state.spawnElapsed) {
    const sp = state.spawnQueue.shift();
    const stats = computeStats(state, sp.type, state.wave);
    state.enemies.push(new Enemy(state, sp.type, sp.spawnId, sp.goalId, stats));
  }
}

// A wave is done when nothing is queued and nothing is on the field.
export function waveComplete(state) {
  return state.waveActive && state.spawnQueue && state.spawnQueue.length === 0 && state.enemies.length === 0;
}
