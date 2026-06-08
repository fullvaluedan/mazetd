// =============================================================================
// save.js — localStorage save/load + persistent high score.
//
// We snapshot the game only between waves (when the field is empty), so we don't
// have to serialise live enemies/projectiles. The snapshot captures the seed
// (to rebuild the exact same map), economy, hero progression and every tower; on
// load we rebuild a fresh state and replay those placements.
// =============================================================================

import { makeRng } from '../engine/rng.js';
import { createState, onMazeChanged } from './state.js';
import { addTower } from './tower.js';
import { createHero } from './hero.js';

const SAVE_KEY = 'mazecore_save_v1';
const HS_KEY = 'mazecore_highscore_v1';

function ls() { return (typeof localStorage !== 'undefined') ? localStorage : null; }

export function buildSnapshot(state) {
  return {
    v: 1,
    seed: state.seed,
    wave: state.wave,
    maxWave: state.maxWave,
    gold: Math.floor(state.gold),
    lives: state.lives,
    autoStart: state.autoStart,
    repairUses: state.repairUses,
    heroUpgrades: { ...state.heroUpgrades },
    hero: state.hero ? {
      id: state.hero.id, level: state.hero.level, xp: state.hero.xp,
      bonuses: { ...state.hero.bonuses }, hp: state.hero.hp,
    } : null,
    towers: state.towers.map((t) => ({
      type: t.type, cx: t.cx, cy: t.cy, level: t.level,
      branch: t.branch, targetMode: t.targetMode, invested: t.invested,
    })),
  };
}

export function saveGame(state) {
  const store = ls(); if (!store) return false;
  try { store.setItem(SAVE_KEY, JSON.stringify(buildSnapshot(state))); return true; }
  catch { return false; }
}

export function hasSave() { const s = ls(); return !!(s && s.getItem(SAVE_KEY)); }
export function clearSave() { const s = ls(); if (s) s.removeItem(SAVE_KEY); }

export function loadSnapshot() {
  const store = ls(); if (!store) return null;
  try { const raw = store.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}

// Rebuild a full game state from a snapshot.
export function applySnapshot(snap) {
  const state = createState(makeRng(snap.seed), snap.seed);
  state.wave = snap.wave;
  state.maxWave = snap.maxWave;
  state.gold = snap.gold;
  state.lives = snap.lives;
  state.autoStart = !!snap.autoStart;
  state.repairUses = snap.repairUses || 0;
  state.heroUpgrades = { ...snap.heroUpgrades };
  state.status = 'playing';

  for (const tw of snap.towers) {
    if (state.towerGrid[tw.cy] && !state.towerGrid[tw.cy][tw.cx]) {
      const t = addTower(state, tw.type, tw.cx, tw.cy);
      t.level = tw.level; t.branch = tw.branch;
      t.targetMode = tw.targetMode; t.invested = tw.invested;
      t.refreshStats();
    }
  }
  if (snap.hero) {
    const h = createHero(state, snap.hero.id);
    h.level = snap.hero.level; h.xp = snap.hero.xp;
    h.bonuses = { ...snap.hero.bonuses };
    h.recompute();
    h.hp = Math.min(h.maxHp, snap.hero.hp);
  }
  onMazeChanged(state);
  return state;
}

// --- high score (best wave reached) ---
export function getHighScore() {
  const s = ls(); if (!s) return 0;
  return Number(s.getItem(HS_KEY) || 0);
}
export function recordHighScore(wave) {
  const s = ls(); if (!s) return;
  if (wave > getHighScore()) s.setItem(HS_KEY, String(wave));
}
