// =============================================================================
// screens.js — the game-flow screens: TITLE -> HERO SELECT -> game ->
// VICTORY / DEFEAT (with a Kingdom-Rush star rating). Mounted into #modal.
//
// The logo is styled CSS text, never baked into generated art (image models
// garble lettering); the title key art (misc-title) is an optional backdrop
// that pops in once sprites finish loading.
// =============================================================================

import { CONFIG } from '../config.js';
import { LEVELS } from '../game/levels.js';
import * as profile from '../services/profile.js';
import { div } from './components.js';
import { getSpriteUrl } from './sprites.js';

export function starsFor(state) {
  if (state.status !== 'won') return 0;
  const th = (state.level && state.level.stars) || CONFIG.STARS;
  if (state.lives >= th[0]) return 3;
  if (state.lives >= th[1]) return 2;
  return 1;
}

function starsHtml(n) {
  return [1, 2, 3].map((i) => `<span class="ms ${i <= n ? 'lit' : ''}">★</span>`).join('');
}

export class Screens {
  // hooks: { play(), pickHero(id), continueRun(), openSettings(), restart(),
  //          hasSave(), highScore(), revive?() }
  constructor(modalEl, hooks) {
    this.modal = modalEl;
    this.hooks = hooks;
    this.current = null;
  }

  hide() {
    this.current = null;
    this.modal.classList.add('hidden');
    this.modal.innerHTML = '';
  }

  _mount(name, el) {
    this.current = name;
    this.modal.innerHTML = '';
    this.modal.appendChild(el);
    this.modal.classList.remove('hidden');
  }

  // re-apply the key art once sprites finish their async load
  refreshArt() {
    if (this.current !== 'title') return;
    const art = this.modal.querySelector('.title-screen');
    const url = getSpriteUrl('misc-title');
    if (art && url) art.style.backgroundImage = `linear-gradient(rgba(10,12,18,0.25), rgba(10,12,18,0.78)), url(${url})`;
  }

  showTitle() {
    const hs = this.hooks.highScore();
    const s = div('title-screen', `
      <div class="title-logo">MAZECORE<span>TD</span></div>
      <div class="title-tag">Build the maze. Bend the horde. Survive 100 waves.</div>
      <div class="title-buttons"></div>
      ${hs ? `<div class="title-best">Best run: wave ${hs}</div>` : ''}`);
    const btns = s.querySelector('.title-buttons');
    btns.appendChild(bigBtn('▶ PLAY', () => (profile.getProfile().hero.id ? this.showMap() : this.showHeroSelect()), 'green'));
    if (this.hooks.hasSave()) btns.appendChild(bigBtn('⟳ CONTINUE', () => { this.hide(); this.hooks.continueRun(); }));
    btns.appendChild(bigBtn('⚙ SETTINGS', () => this.hooks.openSettings()));
    this._mount('title', s);
    this.refreshArt();
  }

  showHeroSelect() {
    const s = div('hero-screen', `<div class="hero-screen-title">Choose your hero</div><div class="hero-cards"></div>`);
    const cards = s.querySelector('.hero-cards');
    for (const [id, def] of Object.entries(CONFIG.HEROES)) {
      const url = getSpriteUrl('hero-' + id);
      const card = document.createElement('button');
      card.className = 'hero-card';
      card.innerHTML = `
        <span class="hc-art">${url ? `<img src="${url}" alt="">` : `<span class="hc-glyph" style="color:${def.color}">${def.glyph}</span>`}</span>
        <span class="hc-name" style="color:${def.color}">${def.name}</span>
        <span class="hc-role">${def.role}</span>
        <span class="hc-abilities">${def.abilities.map((a) => `<b>${a.name}</b> — ${a.desc}`).join('<br>')}</span>`;
      card.addEventListener('click', () => { this.hide(); this.hooks.pickHero(id); });
      cards.appendChild(card);
    }
    this._mount('heroSelect', s);
  }

  // The campaign map: hero strip + star wallet + star upgrades + level path.
  showMap() {
    const p = profile.getProfile();
    const heroUrl = p.hero.id ? getSpriteUrl('hero-' + p.hero.id) : null;
    const heroDef = p.hero.id ? CONFIG.HEROES[p.hero.id] : null;
    const s = div('map-screen', `
      <div class="map-hero">
        <span class="mh-face">${heroUrl ? `<img src="${heroUrl}" alt="">` : (heroDef ? `<span style="color:${heroDef.color};font-size:30px">${heroDef.glyph}</span>` : '❔')}</span>
        <span class="mh-info">
          <b>${heroDef ? heroDef.name : 'Pick a hero'}</b> ${heroDef ? 'L' + p.hero.level : ''}
          <span class="mh-stars">⭐ ${profile.starsAvailable()} <span class="muted">/ ${profile.totalStarsEarned()} earned</span></span>
        </span>
      </div>
      <div class="map-upgrades"></div>
      <div class="map-path"></div>`);

    // star-bought permanent hero upgrades
    const up = s.querySelector('.map-upgrades');
    for (const [key, def] of Object.entries(CONFIG.HERO_UPGRADES)) {
      const tier = p.starUpgrades[key] || 0;
      const maxed = tier >= def.maxTier;
      const b = document.createElement('button');
      b.className = 'ui-btn star-up';
      b.innerHTML = `<b>${def.name}</b><span>${maxed ? 'MAX' : `tier ${tier}/${def.maxTier} · ⭐${profile.starUpgradeCost(tier)}`}</span>`;
      b.disabled = maxed || !profile.canBuyStarUpgrade(key);
      b.addEventListener('click', () => { if (profile.buyStarUpgrade(key)) this.showMap(); });
      up.appendChild(b);
    }

    // the level path
    const path = s.querySelector('.map-path');
    for (const lv of LEVELS) {
      const unlocked = profile.isLevelUnlocked(lv.num);
      const stars = profile.starsForLevel(lv.id);
      const b = document.createElement('button');
      b.className = 'map-node' + (unlocked ? '' : ' locked');
      b.innerHTML = unlocked
        ? `<span class="mn-num">${lv.num}</span><span class="mn-name">${lv.name}</span><span class="mn-stars">${starsHtml(stars)}</span>`
        : `<span class="mn-num">🔒</span><span class="mn-name">${lv.name}</span><span class="mn-stars muted">beat level ${lv.num - 1}</span>`;
      if (unlocked) b.addEventListener('click', () => { location.href = '?level=' + lv.id; });
      else b.disabled = true;
      path.appendChild(b);
    }
    // Endless node
    const endlessOpen = profile.endlessUnlocked();
    const en = document.createElement('button');
    en.className = 'map-node endless' + (endlessOpen ? '' : ' locked');
    en.innerHTML = endlessOpen
      ? `<span class="mn-num">∞</span><span class="mn-name">Endless Depths</span><span class="mn-stars">100 waves · high score</span>`
      : `<span class="mn-num">🔒</span><span class="mn-name">Endless Depths</span><span class="mn-stars muted">beat level 10</span>`;
    if (endlessOpen) en.addEventListener('click', () => { location.href = '?level=endless'; });
    else en.disabled = true;
    path.appendChild(en);

    this._mount('map', s);
  }

  showEnd(state) {
    const won = state.status === 'won';
    const n = starsFor(state);
    const stars = [1, 2, 3].map((i) => `<span class="star ${i <= n ? 'lit' : ''}">★</span>`).join('');
    const hs = this.hooks.highScore();
    const s = div('end-screen', `
      <div class="end-title" style="color:${won ? 'var(--ui-green)' : 'var(--ui-red)'}">${won ? 'VICTORY!' : 'DEFEAT'}</div>
      <div class="end-stars">${stars}</div>
      <div class="end-sub">${won
        ? `The maze held — all ${CONFIG.WIN_WAVE} waves broken with ${state.lives} ♥ left.`
        : `Your lives ran out on wave ${state.wave}.`}</div>
      <div class="end-stats">
        Reached wave <b>${state.maxWave}</b> · Hero L<b>${state.hero ? state.hero.level : 1}</b> · Best ever: wave <b>${hs}</b>
      </div>
      <div class="end-buttons"></div>`);
    const btns = s.querySelector('.end-buttons');
    if (!won && this.hooks.revive && (!this.hooks.canRevive || this.hooks.canRevive())) {
      const r = bigBtn('📺 Watch ad — revive with ' + (CONFIG.ADS ? CONFIG.ADS.REVIVE.lives : 5) + ' ♥', () => this.hooks.revive(), 'gold');
      r.id = 'revive-btn';
      btns.appendChild(r);
    }
    const lv = state.level;
    if (lv && !lv.endless) {
      // campaign navigation
      if (won) {
        const next = LEVELS.find((l) => l.num === lv.num + 1);
        if (next) btns.appendChild(bigBtn('▶ Next level', () => { location.href = '?level=' + next.id; }, 'green'));
      }
      btns.appendChild(bigBtn(won ? '↺ Replay' : '↺ Try again', () => this.hooks.restart(), won ? '' : 'green'));
      btns.appendChild(bigBtn('🗺 Level map', () => { location.href = location.pathname; }));
    } else {
      btns.appendChild(bigBtn(won ? '▶ Play again' : '↺ Try again', () => this.hooks.restart(), 'green'));
      if (lv) btns.appendChild(bigBtn('🗺 Level map', () => { location.href = location.pathname; }));
    }
    this._mount(won ? 'victory' : 'defeat', s);
  }
}

function bigBtn(label, onTap, cls = '') {
  const b = document.createElement('button');
  b.className = 'ui-btn big ' + cls;
  b.textContent = label;
  b.addEventListener('click', onTap);
  return b;
}
