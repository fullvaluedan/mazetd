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
import { getScores, addScore, getLastName, setLastName, formatMazeTime } from '../services/leaderboard.js';
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
    btns.appendChild(bigBtn('▶ PLAY', () => ((CONFIG.HEROES_ENABLED && !profile.getProfile().hero.id) ? this.showHeroSelect() : this.showMap()), 'green'));
    if (this.hooks.hasSave()) btns.appendChild(bigBtn('⟳ CONTINUE', () => { this.hide(); this.hooks.continueRun(); }));
    btns.appendChild(bigBtn('🧱 MAZE MODE', () => { location.href = '?level=maze'; }, 'gold'));
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

  // U14: a campaign snapshot exists for the level being entered — offer to
  // pick up where the player left off instead of silently restarting. Reuses
  // the same modal-card pattern as the other screens (no new CSS needed).
  // hooks used: resumeCampaign(), restartCampaign().
  showResumePrompt(level, wave) {
    const s = div('end-screen', `
      <div class="title-logo" style="font-size:28px">${level.name}</div>
      <div class="end-sub">You left off mid-battle on wave <b>${wave}</b>.</div>
      <div class="end-buttons"></div>`);
    const btns = s.querySelector('.end-buttons');
    btns.appendChild(bigBtn(`▶ Resume wave ${wave}`, () => { this.hide(); this.hooks.resumeCampaign(); }, 'green'));
    btns.appendChild(bigBtn('↺ Restart level', () => { this.hide(); this.hooks.restartCampaign(); }));
    this._mount('resume', s);
  }

  // The campaign map: star wallet + level path (+ hero strip and star-bought
  // hero upgrades only while HEROES_ENABLED).
  showMap() {
    const p = profile.getProfile();
    const heroUrl = CONFIG.HEROES_ENABLED && p.hero.id ? getSpriteUrl('hero-' + p.hero.id) : null;
    const heroDef = CONFIG.HEROES_ENABLED && p.hero.id ? CONFIG.HEROES[p.hero.id] : null;
    const heroStrip = CONFIG.HEROES_ENABLED ? `
        <span class="mh-face">${heroUrl ? `<img src="${heroUrl}" alt="">` : (heroDef ? `<span style="color:${heroDef.color};font-size:30px">${heroDef.glyph}</span>` : '❔')}</span>
        <span class="mh-info">
          <b>${heroDef ? heroDef.name : 'Pick a hero'}</b> ${heroDef ? 'L' + p.hero.level : ''}
          <span class="mh-stars">⭐ ${profile.starsAvailable()} <span class="muted">/ ${profile.totalStarsEarned()} earned</span></span>
        </span>` : `
        <span class="mh-info">
          <b>Maze Defenders</b>
          <span class="mh-stars">⭐ ${profile.totalStarsEarned()} earned <span class="muted">— stars unlock levels</span></span>
        </span>`;
    const s = div('map-screen', `
      <div class="map-hero">${heroStrip}</div>
      <div class="map-upgrades"></div>
      <div class="map-path"></div>`);

    // star-bought permanent hero upgrades (hidden while heroes are off; stars
    // still gate level unlocks so earned totals stay visible above)
    const up = s.querySelector('.map-upgrades');
    for (const [key, def] of Object.entries(CONFIG.HEROES_ENABLED ? CONFIG.HERO_UPGRADES : {})) {
      const tier = p.starUpgrades[key] || 0;
      const maxed = tier >= def.maxTier;
      const b = document.createElement('button');
      b.className = 'ui-btn star-up';
      b.innerHTML = `<b>${def.name}</b><span>${maxed ? 'MAX' : `tier ${tier}/${def.maxTier} · ⭐${profile.starUpgradeCost(tier)}`}</span>`;
      b.disabled = maxed || !profile.canBuyStarUpgrade(key);
      b.addEventListener('click', () => { if (profile.buyStarUpgrade(key)) this.showMap(); });
      up.appendChild(b);
    }

    // The WORLD MAP: a winding trail of round level badges climbing from the
    // bottom (level 1) to the top (Endless) over scenic art — the layout every
    // working mobile TD/match-3 player already knows how to read.
    const path = s.querySelector('.map-path');
    path.classList.add('map-world');
    const url = getSpriteUrl('misc-worldmap') || getSpriteUrl('misc-title');
    if (url) path.style.backgroundImage = `linear-gradient(rgba(16,20,30,0.25), rgba(16,20,30,0.25)), url(${url})`;

    const STEP = 86;                      // vertical px per level
    const entries = [...LEVELS.map((lv) => ({ lv })), { endless: true }];
    const worldH = entries.length * STEP + 60;
    const inner = div('map-trail');
    inner.style.height = worldH + 'px';

    const xFor = (i) => 50 + Math.sin(i * 0.85) * 26;          // serpentine %
    const yFor = (i) => worldH - 70 - i * STEP;                // climb upward

    entries.forEach((en, i) => {
      // dotted connector toward the previous node
      if (i > 0) {
        for (let k = 1; k <= 3; k++) {
          const t = k / 4;
          const dot = div('trail-dot');
          dot.style.left = (xFor(i - 1) + (xFor(i) - xFor(i - 1)) * t) + '%';
          dot.style.top = (yFor(i - 1) + (yFor(i) - yFor(i - 1)) * t) + 'px';
          inner.appendChild(dot);
        }
      }
      const b = document.createElement('button');
      b.style.left = xFor(i) + '%';
      b.style.top = yFor(i) + 'px';
      if (en.endless) {
        const open = profile.endlessUnlocked();
        b.className = 'world-node endless' + (open ? '' : ' locked');
        b.innerHTML = `<span class="wn-badge">${open ? '∞' : '🔒'}</span><span class="wn-label">Endless</span>`;
        if (open) b.addEventListener('click', () => { location.href = '?level=endless'; });
        else b.disabled = true;
        b.title = open ? 'Endless Depths — 100 waves, high score' : 'Beat level 10 to unlock';
      } else {
        const lv = en.lv;
        const unlocked = profile.isLevelUnlocked(lv.num);
        const stars = profile.starsForLevel(lv.id);
        const current = unlocked && stars === 0;
        b.className = 'world-node' + (unlocked ? '' : ' locked') + (current ? ' current' : '');
        b.innerHTML = `<span class="wn-badge">${unlocked ? lv.num : '🔒'}</span>
          <span class="wn-stars">${unlocked ? starsHtml(stars) : ''}</span>
          <span class="wn-label">${lv.name}</span>`;
        if (unlocked) b.addEventListener('click', () => { location.href = '?level=' + lv.id; });
        else b.disabled = true;
        b.title = unlocked ? `${lv.name} — ${lv.waves.count} waves` : `Beat level ${lv.num - 1} to unlock`;
      }
      inner.appendChild(b);
    });
    path.appendChild(inner);

    this._mount('map', s);
    path.scrollTop = path.scrollHeight;   // start at level 1, at the bottom
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
        ? `The maze held — all ${state.maxWave} waves broken with ${state.lives} ♥ left.`
        : `Your lives ran out on wave ${state.wave}.`}</div>
      <div class="end-stats">
        Reached wave <b>${state.maxWave}</b>${CONFIG.HEROES_ENABLED && state.hero ? ` · Hero L<b>${state.hero.level}</b>` : ''} · Best ever: wave <b>${hs}</b>
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

  // Maze Mode end: the survival time, a name entry to save it, then the board.
  showMazeEnd(state) {
    const time = state.mazeTimer || 0;
    const prevBest = getScores()[0];
    const isBest = !prevBest || time > prevBest.time;
    const s = div('end-screen maze-end', `
      <div class="end-title" style="color:var(--ui-gold)">HORDE CONTAINED</div>
      <div class="maze-time">⏱ ${formatMazeTime(time)}</div>
      <div class="end-sub">${isBest ? '🏆 New best time!' : `Best: ${formatMazeTime(prevBest.time)}`}</div>
      <div class="maze-save">
        <input class="maze-name" type="text" maxlength="16" placeholder="Your name" />
        <button class="ui-btn green maze-save-btn">💾 Save score</button>
      </div>
      <div class="end-buttons"></div>`);
    const input = s.querySelector('.maze-name');
    input.value = getLastName();
    const save = () => {
      const name = input.value.trim() || 'Anon';
      setLastName(name);
      const { rank, entries } = addScore(name, time);
      this.showLeaderboard(rank, entries);
    };
    s.querySelector('.maze-save-btn').addEventListener('click', save);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const btns = s.querySelector('.end-buttons');
    btns.appendChild(bigBtn('↺ Play again', () => { location.href = '?level=maze'; }, 'green'));
    btns.appendChild(bigBtn('🗺 Menu', () => { location.href = location.pathname; }));
    this._mount('mazeEnd', s);
  }

  // The Maze Mode leaderboard (device-local). highlightRank/entries are passed
  // straight after a save so the fresh score is marked; called bare it reads
  // the stored board.
  showLeaderboard(highlightRank = -1, entries = null) {
    const rows = entries || getScores();
    const list = rows.length
      ? rows.map((e, i) => `
          <div class="lb-row${i + 1 === highlightRank ? ' me' : ''}">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name">${escapeHtml(e.name)}</span>
            <span class="lb-time">${formatMazeTime(e.time)}</span>
          </div>`).join('')
      : '<div class="lb-empty">No runs yet — be the first.</div>';
    const s = div('end-screen maze-board', `
      <div class="end-title" style="color:var(--ui-gold)">🏆 MAZE MODE</div>
      <div class="lb-list">${list}</div>
      <div class="end-buttons"></div>`);
    const btns = s.querySelector('.end-buttons');
    btns.appendChild(bigBtn('▶ Play', () => { location.href = '?level=maze'; }, 'green'));
    btns.appendChild(bigBtn('🗺 Menu', () => { location.href = location.pathname; }));
    this._mount('leaderboard', s);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bigBtn(label, onTap, cls = '') {
  const b = document.createElement('button');
  b.className = 'ui-btn big ' + cls;
  b.textContent = label;
  b.addEventListener('click', onTap);
  return b;
}
