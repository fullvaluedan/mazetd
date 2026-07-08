// =============================================================================
// radial.js — the Kingdom-Rush-style ring menus.
//
// One generic Radial component (icons on a circle around a cell, backdrop that
// swallows outside taps, center X) plus the two configurators: the BUILD ring
// (tap an empty cell -> 9 items: wall + the 8-tower roster, greyed when
// unaffordable, orange when the placement would seal the maze) and the TOWER
// ring (upgrade / fork-tier A/B choice / target mode / sell). hud.js owns the
// single instance. The ring radius grows with item count so every hit area
// stays >=44px with >=8px spacing even on a 375px-wide viewport (U7).
// =============================================================================

import { CONFIG } from '../config.js';
import { getTowerStats } from '../game/tower.js';
import { wouldSealAt } from '../game/state.js';
import { sellRefund } from '../game/shop.js';
import { towersUnlockedAt, unlockLevelFor } from '../game/levels.js';
import { div } from './components.js';
import { getSpriteUrl } from './sprites.js';

const RING_R = 64;          // CSS px from center to item centers (small rings)
const ITEM_HALF = 30;       // half of the largest item box, for clamping
// .radial-item hit-area diameter: 54px in ui.css, 60px under the
// (pointer: coarse) media query -- phones are the binding case for spacing.
export const RING_ITEM = 60;
export const RING_GAP = 8;    // minimum CSS px between adjacent hit areas

// Ring radius for n items: grow past RING_R until adjacent 60px hit areas
// keep an 8px gap (U7 bar: >=44px hit areas, >=8px apart at 375px width).
// At the 9-item build ring this yields r=100 -> a 272px ring, so ONE ring
// satisfies the bar on a 375px viewport and the two-ring fallback is unused.
export function ringRadiusFor(n) {
  if (n < 2) return RING_R;
  return Math.max(RING_R, Math.ceil((RING_ITEM + RING_GAP) / (2 * Math.sin(Math.PI / n))));
}

export class Radial {
  constructor(uiLayer, viewport) {
    this.ui = uiLayer;
    this.vp = viewport;
    this.root = null;
    this.backdrop = null;
    this.cell = null;
    this.kind = null;        // 'build' | 'tower'
    this._items = [];        // [{el, it}]
    this._onClose = null;
  }

  get isOpen() { return !!this.root; }

  // items: [{ icon?, glyph, color, label, price?, sub?, disabled?(state),
  //           warn?, onTap, onHover?(bool), slot? }]
  // opts.totalSlots: fix the angle denominator (and ring size) to a constant
  // instead of the live items.length, and honor each item's `slot` for its
  // angle instead of its array index. Lets a ring with a variable item set
  // (the tower ring: upgrade disappears once maxed) keep every OTHER button
  // at its usual position rather than re-spacing the whole ring (user
  // 2026-07-08: "upgrade all the way and it replaces the button location").
  // Omit both for the old index/count-based layout (the build ring, whose
  // item set never changes size).
  open(cell, items, kind, onClose, opts = {}) {
    this.close();
    this.kind = kind || null;
    this.cell = cell;
    this._onClose = onClose || null;

    const backdrop = div('radial-backdrop');
    backdrop.addEventListener('click', (ev) => { ev.stopPropagation(); this.close(); });
    this.ui.appendChild(backdrop);
    this.backdrop = backdrop;

    const ring = div('radial');
    const a = this.vp.worldToUi((cell.x + 0.5) * CONFIG.CELL, (cell.y + 0.5) * CONFIG.CELL);
    const n = opts.totalSlots || items.length;
    const radius = ringRadiusFor(n);
    const pad = radius + ITEM_HALF + 6;
    const w = this.ui.clientWidth || 0, h = this.ui.clientHeight || 0;
    const cx = Math.min(Math.max(a.x, pad), Math.max(pad, w - pad));
    const cy = Math.min(Math.max(a.y, pad), Math.max(pad, h - pad));
    ring.style.left = cx + 'px';
    ring.style.top = cy + 'px';

    this._items = items.map((it, i) => {
      const slot = it.slot != null ? it.slot : i;
      const ang = -Math.PI / 2 + (slot / n) * Math.PI * 2;   // first item on top
      const b = document.createElement('button');
      b.className = 'radial-item' + (it.warn ? ' warn' : '');
      const icon = it.icon
        ? `<img src="${it.icon}" alt="">`
        : `<span class="glyph" style="color:${it.color || '#fff'}">${it.glyph || '?'}</span>`;
      b.innerHTML = `${icon}
        ${it.price != null ? `<span class="price">${it.price}g</span>` : (it.sub ? `<span class="price sub">${it.sub}</span>` : '')}`;
      b.title = it.label || '';
      b.style.left = Math.round(Math.cos(ang) * radius) + 'px';
      b.style.top = Math.round(Math.sin(ang) * radius) + 'px';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!b.disabled) it.onTap(); });
      if (it.onHover) {
        b.addEventListener('mouseenter', () => it.onHover(true));
        b.addEventListener('mouseleave', () => it.onHover(false));
      }
      ring.appendChild(b);
      return { el: b, it };
    });

    const x = document.createElement('button');
    x.className = 'radial-center';
    x.textContent = '✕';
    x.addEventListener('click', (ev) => { ev.stopPropagation(); this.close(); });
    ring.appendChild(x);

    this.ui.appendChild(ring);
    this.root = ring;
  }

  // Per-frame: keep affordability live while the ring is open mid-wave.
  refresh(state) {
    if (!this.root) return;
    for (const { el, it } of this._items) {
      if (it.disabled) el.disabled = it.disabled(state);
    }
  }

  close() {
    if (!this.root) return;
    for (const { it } of this._items) if (it.onHover) it.onHover(false);
    this.backdrop.remove();
    this.root.remove();
    this.root = null; this.backdrop = null; this.cell = null; this.kind = null;
    this._items = [];
    const f = this._onClose;
    this._onClose = null;
    if (f) f();
  }
}

// ---- the two ring configurators ---------------------------------------------

// Empty buildable cell: one item per tower type. In campaign levels, towers
// beyond the unlock schedule show as locked slots ("unlocks at level N").
export function buildRingItems(state, cell, gameActions) {
  const seals = safeSeal(state, cell.x, cell.y);
  const allowed = (state.level && !state.level.endless) ? towersUnlockedAt(state.level.num) : null;
  return Object.entries(CONFIG.TOWERS).filter(([, def]) => !def.hidden).map(([id, def]) => {
    if (allowed && !allowed.includes(id)) {
      return {
        glyph: '🔒', color: '#9aa3b2',
        label: `${def.name} — unlocks at level ${unlockLevelFor(id)}`,
        sub: `L${unlockLevelFor(id)}`,
        disabled: () => true,
        onTap: () => {},
      };
    }
    return {
      icon: getSpriteUrl('tower-' + id),
      glyph: def.glyph,
      color: def.color,
      label: `${def.name} — ${def.cost}g · ${def.blurb}${seals ? ' ⚠ seals the maze!' : ''}`,
      price: def.cost,
      warn: seals,
      disabled: (s) => s.gold < def.cost,
      onTap: () => gameActions.buildAt(id, cell.x, cell.y),
      onHover: (on) => {
        state.pendingBuild = on ? id : null;
      },
    };
  });
}

// Fixed role slots for the tower ring (see Radial.open's `slot`/`totalSlots`):
// upgrade or fork A always sits at 0, fork B at 1, targeting at 2, sell at 3.
// A role's button simply doesn't render when absent (e.g. maxed = no slot 0)
// instead of the whole ring re-spacing around the remaining items.
export const TOWER_RING_SLOTS = 4;

// Existing tower: upgrade (or the A/B fork where the next tier declares one),
// target mode, sell. Walls are pure maze pieces: sell is their only action.
export function towerRingItems(state, tower, gameActions) {
  const items = [];
  if (tower.canUpgrade()) {
    const cost = tower.nextUpgradeCost();
    const forks = tower.forkChoices();
    if (!forks) {
      items.push({
        slot: 0,
        glyph: '▲', color: '#ffd35c',
        label: `Upgrade to L${tower.level + 1} — ${cost}g`,
        price: cost,
        disabled: (s) => s.gold < cost,
        onTap: () => gameActions.upgradeTower(tower, null),
      });
    } else {
      for (const key of Object.keys(forks)) {
        const br = forks[key];
        items.push({
          slot: key === 'A' ? 0 : 1,
          glyph: key === 'A' ? '◆' : '◇', color: '#ffd35c',
          label: `${br.name} — ${br.desc} (${cost}g)`,
          price: cost,
          sub: br.name,
          disabled: (s) => s.gold < cost,
          onTap: () => gameActions.upgradeTower(tower, key),
        });
      }
    }
  }
  if (!tower.def.aura && !tower.def.wall && !tower.def.noAttack) {
    items.push({
      slot: 2,
      glyph: '◎', color: '#5cc8ff',
      label: 'Targeting: ' + tower.targetMode + ' (tap to cycle)',
      sub: tower.targetMode,
      onTap: () => gameActions.cycleTargetAndRefresh(tower),
    });
  }
  const refund = sellRefund(tower);
  items.push({
    slot: 3,
    glyph: '$', color: '#ff6b66',
    label: `Sell — refund ${refund}g${tower.def.wall ? ' (100%)' : ''}`,
    sub: `+${refund}g`,
    onTap: () => gameActions.sellTower(tower),
  });
  return items;
}

function safeSeal(state, x, y) {
  try { return wouldSealAt(state, x, y); } catch { return false; }
}

// Static stats line used for ring item tooltips (desktop title attr).
export function towerStatsLabel(typeId) {
  const def = CONFIG.TOWERS[typeId];
  const s = getTowerStats(typeId, 1, null);
  if (def.aura) return `${def.name}: +${Math.round(s.auraDmg * 100)}% dmg aura, radius ${s.auraRange}`;
  if (def.noAttack) return `${def.name}: +${s.income}g every wave, never attacks`;
  return `${def.name}: DMG ${s.damage} · RNG ${s.range} · CD ${s.cooldown}s`;
}
