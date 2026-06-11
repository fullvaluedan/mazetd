// =============================================================================
// herobar.js — the bottom-left Kingdom-Rush hero dock: portrait with a conic
// HP arc + level badge (and a respawn countdown when down), plus the two
// ability buttons with radial cooldown sweeps.
//
// Control scheme: tap the portrait (or the hero on the field, or M) to SELECT
// the hero; while selected, every tap on open ground is a move command and the
// hero stays selected (state.heroSelected). Esc / tapping elsewhere deselects.
// =============================================================================

import { div } from './components.js';
import { getSpriteUrl } from './sprites.js';

export class HeroBar {
  constructor(uiLayer, actions) {
    this.actions = actions;
    this.el = {};

    const bar = div('herobar');

    // portrait button
    const p = document.createElement('button');
    p.className = 'hero-portrait';
    p.innerHTML = `
      <span class="hp-arc"></span>
      <span class="face"></span>
      <span class="lvl">1</span>
      <span class="respawn hidden"></span>`;
    p.addEventListener('click', () => this.actions.selectHero());
    this.el.portrait = p;
    this.el.arc = p.querySelector('.hp-arc');
    this.el.face = p.querySelector('.face');
    this.el.lvl = p.querySelector('.lvl');
    this.el.respawn = p.querySelector('.respawn');
    bar.appendChild(p);

    // ability buttons
    this.el.abs = [];
    for (let i = 0; i < 2; i++) {
      const b = document.createElement('button');
      b.className = 'hero-ability';
      b.innerHTML = `<span class="cd-sweep"></span><span class="ab-name"></span><span class="key">${i === 0 ? 'Q' : 'W'}</span>`;
      b.addEventListener('click', () => this.actions.castAbility(i));
      this.el.abs.push({
        btn: b,
        sweep: b.querySelector('.cd-sweep'),
        name: b.querySelector('.ab-name'),
      });
      bar.appendChild(b);
    }

    bar.classList.add('hidden');
    this.root = bar;
    uiLayer.appendChild(bar);
    this._face = null;
    this._hpPct = -1;
  }

  refresh(state) {
    const h = state.hero;
    if (!h) { this.root.classList.add('hidden'); return; }
    this.root.classList.remove('hidden');

    // portrait face (painted art with glyph fallback), once per hero
    if (this._face !== h.id) {
      this._face = h.id;
      const url = getSpriteUrl('hero-' + h.id);
      this.el.face.innerHTML = url ? `<img src="${url}" alt="">` : `<span style="color:${h.def.color}">${h.def.glyph}</span>`;
    }

    // HP arc (conic gradient) — rebuild the gradient string only on change
    const pct = h.downed ? 0 : Math.max(0, Math.round(100 * h.hp / h.maxHp));
    if (pct !== this._hpPct) {
      this._hpPct = pct;
      const col = pct > 40 ? 'var(--ui-green)' : 'var(--ui-red)';
      this.el.arc.style.background = `conic-gradient(${col} ${pct}%, rgba(255,255,255,0.12) 0)`;
    }

    setText(this.el.lvl, h.level);
    this.el.portrait.classList.toggle('selected', !!state.heroSelected);
    this.el.portrait.classList.toggle('downed', !!h.downed);

    // respawn countdown overlay
    if (h.downed) {
      this.el.respawn.classList.remove('hidden');
      setText(this.el.respawn, Math.ceil(h.respawnLeft));
    } else {
      this.el.respawn.classList.add('hidden');
    }

    // abilities: name, radial cooldown sweep, targeting highlight
    for (let i = 0; i < 2; i++) {
      const ab = h.abilities[i], ui = this.el.abs[i];
      setText(ui.name, ab.name);
      const frac = ab.cdLeft > 0 ? Math.min(1, ab.cdLeft / (ab.cooldown * h.abilityCdMult)) : 0;
      const deg = Math.round(frac * 360);
      if (ui._deg !== deg) {
        ui._deg = deg;
        ui.sweep.style.background = deg > 0
          ? `conic-gradient(rgba(8,10,16,0.78) ${deg}deg, transparent 0)`
          : 'none';
      }
      ui.btn.disabled = h.downed || ab.cdLeft > 0;
      ui.btn.classList.toggle('targeting', state.targetingAbility === ab);
    }
  }
}

function setText(el, v) {
  v = String(v);
  if (el._last !== v) { el._last = v; el.textContent = v; }
}
