// =============================================================================
// hints.js — first-run onboarding for the radial-menu UI. A persistent banner
// walks brand-new players through: tap a cell -> pick a tower -> wall a path
// and call the wave (-> move your hero, when heroes are enabled). Done forever
// once wave 1 is cleared.
// =============================================================================

import { CONFIG } from '../config.js';

const KEY = 'mazecore_tutorial_done_v2';

export function createHints(overlay, hud) {
  let done = false;
  try { done = !!localStorage.getItem(KEY); } catch { done = true; }
  let el = null, last = '';

  function current(state) {
    if (done || (CONFIG.HEROES_ENABLED && !state.hero) || (state.status !== 'setup' && state.status !== 'playing')) return '';
    if (state.wave === 0 && state.towers.length === 0) {
      return hud.radialOpen
        ? 'Pick a tower — gold price shown under each. Long-press one for details.'
        : 'Tap a cell to build one tower — or DRAG across cells to build a whole row at once.';
    }
    if (state.wave === 0 && state.towers.length > 0 && !state.waveActive) {
      return 'Wall off a long, winding path — then hit NEXT WAVE. Starting early pays gold!';
    }
    if (state.wave === 1 && state.waveActive) {
      return CONFIG.HEROES_ENABLED
        ? 'Enemies follow the dotted path. Tap your hero, then the ground, to move them.'
        : 'Enemies follow the dotted path. Sell and rebuild walls to bend it mid-wave!';
    }
    return '';
  }

  return {
    update(state) {
      const text = current(state);
      if (text === last) return;
      last = text;
      if (!el) {
        el = document.createElement('div');
        el.className = 'banner warn';
        overlay.appendChild(el);
      }
      el.textContent = text;
      el.classList.toggle('show', !!text);
    },
    finish() {
      if (done) return;
      done = true;
      try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
    },
  };
}
