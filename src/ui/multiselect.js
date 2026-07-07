// =============================================================================
// multiselect.js — U21 marquee multi-select: the bottom-left mode toggle (the
// corner the hero dock freed up) and the batch chooser card.
//
// Toggle ON: input.js turns one-pointer drags into a world-space marquee
// (two-finger pan/pinch and wheel zoom untouched) and render.js tints the
// covered cells live. On release main.js hands the rect here: the card offers
// one build row per unlocked tower type ("<name> xN — <total>g"; a row greys
// out only when even ONE cell is unaffordable — shop.batchBuild fills the
// affordable prefix) plus a sell row when the selection holds towers. Tapping
// the backdrop cancels; a plain tap on the board exits select mode (main.js).
// hud.js owns the single instance and closes the card on viewport resize.
// =============================================================================

import { CONFIG } from '../config.js';
import { canBuildAt } from '../game/state.js';
import { marqueeCells, sellRefund } from '../game/shop.js';
import { towersUnlockedAt } from '../game/levels.js';
import { div } from './components.js';

export class MultiSelect {
  constructor(uiLayer, actions) {
    this.ui = uiLayer;
    this.actions = actions;
    this.active = false;
    this.card = null;
    this.backdrop = null;
    this._rows = [];        // [{el, cost}] build rows, for live affordability
    this._onClose = null;   // clears state.marquee (captured at openChooser)

    const b = document.createElement('button');
    b.className = 'ui-btn mselect-toggle';
    b.title = 'Drag across cells to build or sell many at once. Tap here to switch to panning the map.';
    b.addEventListener('click', () => {
      if (this.actions.toggleSelectMode) this.actions.toggleSelectMode();
    });
    uiLayer.appendChild(b);
    this.toggle = b;
    this.setActive(true);   // drag-select is the default (matches input.js)
  }

  // Mode visual + label + card teardown; the authoritative flag lives in input.js.
  // ON = drag builds/sells rows (default). OFF = drag pans the map.
  setActive(on) {
    this.active = on;
    this.toggle.classList.toggle('on', on);
    this.toggle.textContent = on ? '⛶ Drag-build' : '✋ Pan map';
    if (!on) this.closeCard();
  }

  get cardOpen() { return !!this.card; }

  // Marquee released: group the covered cells and offer the batch actions.
  // Nothing actionable -> no card, just drop the overlay.
  openChooser(state, rect) {
    this.closeCard();
    const cells = marqueeCells(rect.ax, rect.ay, rect.bx, rect.by);
    const empty = cells.filter((c) => canBuildAt(state, c.x, c.y));
    const towers = cells.map((c) => state.towerGrid[c.y][c.x]).filter(Boolean);
    if (empty.length === 0 && towers.length === 0) { state.marquee = null; return; }
    this._onClose = () => { state.marquee = null; };

    const backdrop = div('mselect-backdrop');
    backdrop.addEventListener('click', (ev) => { ev.stopPropagation(); this.closeCard(); });
    this.ui.appendChild(backdrop);
    this.backdrop = backdrop;

    const card = div('mselect-card');
    card.appendChild(div('ms-title', `${cells.length} cells selected`));

    if (empty.length > 0) {
      const allowed = (state.level && !state.level.endless) ? towersUnlockedAt(state.level.num) : null;
      for (const [id, def] of Object.entries(CONFIG.TOWERS)) {
        if (def.hidden) continue;
        if (allowed && !allowed.includes(id)) continue;
        const row = document.createElement('button');
        row.className = 'ui-btn ms-row';
        row.innerHTML = `<span class="ms-name">${def.name} ×${empty.length}</span>` +
          `<span class="ms-price">${def.cost * empty.length}g</span>`;
        row.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (row.disabled) return;
          this.closeCard();
          this.actions.batchBuild(id, cells);   // batchBuild re-validates + skips
        });
        card.appendChild(row);
        this._rows.push({ el: row, cost: def.cost });
      }
    }

    if (towers.length > 0) {
      const refund = towers.reduce((sum, t) => sum + sellRefund(t), 0);
      const row = document.createElement('button');
      row.className = 'ui-btn ms-row sell';
      row.innerHTML = `<span class="ms-name">Sell ${towers.length} tower${towers.length === 1 ? '' : 's'}</span>` +
        `<span class="ms-price">+${refund}g</span>`;
      row.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeCard();
        this.actions.batchSell(cells);
      });
      card.appendChild(row);
    }

    this.ui.appendChild(card);
    this.card = card;
    this.refresh(state);
  }

  // Per-frame (via hud.refresh): a build row greys out only when even one
  // cell is unaffordable; gold can change mid-wave while the card is open.
  refresh(state) {
    if (!this.card) return;
    for (const r of this._rows) r.el.disabled = state.gold < r.cost;
  }

  closeCard() {
    if (this.backdrop) { this.backdrop.remove(); this.backdrop = null; }
    if (this.card) { this.card.remove(); this.card = null; }
    this._rows = [];
    const f = this._onClose;
    this._onClose = null;
    if (f) f();
  }
}
