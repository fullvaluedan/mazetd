// =============================================================================
// campaign-leaderboard.js -- device-local campaign stage scores. This is kept
// intentionally separate from Maze Mode's survival-time board.
// =============================================================================

const KEY = 'mazecore_campaign_leaderboard_v1';
const NAME_KEY = 'mazecore_campaign_name';
const MAX_ENTRIES_PER_LEVEL = 20;

// A life is deliberately worth more than a single unused gold piece. Keeping
// the weights here makes the score shown to players and its ordering auditable.
export const STAGE_SCORE_GOLD_VALUE = 1;
export const STAGE_SCORE_LIFE_VALUE = 100;

const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));
const cleanName = (name) => (name || 'Anon').toString().slice(0, 16).trim() || 'Anon';

export function calculateStageScore(gold, lives) {
  const goldLeft = whole(gold);
  const livesLeft = whole(lives);
  const goldPoints = goldLeft * STAGE_SCORE_GOLD_VALUE;
  const lifePoints = livesLeft * STAGE_SCORE_LIFE_VALUE;
  return { gold: goldLeft, lives: livesLeft, goldPoints, lifePoints, total: goldPoints + lifePoints };
}

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry) => entry && typeof entry.levelId === 'string' && typeof entry.score === 'number');
  } catch { return []; }
}

function compareScores(a, b) {
  return b.score - a.score || b.lives - a.lives || b.gold - a.gold || a.when - b.when || a.name.localeCompare(b.name);
}

export function getStageScores(levelId) {
  return readAll().filter((entry) => entry.levelId === levelId).sort(compareScores);
}

// Add an entry for one campaign stage. Returns the same rank/entries contract
// used by the Maze board so screen code stays straightforward.
export function addStageScore(levelId, name, { gold, lives, levelName = '', difficulty = '' }, whenMs = Date.now()) {
  const points = calculateStageScore(gold, lives);
  const entry = {
    levelId: String(levelId),
    levelName: String(levelName).slice(0, 48),
    difficulty: String(difficulty).slice(0, 24),
    name: cleanName(name),
    gold: points.gold,
    lives: points.lives,
    score: points.total,
    when: Number(whenMs) || Date.now(),
    date: new Date(Number(whenMs) || Date.now()).toISOString().slice(0, 10),
  };
  const all = readAll();
  all.push(entry);

  const byLevel = new Map();
  for (const item of all) {
    const entries = byLevel.get(item.levelId) || [];
    entries.push(item);
    byLevel.set(item.levelId, entries);
  }
  const kept = [];
  for (const entries of byLevel.values()) kept.push(...entries.sort(compareScores).slice(0, MAX_ENTRIES_PER_LEVEL));
  try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch { /* private mode */ }

  const entries = kept.filter((item) => item.levelId === entry.levelId).sort(compareScores);
  const rank = entries.indexOf(entry);
  return { rank: rank < 0 ? -1 : rank + 1, entries };
}

export function getCampaignLastName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}

export function setCampaignLastName(name) {
  try { localStorage.setItem(NAME_KEY, cleanName(name)); } catch { /* private mode */ }
}

// Test seam: never used by the game.
export function _clearCampaignScores() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(NAME_KEY); } catch { /* ignore */ }
}
