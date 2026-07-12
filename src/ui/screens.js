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
import { difficultyLabel, difficultySummary, getDifficultyMode, setDifficultyMode } from '../services/difficulty.js';
import { getScores, addScore, getLastName, setLastName, formatMazeTime } from '../services/leaderboard.js';
import { addStageScore, calculateStageScore, getCampaignLastName, getStageScores, setCampaignLastName } from '../services/campaign-leaderboard.js';
import { div, lockSurface } from './components.js';
import { getSpriteUrl } from './sprites.js';
import { icon } from './icons.js';

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
    if (this._unlock) { this._unlock(); this._unlock = null; }
    this.current = null;
    delete this.modal.dataset.uiState;
    this.modal.classList.add('hidden');
    this.modal.innerHTML = '';
  }

  _mount(name, el) {
    if (this._unlock) { this._unlock(); this._unlock = null; }
    this.current = name;
    this.modal.dataset.uiState = name;
    this.modal.innerHTML = '';
    this.modal.appendChild(el);
    this.modal.classList.remove('hidden');
    this._unlock = lockSurface(this.modal);
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
    const emblem = getSpriteUrl('misc-icon') || 'assets/misc/icon.png';
    const s = div('title-screen', `
      <div class="title-panel">
        <div class="title-kicker">Crystal Kingdom Defense</div>
        ${emblem ? `<span class="title-crest"><img class="title-emblem" src="${emblem}" alt="Mazecore crystal crest" /></span>` : ''}
        <div class="title-logo">MAZECORE<span>TD</span></div>
        <div class="title-tag">Build the maze. Bend the horde. Survive 100 waves.</div>
        <div class="title-difficulty"><span>Campaign</span><b>${difficultyLabel()}</b></div>
        <div class="title-buttons"></div>
      </div>
      ${hs ? `<div class="title-best">Best run: wave ${hs}</div>` : ''}`);
    const btns = s.querySelector('.title-buttons');
    btns.appendChild(bigBtn('PLAY', () => this.showDifficultySelect(() => {
      if (CONFIG.HEROES_ENABLED && !profile.getProfile().hero.id) this.showHeroSelect();
      else this.showMap();
    }), 'green'));
    if (this.hooks.hasSave()) btns.appendChild(bigBtn('CONTINUE RUN', () => { this.hide(); this.hooks.continueRun(); }));
    btns.appendChild(bigBtn('MAZE MODE', () => { location.href = '?level=maze'; }, 'gold'));
    btns.appendChild(bigBtn('SETTINGS', () => this.hooks.openSettings()));
    this._mount('title', s);
    this.refreshArt();
  }

  showDifficultySelect(onPick) {
    const current = getDifficultyMode();
    const cards = Object.entries(CONFIG.DIFFICULTY_MODES).map(([mode, def]) => {
      const active = mode === current;
      const cls = `diff-card simple ${mode}${active ? ' active' : ''}`;
      return `
        <button class="${cls}" data-mode="${mode}">
          <span class="diff-name">${mode.toUpperCase()}</span>
        </button>`;
    }).join('');
    const s = div('difficulty-screen', `
      <div class="title-panel difficulty-panel">
        <div class="title-logo difficulty-title">CHOOSE DIFFICULTY</div>
        <div class="difficulty-cards">${cards}</div>
      </div>`);
    s.querySelectorAll('.diff-card').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.mode === current ? 'true' : 'false');
      btn.addEventListener('click', () => {
        const mode = setDifficultyMode(btn.dataset.mode);
        this.hide();
        if (onPick) onPick(mode);
      });
    });
    this._mount('difficulty', s);
  }

  showHeroSelect() {
    const emblem = getSpriteUrl('misc-icon') || 'assets/misc/icon.png';
    const s = div('hero-screen', `
      <div class="hero-screen-title-wrap">
        <img class="title-emblem hero-emblem" src="${emblem}" alt="" />
        <div class="hero-screen-title">Choose your hero</div>
      </div>
      <div class="hero-cards"></div>`);
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
    btns.appendChild(bigBtn(`Resume wave ${wave}`, () => { this.hide(); this.hooks.resumeCampaign(); }, 'green'));
    btns.appendChild(bigBtn('Restart level', () => { this.hide(); this.hooks.restartCampaign(); }));
    this._mount('resume', s);
  }

  // The campaign map: star wallet + level path (+ hero strip and star-bought
  // hero upgrades only while HEROES_ENABLED).
  showMap() {
    const p = profile.getProfile();
    const emblem = getSpriteUrl('misc-icon') || 'assets/misc/icon.png';
    const difficulty = difficultyLabel();
    const heroUrl = CONFIG.HEROES_ENABLED && p.hero.id ? getSpriteUrl('hero-' + p.hero.id) : null;
    const heroDef = CONFIG.HEROES_ENABLED && p.hero.id ? CONFIG.HEROES[p.hero.id] : null;
    const heroStrip = CONFIG.HEROES_ENABLED ? `
        ${emblem ? `<span class="mh-emblem"><img src="${emblem}" alt=""></span>` : ''}
        <span class="mh-face">${heroUrl ? `<img src="${heroUrl}" alt="">` : (heroDef ? `<span style="color:${heroDef.color};font-size:30px">${heroDef.glyph}</span>` : '❔')}</span>
        <span class="mh-info">
          <b>${heroDef ? heroDef.name : 'Pick a hero'}</b> ${heroDef ? 'L' + p.hero.level : ''}
          <span class="mh-stars">${icon('trophy')} ${profile.starsAvailable()} <span class="muted">/ ${profile.totalStarsEarned()} earned</span></span>
        </span>` : `
        ${emblem ? `<span class="mh-emblem"><img src="${emblem}" alt=""></span>` : ''}
        <span class="mh-info">
          <b>Maze Defenders</b>
          <span class="mh-stars">${icon('trophy')} ${profile.totalStarsEarned()} earned <span class="muted">— stars unlock levels</span></span>
          <span class="mh-stars mh-diff">Difficulty: ${difficulty}</span>
        </span>`;
    const s = div('map-screen', `
      <div class="map-plate">
        <div class="map-toolbar">
          <button class="ui-btn map-home">HOME</button>
          <div class="map-heading"><b>Kingdom Trail</b><span>Choose the next defense</span></div>
          <button class="ui-btn map-difficulty">${difficulty}</button>
        </div>
        <div class="map-hero">${heroStrip}</div>
        <div class="map-upgrades"></div>
      </div>
      <div class="map-path"></div>`);
    s.querySelector('.map-home').addEventListener('click', () => this.showTitle());
    s.querySelector('.map-difficulty').addEventListener('click', () => this.showDifficultySelect(() => this.showMap()));

    // star-bought permanent hero upgrades (hidden while heroes are off; stars
    // still gate level unlocks so earned totals stay visible above)
    const up = s.querySelector('.map-upgrades');
    for (const [key, def] of Object.entries(CONFIG.HEROES_ENABLED ? CONFIG.HERO_UPGRADES : {})) {
      const tier = p.starUpgrades[key] || 0;
      const maxed = tier >= def.maxTier;
      const b = document.createElement('button');
      b.className = 'ui-btn star-up';
      b.innerHTML = `<b>${def.name}</b><span>${maxed ? 'MAX' : `tier ${tier}/${def.maxTier} · ${profile.starUpgradeCost(tier)} stars`}</span>`;
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
        b.innerHTML = `<span class="wn-badge">${open ? '∞' : icon('lock')}</span><span class="wn-label">Endless</span>`;
        if (open) b.addEventListener('click', () => { location.href = this.levelHref('endless'); });
        else b.disabled = true;
        b.title = open ? 'Endless Depths — 100 waves, high score' : 'Beat level 10 to unlock';
      } else {
        const lv = en.lv;
        const unlocked = profile.isLevelUnlocked(lv.num);
        const stars = profile.starsForLevel(lv.id);
        const current = unlocked && stars === 0;
        b.className = 'world-node' + (unlocked ? '' : ' locked') + (current ? ' current' : '');
        if (current) b.dataset.current = 'true';
        b.innerHTML = `<span class="wn-badge">${unlocked ? lv.num : icon('lock')}</span>
          <span class="wn-stars">${unlocked ? starsHtml(stars) : ''}</span>
          <span class="wn-label">${lv.name}</span>`;
        if (unlocked) b.addEventListener('click', () => { location.href = this.levelHref(lv.id); });
        else b.disabled = true;
        b.title = unlocked ? `${lv.name} — ${lv.waves.count} waves` : `Beat level ${lv.num - 1} to unlock`;
      }
      inner.appendChild(b);
    });
    path.appendChild(inner);

    this._mount('map', s);
    setTimeout(() => {
      const current = path.querySelector('.world-node.current');
      if (current) path.scrollTop = Math.max(0, current.offsetTop - (path.clientHeight - current.offsetHeight) / 2);
      else path.scrollTop = path.scrollHeight;
    }, 0);
  }

  showEnd(state) {
    const won = state.status === 'won';
    const n = starsFor(state);
    const stars = [1, 2, 3].map((i) => `<span class="star ${i <= n ? 'lit' : ''}">★</span>`).join('');
    const hs = this.hooks.highScore();
    const campaignWin = won && state.level && !state.level.endless && !state.level.mazeMode;
    const points = campaignWin ? calculateStageScore(state.gold, state.lives) : null;
    const s = div(won ? 'end-screen victory' : 'end-screen defeat', `
      <div class="end-title" style="color:${won ? 'var(--ui-green)' : 'var(--ui-red)'}">${won ? 'VICTORY!' : 'DEFEAT'}</div>
      <div class="end-stars">${stars}</div>
      <div class="end-sub">${won
        ? `The maze held — all ${state.maxWave} waves broken with ${state.lives} lives left.`
        : `Your lives ran out on wave ${state.wave}.`}</div>
      <div class="end-stats">
        Reached wave <b>${state.maxWave}</b>${CONFIG.HEROES_ENABLED && state.hero ? ` · Hero L<b>${state.hero.level}</b>` : ''} · Best ever: wave <b>${hs}</b>
      </div>
      ${points ? `<div class="stage-score" aria-label="Stage score ${points.total}">
        <div class="stage-score-title">STAGE SCORE <b>${points.total}</b></div>
        <div class="stage-score-grid">
          <span>${icon('coin')} Gold left <b>${points.gold}</b></span>
          <span>${icon('heart')} Lives left <b>${points.lives}</b></span>
        </div>
        <div class="stage-score-note">${points.goldPoints} gold points + ${points.lifePoints} life points</div>
      </div>
      <div class="stage-save">
        <input class="stage-name" type="text" maxlength="16" placeholder="Your name" />
        <button class="ui-btn green stage-save-btn"><span class="control-face">${icon('save')}<span>Save score</span></span></button>
      </div>` : ''}
      <div class="end-buttons"></div>`);
    const btns = s.querySelector('.end-buttons');
    if (campaignWin) {
      const input = s.querySelector('.stage-name');
      input.value = getCampaignLastName();
      const save = () => {
        const name = input.value.trim() || 'Anon';
        setCampaignLastName(name);
        const result = addStageScore(state.level.id, name, {
          gold: state.gold,
          lives: state.lives,
          levelName: state.level.name,
          difficulty: difficultyLabel(),
        });
        this.showStageLeaderboard(state.level, result.rank, result.entries);
      };
      s.querySelector('.stage-save-btn').addEventListener('click', save);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    }
    if (!won && this.hooks.revive && (!this.hooks.canRevive || this.hooks.canRevive())) {
      const r = bigBtn('Watch ad — revive with ' + (CONFIG.ADS ? CONFIG.ADS.REVIVE.lives : 5) + ' lives', () => this.hooks.revive(), 'gold');
      r.id = 'revive-btn';
      btns.appendChild(r);
    }
    const lv = state.level;
    if (lv && !lv.endless) {
      // campaign navigation
      if (won) {
        const next = LEVELS.find((l) => l.num === lv.num + 1);
        if (next) btns.appendChild(bigBtn('Next level', () => { location.href = this.levelHref(next.id); }, 'green'));
      }
      btns.appendChild(bigBtn(won ? 'Replay' : 'Try again', () => this.hooks.restart(), won ? '' : 'green'));
      btns.appendChild(bigBtn('Level map', () => { location.href = this.menuHref(); }));
    } else {
      btns.appendChild(bigBtn(won ? 'Play again' : 'Try again', () => this.hooks.restart(), 'green'));
      if (lv) btns.appendChild(bigBtn('Level map', () => { location.href = this.menuHref(); }));
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
      <div class="maze-time">${icon('wave')} ${formatMazeTime(time)}</div>
      <div class="end-sub">${isBest ? `${icon('trophy')} New best time!` : `Best: ${formatMazeTime(prevBest.time)}`}</div>
      <div class="maze-save">
        <input class="maze-name" type="text" maxlength="16" placeholder="Your name" />
        <button class="ui-btn green maze-save-btn"><span class="control-face">${icon('save')}<span>Save score</span></span></button>
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
    btns.appendChild(bigBtn('Play again', () => { location.href = this.levelHref('maze'); }, 'green'));
    btns.appendChild(bigBtn('Menu', () => { location.href = this.menuHref(); }));
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
      <div class="end-title" style="color:var(--ui-gold)">${icon('trophy')} MAZE MODE</div>
      <div class="lb-list">${list}</div>
      <div class="end-buttons"></div>`);
    const btns = s.querySelector('.end-buttons');
    btns.appendChild(bigBtn('Play', () => { location.href = this.levelHref('maze'); }, 'green'));
    btns.appendChild(bigBtn('Menu', () => { location.href = this.menuHref(); }));
    this._mount('leaderboard', s);
  }

  showStageLeaderboard(level, highlightRank = -1, entries = null) {
    const rows = entries || getStageScores(level.id);
    const list = rows.length
      ? rows.map((entry, i) => `
          <div class="lb-row${i + 1 === highlightRank ? ' me' : ''}">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name">${escapeHtml(entry.name)}</span>
            <span class="lb-score">${entry.score}</span>
          </div>`).join('')
      : '<div class="lb-empty">No scores yet -- be the first defender.</div>';
    const s = div('end-screen maze-board stage-board', `
      <div class="end-title" style="color:var(--ui-gold)">${icon('trophy')} ${escapeHtml(level.name)}</div>
      <div class="stage-board-rule">Gold + lives determine your stage score</div>
      <div class="lb-list">${list}</div>
      <div class="end-buttons"></div>`);
    const btns = s.querySelector('.end-buttons');
    btns.appendChild(bigBtn('Replay', () => { location.href = this.levelHref(level.id); }, 'green'));
    btns.appendChild(bigBtn('Level map', () => { location.href = this.menuHref(); }));
    this._mount('stageLeaderboard', s);
  }

  levelHref(levelId) {
    const d = getDifficultyMode();
    return `?level=${encodeURIComponent(levelId)}&difficulty=${encodeURIComponent(d)}`;
  }

  menuHref() {
    const d = getDifficultyMode();
    return `?difficulty=${encodeURIComponent(d)}`;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bigBtn(label, onTap, cls = '') {
  const b = document.createElement('button');
  b.className = 'ui-btn big ' + cls;
  const lower = label.toLowerCase();
  const iconName = lower.includes('map') || lower.includes('menu') ? 'map'
    : lower.includes('replay') || lower.includes('again') || lower.includes('restart') ? 'retry'
      : lower.includes('save') ? 'save'
        : lower.includes('setting') ? 'settings'
          : lower.includes('maze mode') ? 'wall'
            : lower.includes('ad') || lower.includes('revive') ? 'reward'
              : 'play';
  const clean = label.replace(/^[^A-Za-z0-9]+/, '').replace(/\s+[▶♥]$/g, '');
  b.setAttribute('aria-label', clean);
  b.innerHTML = `<span class="control-face">${icon(iconName)}<span class="control-label">${clean}</span></span>`;
  b.addEventListener('click', onTap);
  return b;
}
