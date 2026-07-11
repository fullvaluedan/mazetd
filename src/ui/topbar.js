// =============================================================================
// topbar.js — slim Kingdom-Rush-style status strip over the battlefield:
// gold / lives / wave chips, a cycling speed button and pause. Mounted into
// the #ui layer; refreshed per frame with textContent-only writes.
// =============================================================================

import { CONFIG } from '../config.js';
import { waveInfoFor, winWave } from '../game/wave.js';
import { div } from './components.js';
import { icon, setIconButton } from './icons.js';

export class TopBar {
  constructor(uiLayer, actions) {
    this.actions = actions;
    this.el = {};

    const bar = div('topbar');

    const chip = (cls, iconName, label) => {
      const c = div('ui-chip ' + cls, `<span class="ico">${icon(iconName)}</span><span class="v">0</span>`);
      c.setAttribute('aria-label', label);
      bar.appendChild(c);
      return c.querySelector('.v');
    };
    this.el.gold = chip('gold-chip', 'coin', 'Gold');
    this.el.lives = chip('lives-chip', 'heart', 'Lives');
    this.el.wave = chip('wave-chip', 'wave', 'Wave');

    bar.appendChild(div('spacer'));

    this.el.ad = mkBtn('reward', 'Free gold', () => this.actions.freeGold());
    this.el.ad.classList.add('gold');
    this.el.speed = mkBtn(null, 'Game speed', () => this.actions.cycleSpeed(), '1×');
    this.el.pause = mkBtn('pause', 'Pause game', () => this.actions.togglePause());
    this.el.store = mkBtn('shop', 'Open tower store', () => this.actions.openStore());
    this.el.gear = mkBtn('settings', 'Open settings', () => this.actions.openSettings());
    bar.append(this.el.ad, this.el.speed, this.el.pause, this.el.store, this.el.gear);

    // A reserved rail keeps the next-wave decision legible without covering a
    // gate, path, or build cell. Its source is the same deterministic summary
    // used when the wave actually spawns.
    this.brief = div('wave-brief');
    bar.appendChild(this.brief);

    this.root = bar;
    uiLayer.appendChild(bar);
    this.boss = div('boss-status hidden');
    uiLayer.appendChild(this.boss);
  }

  refresh(state, ui) {
    // Maze Mode: lives are meaningless (leaks don't cost any) and there's no
    // tower store — hide both once, and repurpose the wave chip as a live
    // "mobs still contained" counter.
    const maze = !!(state.level && state.level.mazeMode);
    if (this._maze !== maze) {
      this._maze = maze;
      this.el.lives.parentElement.style.display = maze ? 'none' : '';
      this.el.store.style.display = maze ? 'none' : '';
      this.brief.style.display = maze ? 'none' : '';
    }
    setText(this.el.gold, Math.floor(state.gold));
    if (maze) {
      setText(this.el.wave, state.waveActive ? String(state.enemies.length) : '—');
    } else {
      setText(this.el.lives, state.lives);
      setText(this.el.wave, `${state.wave}/${winWave(state)}`);
    }
    setButton(this.el.speed, null, 'Game speed', ui.speed + '×');
    setButton(this.el.pause, ui.paused ? 'play' : 'pause', ui.paused ? 'Resume game' : 'Pause game');
    this.el.pause.classList.toggle('gold', !!ui.paused);
    // FREE GOLD rewarded-ad button: grant amount when ready, blocking gate when not
    if (this.actions.adInfo) {
      const info = this.actions.adInfo();
      setButton(this.el.ad, 'reward', 'Free gold', info.label);
      this.el.ad.disabled = !info.ready;
    }
    if (!maze) this.refreshBrief(state);
    const bosses = state.enemies.filter((enemy) => enemy.alive && enemy.boss);
    const bossKey = bosses.map((enemy) => `${enemy.id}:${Math.ceil(enemy.hp)}:${enemy.maxHp}`).join('|');
    if (this._bossKey !== bossKey) {
      this._bossKey = bossKey;
      this.boss.classList.toggle('hidden', bosses.length === 0);
      this.boss.innerHTML = bosses.map((enemy) => {
        const pct = Math.max(0, Math.min(100, enemy.hp / enemy.maxHp * 100));
        return `<div class="boss-row"><div class="boss-copy"><b>${enemy.name}</b><span>${Math.ceil(enemy.hp).toLocaleString()} / ${enemy.maxHp.toLocaleString()}</span></div><div class="boss-track"><span style="width:${pct}%"></span></div></div>`;
      }).join('');
    }
  }

  refreshBrief(state) {
    const nextWave = Math.min(winWave(state), state.wave + 1);
    const info = waveInfoFor(state, nextWave);
    const types = info.types.map((id) => CONFIG.ENEMIES[id]?.name || id).join(' · ');
    const copy = nextWave > winWave(state) ? 'KINGDOM SECURED' :
      `UP NEXT <b>WAVE ${nextWave}</b><span>${info.count} enemies · ${types}${info.isBoss ? ' · BOSS' : ''}</span>`;
    if (this._briefCopy !== copy) {
      this._briefCopy = copy;
      this.brief.innerHTML = `${icon('wave')}<div>${copy}</div>`;
    }
  }
}

function mkBtn(iconName, label, onClick, text = '') {
  const b = document.createElement('button');
  b.className = 'ui-btn';
  setIconButton(b, iconName || 'wave', label, text);
  b.addEventListener('click', onClick);
  return b;
}

function setButton(el, iconName, label, text = '') {
  const key = `${iconName || ''}|${label}|${text}`;
  if (el._lastButton !== key) {
    el._lastButton = key;
    if (iconName) setIconButton(el, iconName, label, text);
    else {
      el.setAttribute('aria-label', label);
      el.title = label;
      el.innerHTML = `<span class="control-face"><span class="control-label">${text}</span></span>`;
    }
  }
}

// textContent writes only when changed (cheap per-frame refresh)
function setText(el, v) {
  v = String(v);
  if (el._last !== v) { el._last = v; el.textContent = v; }
}
