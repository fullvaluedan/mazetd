// =============================================================================
// topbar.js — slim Kingdom-Rush-style status strip over the battlefield:
// gold / lives / wave chips, a cycling speed button and pause. Mounted into
// the #ui layer; refreshed per frame with textContent-only writes.
// =============================================================================

import { CONFIG } from '../config.js';
import { winWave } from '../game/wave.js';
import { div } from './components.js';

export class TopBar {
  constructor(uiLayer, actions) {
    this.actions = actions;
    this.el = {};

    const bar = div('topbar');

    const chip = (cls, ico) => {
      const c = div('ui-chip ' + cls, `<span class="ico">${ico}</span><span class="v">0</span>`);
      bar.appendChild(c);
      return c.querySelector('.v');
    };
    this.el.gold = chip('gold-chip', '🪙');
    this.el.lives = chip('lives-chip', '❤');
    this.el.wave = chip('wave-chip', '🌊');

    bar.appendChild(div('spacer'));

    this.el.ad = mkBtn('📺', () => this.actions.freeGold());
    this.el.ad.classList.add('gold');
    this.el.speed = mkBtn('1×', () => this.actions.cycleSpeed());
    this.el.pause = mkBtn('▮▮', () => this.actions.togglePause());
    this.el.store = mkBtn('🛒', () => this.actions.openStore());
    this.el.gear = mkBtn('⚙', () => this.actions.openSettings());
    bar.append(this.el.ad, this.el.speed, this.el.pause, this.el.store, this.el.gear);

    this.root = bar;
    uiLayer.appendChild(bar);
  }

  refresh(state, ui) {
    setText(this.el.gold, Math.floor(state.gold));
    setText(this.el.lives, state.lives);
    setText(this.el.wave, `${state.wave}/${winWave(state)}`);
    setText(this.el.speed, ui.speed + '×');
    setText(this.el.pause, ui.paused ? '▶' : '▮▮');
    this.el.pause.classList.toggle('gold', !!ui.paused);
    // FREE GOLD rewarded-ad button: grant amount when ready, blocking gate when not
    if (this.actions.adInfo) {
      const info = this.actions.adInfo();
      setText(this.el.ad, info.label);
      this.el.ad.disabled = !info.ready;
    }
  }
}

function mkBtn(label, onClick) {
  const b = document.createElement('button');
  b.className = 'ui-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

// textContent writes only when changed (cheap per-frame refresh)
function setText(el, v) {
  v = String(v);
  if (el._last !== v) { el._last = v; el.textContent = v; }
}
