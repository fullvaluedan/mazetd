// =============================================================================
// leaderboard.js — the Maze Mode local leaderboard (localStorage). Stores the
// best survival times: how long the player kept the horde contained in their
// maze. UI-layer only; the sim never reads it. Same private-mode-safe pattern
// as services/profile.js.
//
// v1 is device-local. An online board (Cloudflare Worker + D1, which the
// account already has) is a clean follow-up: swap the get/add internals for
// fetch() and keep this module's surface identical.
// =============================================================================

const KEY = 'mazecore_maze_leaderboard_v1';
const NAME_KEY = 'mazecore_maze_name';
const MAX_ENTRIES = 20;

// Format seconds as M:SS.d (e.g. 94.3 -> "1:34.3", 8.2 -> "0:08.2").
export function formatMazeTime(sec) {
  const s = Math.max(0, sec || 0);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`;
}

export function getScores() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.time === 'number').sort((a, b) => b.time - a.time);
  } catch { return []; }
}

// Add a score. Returns { rank, entries } where rank is the 1-based position of
// the new entry in the trimmed board (or -1 if it didn't make the cut).
export function addScore(name, time, whenMs) {
  const entry = {
    name: (name || 'Anon').toString().slice(0, 16).trim() || 'Anon',
    time,
    date: new Date(whenMs || Date.now()).toISOString().slice(0, 10),
  };
  const all = getScores();
  all.push(entry);
  all.sort((a, b) => b.time - a.time);
  const kept = all.slice(0, MAX_ENTRIES);
  try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch { /* private mode */ }
  const rank = kept.indexOf(entry);
  return { rank: rank < 0 ? -1 : rank + 1, entries: kept };
}

export function bestTime() {
  const s = getScores();
  return s.length ? s[0].time : 0;
}

export function getLastName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}

export function setLastName(name) {
  try { localStorage.setItem(NAME_KEY, (name || '').slice(0, 16)); } catch { /* private mode */ }
}

// Test seam: wipe the board (never called by the game).
export function _clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
