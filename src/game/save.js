// =============================================================================
// save.js — localStorage save/load + persistent high score.
//
// We snapshot the game only between waves (when the field is empty), so we don't
// have to serialise live enemies/projectiles. The snapshot captures the seed
// (to rebuild the exact same map), economy, hero progression and every tower; on
// load we rebuild a fresh state and replay those placements.
// =============================================================================

import { makeRng } from '../engine/rng.js';
import { setGridSize } from '../engine/grid.js';
import { CONFIG } from '../config.js';
import { canBuildAt, createState, onMazeChanged } from './state.js';
import { addTower, recomputeAuras } from './tower.js';
import { createHero } from './hero.js';
import { getLevel } from './levels.js';

const SAVE_KEY = 'mazecore_save_v1';
const HS_KEY = 'mazecore_highscore_v1';
// Campaign mid-run snapshots (U14): one slot per level id, separate from the
// single Endless slot above so campaign auto-saves never collide with (or
// get clobbered by) a manual Endless save/load.
const CAMPAIGN_SAVE_PREFIX = 'mazecore_campaign_save_v1:';

// Snapshot format version. v1: pre-siege (towers load at full HP); v2: towers
// carry hp; v3: tier-table upgrades (U5) — level/branch fields unchanged; v4:
// difficulty mode persists alongside the existing level/branch fields.
const SAVE_VERSION = 4;

function ls() { return (typeof localStorage !== 'undefined') ? localStorage : null; }

export function buildSnapshot(state) {
  return {
    v: SAVE_VERSION,
    levelId: state.level ? state.level.id : null,   // 'endless' or null (classic)
    seed: state.seed,
    difficultyMode: state.difficultyMode || 'expert',
    wave: state.wave,
    maxWave: state.maxWave,
    gold: Math.floor(state.gold),
    lives: state.lives,
    autoStart: state.autoStart,
    repairUses: state.repairUses,
    adFreeGoldWave: state.adFreeGoldWave,
    reviveUsed: state.reviveUsed,
    heroUpgrades: { ...state.heroUpgrades },
    towerBoosts: { ...state.towerBoosts },
    hero: state.hero ? {
      id: state.hero.id, level: state.hero.level, xp: state.hero.xp,
      bonuses: { ...state.hero.bonuses }, hp: state.hero.hp,
    } : null,
    towers: state.towers.map((t) => ({
      type: t.type, cx: t.cx, cy: t.cy, level: t.level,
      branch: t.branch, targetMode: t.targetMode, invested: t.invested,
      hp: Math.ceil(t.hp),
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

// --- campaign mid-run snapshots (U14) ---------------------------------------
// Same v4 snapshot shape as the Endless save above (buildSnapshot/applySnapshot
// are already level-aware via levelId), just keyed per campaign level so a
// resume prompt only ever offers to resume the level the player is entering.
function campaignKey(levelId) { return CAMPAIGN_SAVE_PREFIX + levelId; }

export function saveCampaign(state) {
  const store = ls(); if (!store) return false;
  if (!state.level || state.level.endless) return false;   // Endless uses the slot above
  try { store.setItem(campaignKey(state.level.id), JSON.stringify(buildSnapshot(state))); return true; }
  catch { return false; }
}

export function hasCampaignSave(levelId) {
  const s = ls(); return !!(s && levelId && s.getItem(campaignKey(levelId)));
}

export function clearCampaignSave(levelId) {
  const s = ls(); if (s && levelId) s.removeItem(campaignKey(levelId));
}

export function loadCampaignSnapshot(levelId) {
  const store = ls(); if (!store || !levelId) return null;
  try {
    const raw = store.getItem(campaignKey(levelId));
    const snap = raw ? JSON.parse(raw) : null;
    if (snap && snap.v > SAVE_VERSION) {
      console.warn(`campaign save is v${snap.v}, this client supports up to v${SAVE_VERSION} — refusing to load`);
      return null;
    }
    return snap;
  }
  catch { return null; }
}

export function loadSnapshot() {
  const store = ls(); if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    const snap = raw ? JSON.parse(raw) : null;
    // Version gate: older snapshots (v1/v2) load via applySnapshot's tolerant
    // field-defaulting; anything NEWER than this client is refused outright
    // rather than half-loaded (callers already treat null as "no save").
    if (snap && snap.v > SAVE_VERSION) {
      console.warn(`save is v${snap.v}, this client supports up to v${SAVE_VERSION} — refusing to load`);
      return null;
    }
    return snap;
  }
  catch { return null; }
}

// Rebuild a full game state from a snapshot (sizing the grid for its level).
export function applySnapshot(snap) {
  const level = snap.levelId ? getLevel(snap.levelId) : null;
  setGridSize(level ? level.cols : CONFIG.GRID_COLS, level ? level.rows : CONFIG.GRID_ROWS);
  const state = createState(makeRng(snap.seed), snap.seed, level, { difficultyMode: snap.difficultyMode || 'expert' });
  state.wave = snap.wave;
  state.maxWave = snap.maxWave;
  state.gold = snap.gold;
  state.lives = snap.lives;
  state.autoStart = !!snap.autoStart;
  state.repairUses = snap.repairUses || 0;
  if (snap.adFreeGoldWave != null) state.adFreeGoldWave = snap.adFreeGoldWave;
  state.reviveUsed = !!snap.reviveUsed;
  state.heroUpgrades = { ...snap.heroUpgrades };
  if (snap.towerBoosts) state.towerBoosts = { ...snap.towerBoosts };
  state.status = 'playing';

  for (const tw of snap.towers) {
    if (state.towerGrid[tw.cy] && canBuildAt(state, tw.cx, tw.cy, tw.type)) {
      const t = addTower(state, tw.type, tw.cx, tw.cy);
      t.level = tw.level; t.branch = tw.branch;
      t.targetMode = tw.targetMode; t.invested = tw.invested;
      t.refreshStats();
      // v2+ saves carry wall damage; v1 (no hp field) loads at full HP.
      t.hp = Math.min(t.maxHp, tw.hp != null ? tw.hp : t.maxHp);
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
  recomputeAuras(state);   // replayed levels/branches change Beacon strengths
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
