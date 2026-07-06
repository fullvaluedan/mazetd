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

const CHEV_SIZE = 40;   // chevron footprint in CSS px, for edge spacing/clamping

// Pure math for chevron anchoring (exported for the headless tests). Takes the
// worldToUi anchor points in spawn order plus the visible CSS box, and returns
// each chevron's final position: on-screen anchors pass through untouched;
// off-screen anchors pin to the edge with the biggest overshoot (the "nearest"
// one), chevrons sharing an edge offset along it in spawn order without
// overlapping, and everything clamps inside the safe-area inset rect.
// box: { w, h, inset: {left, top, right, bottom}, size } -> [{x, y, pinned, edge}]
export function pinChevrons(points, box) {
  const { w, h, inset = { left: 0, top: 0, right: 0, bottom: 0 }, size = CHEV_SIZE } = box;
  const half = size / 2;
  const L = inset.left + half, T = inset.top + half;
  const R = w - inset.right - half, B = h - inset.bottom - half;
  const out = points.map(({ x, y }) => {
    if (x >= L && x <= R && y >= T && y <= B) return { x, y, pinned: false, edge: null };
    const over = { left: L - x, right: x - R, top: T - y, bottom: y - B };
    const edge = Object.keys(over).reduce((a, b) => (over[b] > over[a] ? b : a));
    const p = {
      x: Math.min(Math.max(x, L), R),
      y: Math.min(Math.max(y, T), B),
      pinned: true, edge,
    };
    if (edge === 'left') p.x = L; else if (edge === 'right') p.x = R;
    else if (edge === 'top') p.y = T; else p.y = B;
    return p;
  });
  // Chevrons sharing an edge: keep spawn order, push apart along the edge,
  // then back the tail off the far corner while preserving the separation.
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const grp = out.filter((p) => p.edge === edge);
    if (grp.length < 2) continue;
    const axis = (edge === 'left' || edge === 'right') ? 'y' : 'x';
    const far = axis === 'y' ? B : R;
    for (let i = 1; i < grp.length; i++) {
      grp[i][axis] = Math.max(grp[i][axis], grp[i - 1][axis] + size);
    }
    for (let i = grp.length - 1; i >= 0; i--) {
      grp[i][axis] = Math.min(grp[i][axis], far - (grp.length - 1 - i) * size);
    }
  }
  return out;
}

// Measure env(safe-area-inset-*) once per letterbox: a throwaway padded div is
// the simplest thing that works everywhere (CSS max() can't join JS-set left/
// top). Notch insets are window-relative; applying them straight to the #ui
// box is conservative when the letterbox already clears the notch — fine.
function measureSafeInsets() {
  if (typeof window === 'undefined' || !window.getComputedStyle || !document.body) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
    'env(safe-area-inset-bottom) env(safe-area-inset-left);';
  document.body.appendChild(el);
  const cs = window.getComputedStyle(el);
  const n = (v) => parseFloat(v) || 0;
  const insets = { left: n(cs.paddingLeft), top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom) };
  el.remove();
  return insets;
}

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

  // Anchor chevrons to their spawn cells (called on build + viewport resize +
  // every camera change). Spawns panned/zoomed off-screen pin to the nearest
  // edge with the arrow turned toward them (see pinChevrons).
  position() {
    if (!this.chevrons.length) return;
    const pts = this.chevrons.map((c) => {
      const p = this.viewport.worldToUi((c.cx + 0.5) * CONFIG.CELL, (c.cy + 0.5) * CONFIG.CELL);
      // nudge inward so border-mouth markers sit on the playfield
      const dx = c.cx === 0 ? 18 : 0;
      const dy = c.cy === 0 ? 18 : (c.cy === ROWS - 1 ? -18 : 0);
      return { x: p.x + dx, y: p.y + dy };
    });
    const placed = pinChevrons(pts, {
      w: this.viewport.cssW, h: this.viewport.cssH,
      inset: this._safeInsets(), size: CHEV_SIZE,
    });
    this.chevrons.forEach((c, i) => {
      c.el.style.left = placed[i].x + 'px';
      c.el.style.top = placed[i].y + 'px';
      c.el.classList.toggle('pinned', placed[i].pinned);
      c.el.dataset.edge = placed[i].edge || '';   // rotates the arrow via CSS
    });
  }

  // Safe-area insets, re-measured only when the letterbox changes (position()
  // runs on every pan frame; a DOM measure there would be too hot).
  _safeInsets() {
    const key = this.viewport.cssW + 'x' + this.viewport.cssH;
    if (!this._insets || this._insetKey !== key) {
      this._insets = measureSafeInsets();
      this._insetKey = key;
    }
    return this._insets;
  }

  refresh(state) {
    const nw = state.wave + 1;
    const over = state.status === 'won' || state.status === 'lost';
    const canStart = !state.waveActive && !over && nw <= winWave(state);

    // chevrons: only between waves, for the upcoming wave (the old state.hero
    // check was a "game fully booted" proxy from the hero era)
    const showChevrons = canStart && (state.hero || !CONFIG.HEROES_ENABLED);
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
