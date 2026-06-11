// =============================================================================
// wavebar.js — Kingdom-Rush-style wave control: a big NEXT WAVE button
// (bottom-right, shows the live early-start bonus) plus pulsing incoming
// chevrons anchored at the spawn mouths showing the next wave's dominant
// enemy + a FLY warning. Tapping either calls the wave in early.
// =============================================================================

import { CONFIG } from '../config.js';
import { waveInfoFor, winWave } from '../game/wave.js';
import { ROWS } from '../engine/grid.js';
import { div, EGLYPH } from './components.js';

export class WaveBar {
  constructor(uiLayer, viewport, actions) {
    this.ui = uiLayer;
    this.viewport = viewport;
    this.actions = actions;

    this.btn = document.createElement('button');
    this.btn.className = 'ui-btn green wavebtn';
    this.btn.addEventListener('click', () => this.actions.startWave());
    uiLayer.appendChild(this.btn);

    this.chevrons = [];        // [{el, cx, cy}]
    this._chevronWave = -1;    // wave the chevrons were built for
    this._visible = null;
  }

  // Rebuild the spawn chevrons for the upcoming wave (cheap, between waves).
  buildChevrons(state, nw) {
    for (const c of this.chevrons) c.el.remove();
    this.chevrons = [];
    if (nw > winWave(state)) return;
    const info = waveInfoFor(state, nw);
    const lead = info.types[0];
    const ecfg = CONFIG.ENEMIES[lead] || {};
    for (const s of state.map.spawns) {
      const el = div('chevron',
        `<span class="glyph" style="color:${ecfg.color || '#fff'}">${EGLYPH[lead] || '●'}</span>
         <span class="arrow">⌄</span>
         ${info.hasFlying ? '<span class="fly">FLY</span>' : ''}`);
      el.addEventListener('click', () => this.actions.startWave());
      this.ui.appendChild(el);
      this.chevrons.push({ el, cx: s.cx, cy: s.cy });
    }
    this.position();
  }

  // Anchor chevrons to their spawn cells (called on build + viewport resize).
  position() {
    for (const c of this.chevrons) {
      const p = this.viewport.worldToUi((c.cx + 0.5) * CONFIG.CELL, (c.cy + 0.5) * CONFIG.CELL);
      // nudge inward so border-mouth markers sit on the playfield
      const dx = c.cx === 0 ? 18 : 0;
      const dy = c.cy === 0 ? 18 : (c.cy === ROWS - 1 ? -18 : 0);
      c.el.style.left = (p.x + dx) + 'px';
      c.el.style.top = (p.y + dy) + 'px';
    }
  }

  refresh(state) {
    const nw = state.wave + 1;
    const over = state.status === 'won' || state.status === 'lost';
    const canStart = !state.waveActive && !over && nw <= winWave(state);

    // chevrons: only between waves, for the upcoming wave
    const showChevrons = canStart && state.hero;
    if (showChevrons && this._chevronWave !== nw) {
      this.buildChevrons(state, nw);
      this._chevronWave = nw;
    }
    if (this._visible !== showChevrons) {
      this._visible = showChevrons;
      for (const c of this.chevrons) c.el.style.display = showChevrons ? '' : 'none';
    }

    // button label + state
    this.btn.disabled = !canStart;
    this.btn.classList.toggle('siege', !!state.siege);
    let label;
    if (state.siege && state.waveActive) label = '⚠ WALLS UNDER ATTACK';
    else if (over) label = state.status === 'won' ? 'VICTORY' : 'DEFEAT';
    else if (state.waveActive) label = `WAVE ${state.wave} …`;
    else {
      const bonus = Math.floor(state.buildTimer * CONFIG.EARLY_START_BONUS_PER_SEC);
      label = bonus > 0 ? `NEXT WAVE ▶ |+${bonus}g` : 'NEXT WAVE ▶';
    }
    if (this._label !== label) {
      this._label = label;
      const [main, bonus] = label.split('|');
      this.btn.innerHTML = bonus ? `${main}<span class="bonus">${bonus}</span>` : main;
    }
  }
}
