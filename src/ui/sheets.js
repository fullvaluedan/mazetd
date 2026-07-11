// =============================================================================
// sheets.js — modal sheets over the battlefield: SETTINGS (pause, save/load,
// toggles, how-to-play) and the STORE (hero upgrades, tower boosts,
// consumables — relocated from the old side panel). One sheet at a time; the
// game auto-pauses while a sheet is open and resumes on close.
// =============================================================================

import { CONFIG } from '../config.js';
import { heroUpgradeCost, heroUpgradeMaxed, consumableCost, towerBoostCost, towerBoostMaxed } from '../game/shop.js';
import { div, btn, lockSurface } from './components.js';
import { icon, setIconButton } from './icons.js';

export class Sheets {
  constructor(actions) {
    this.actions = actions;
    this.root = null;        // backdrop element while open
    this.kind = null;        // 'settings' | 'store'
    this.el = {};
  }

  get isOpen() { return !!this.root; }

  close() {
    if (!this.root) return;
    if (this._unlock) { this._unlock(); this._unlock = null; }
    this.root.remove();
    this.root = null;
    this.kind = null;
    this.el = {};
    this.actions.setPausedBySheet(false);
  }

  _open(kind, titleText, buildBody) {
    this.close();
    this.actions.setPausedBySheet(true);
    this.kind = kind;
    const backdrop = div('sheet-backdrop');
    backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) this.close(); });
    const panel = div('sheet');
    const titleIcon = kind === 'settings' ? 'settings' : 'shop';
    panel.appendChild(div('sheet-title', `${icon(titleIcon)}<span>${titleText}</span>`));
    const x = btn('', () => this.close(), 'sheet-close');
    setIconButton(x, 'close', `Close ${titleText}`);
    x.setAttribute('aria-label', `Close ${titleText.replace(/^[^A-Za-z]+/, '')}`);
    panel.appendChild(x);
    const body = div('sheet-body');
    buildBody(body);
    panel.appendChild(body);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    this.root = backdrop;
    this._unlock = lockSurface(backdrop, () => this.close());
  }

  // ---- settings -------------------------------------------------------------
  openSettings(state, ui) {
    this._open('settings', 'Settings', (body) => {
      const row = (label, onTap, active, iconName = null) => {
        const b = btn(label, onTap, 'ui-btn wide' + (active ? ' gold' : ''));
        if (iconName) setIconButton(b, iconName, label, label);
        body.appendChild(b);
        return b;
      };
      row('Resume', () => this.close(), false, 'play');
      this.el.path = row(`Path overlay: ${state.showPath ? 'ON' : 'OFF'}`, () => {
        this.actions.togglePath();
        this.el.path.textContent = `Path overlay: ${state.showPath ? 'ON' : 'OFF'}`;
      });
      this.el.art = row('Art: generated / shapes', () => this.actions.toggleArt());
      this.el.auto = row(`Auto-start waves: ${state.autoStart ? 'ON' : 'OFF'}`, () => {
        this.actions.toggleAuto();
        this.el.auto.textContent = `Auto-start waves: ${state.autoStart ? 'ON' : 'OFF'}`;
      });
      if (this.actions.toggleSfx) {
        this.el.sfx = row(`Sound: ${this.actions.sfxMuted && this.actions.sfxMuted() ? 'OFF' : 'ON'}`, () => {
          this.actions.toggleSfx();
          this.el.sfx.textContent = `Sound: ${this.actions.sfxMuted && this.actions.sfxMuted() ? 'OFF' : 'ON'}`;
        });
      }
      row('Save game', () => this.actions.save(), false, 'save');
      row('Load game', () => { this.actions.load(); this.close(); }, false, 'load');
      row('Restart run', () => this.actions.restart(), false, 'retry');

      body.appendChild(div('sheet-help', `
        <b>How to play</b><br>
        Enemies pour from the portals toward your campfire, always taking the
        shortest open route — your towers are the walls. Build a long winding
        maze, exploit armor matchups, and survive every wave.<br><br>
        · Tap an empty cell to build, tap a tower to upgrade or sell.<br>
        · You CAN seal the maze — but the wave will chew through your walls.<br>
        ${CONFIG.HEROES_ENABLED ? '· Tap your hero, then the ground, to move them. Q/W cast abilities.<br>' : ''}
        · Flying waves ignore the maze — keep anti-air towers up.`));
    });
  }

  // ---- store ------------------------------------------------------------------
  openStore(state) {
    this._open('store', 'Tower Store', (body) => {
      this.el.storeBtns = { hero: {}, boost: {}, cons: {} };

      const section = (title) => {
        body.appendChild(div('sheet-section', title));
        const grid = div('sheet-grid');
        body.appendChild(grid);
        return grid;
      };

      if (CONFIG.HEROES_ENABLED) {
        const hu = section('Hero upgrades <span class="muted">(between waves)</span>');
        for (const key of Object.keys(CONFIG.HERO_UPGRADES)) {
          const b = document.createElement('button');
          b.className = 'ui-btn store-item';
          b.addEventListener('click', () => { this.actions.heroUpgrade(key); this.refresh(state); });
          this.el.storeBtns.hero[key] = b;
          hu.appendChild(b);
        }
      }

      const tb = section('Tower boosts <span class="muted">(permanent, all towers)</span>');
      for (const key of Object.keys(CONFIG.TOWER_BOOSTS)) {
        const b = document.createElement('button');
        b.className = 'ui-btn store-item';
        b.addEventListener('click', () => { this.actions.towerBoost(key); this.refresh(state); });
        this.el.storeBtns.boost[key] = b;
        tb.appendChild(b);
      }

      const co = section('Consumables <span class="muted">(usable mid-wave)</span>');
      for (const key of Object.keys(CONFIG.CONSUMABLES)) {
        const b = document.createElement('button');
        b.className = 'ui-btn store-item';
        b.addEventListener('click', () => {
          const def = CONFIG.CONSUMABLES[key];
          this.actions.consumable(key);
          if (def.targetCell) this.close();   // go pick a target on the field
          else this.refresh(state);
        });
        this.el.storeBtns.cons[key] = b;
        co.appendChild(b);
      }
      this.refresh(state);
    });
  }

  // live costs/affordability while the store is open (also called per frame)
  refresh(state) {
    if (this.kind !== 'store' || !this.el.storeBtns) return;
    for (const [key, def] of Object.entries(CONFIG.HEROES_ENABLED ? CONFIG.HERO_UPGRADES : {})) {
      const b = this.el.storeBtns.hero[key];
      const tier = state.heroUpgrades[key];
      const maxed = heroUpgradeMaxed(state, key);
      const cost = heroUpgradeCost(state, key);
      setHtml(b, `<b>${def.name}</b><span class="tier">tier ${tier}/${def.maxTier}</span><span class="cost">${maxed ? 'MAX' : cost + 'g'}</span>`);
      b.disabled = maxed || state.waveActive || state.gold < cost || !state.hero;
    }
    for (const [key, def] of Object.entries(CONFIG.TOWER_BOOSTS)) {
      const b = this.el.storeBtns.boost[key];
      const tier = state.towerBoosts[key];
      const maxed = towerBoostMaxed(state, key);
      const cost = towerBoostCost(state, key);
      setHtml(b, `<b>${def.name}</b><span class="tier">tier ${tier}/${def.maxTier}</span><span class="cost">${maxed ? 'MAX' : cost + 'g'}</span>`);
      b.disabled = maxed || state.waveActive || state.gold < cost;
    }
    for (const [key, def] of Object.entries(CONFIG.CONSUMABLES)) {
      const b = this.el.storeBtns.cons[key];
      const cost = consumableCost(state, key);
      setHtml(b, `<b>${def.name}</b><span class="tier">${def.desc}</span><span class="cost">${cost}g</span>`);
      b.disabled = state.gold < cost || state.status === 'won' || state.status === 'lost';
    }
  }
}

function setHtml(el, html) {
  if (el._html !== html) { el._html = html; el.innerHTML = html; }
}
