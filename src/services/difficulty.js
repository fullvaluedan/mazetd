// =============================================================================
// difficulty.js — persistent campaign difficulty selection.
//
// The title/menu flow stores the player's chosen difficulty here so the map
// screen and level links can preserve it across reloads.
// =============================================================================

import { CONFIG } from '../config.js';

const KEY = 'mazecore_difficulty_mode_v1';

export function normalizeDifficultyMode(mode) {
  return CONFIG.DIFFICULTY_MODES[mode] ? mode : 'expert';
}

export function getDifficultyMode() {
  try {
    return normalizeDifficultyMode(localStorage.getItem(KEY));
  } catch {
    return 'expert';
  }
}

export function setDifficultyMode(mode) {
  const next = normalizeDifficultyMode(mode);
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  return next;
}

export function difficultyLabel(mode = getDifficultyMode()) {
  const m = normalizeDifficultyMode(mode);
  if (m === 'expert') return 'EXPERT MODE';
  if (m === 'normal') return 'Normal';
  if (m === 'easy') return 'Easy';
  return m;
}

export function difficultySummary(mode = getDifficultyMode()) {
  const m = normalizeDifficultyMode(mode);
  const d = CONFIG.DIFFICULTY_MODES[m];
  return `+${Math.round((d.goldMult - 1) * 100)}% gold, towers ${Math.round((d.towerDamageMult - 1) * 100)}% stronger`;
}
