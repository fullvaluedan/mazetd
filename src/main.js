// =============================================================================
// main.js — bootstraps Mazecore TD and owns the update/render wiring.
//
// Phase 6: pick a hero at the start, command it (right-click) to pathfind through
// the maze, auto-attack, take damage, die & respawn, gain XP/levels, and cast its
// two abilities (Q / W, or the HUD buttons; targeted abilities click a cell).
// =============================================================================

import { CONFIG, CANVAS_W, CANVAS_H } from './config.js';
import { GameLoop } from './engine/loop.js';
import { makeRng } from './engine/rng.js';
import { setupInput } from './engine/input.js';
import { createState, canBuildAt } from './game/state.js';
import { updateEnemies } from './game/enemy.js';
import { updateTowers } from './game/tower.js';
import { updateProjectiles, updateEffects } from './game/projectile.js';
import { createHero } from './game/hero.js';
import { onEnemyKilled, onEnemyLeaked, updateFloaters, updateParticles, payWaveClear, payEarlyStart } from './game/economy.js';
import { startWave, processSpawning, waveComplete, updateBosses, waveInfo } from './game/wave.js';
import { tryBuild, trySell, tryUpgrade, tryHeroUpgrade, tryConsumable, tryTowerBoost } from './game/shop.js';
import { saveGame, hasSave, loadSnapshot, applySnapshot, getHighScore, recordHighScore } from './game/save.js';
import { render } from './ui/render.js';
import { HUD } from './ui/hud.js';
import { loadSprites, toggleSprites } from './ui/sprites.js';
import { Viewport } from './ui/viewport.js';
import { createHints } from './ui/hints.js';
import { hoverCardHtml, enemyCardHtml, enemyAt } from './ui/infocard.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const modal = document.getElementById('modal');
const uiLayer = document.getElementById('ui');
// Letterbox + DPR: viewport owns the canvas backing store and CSS box from
// here on; all draw code keeps working in fixed 896x576 world coordinates.
const viewport = new Viewport(canvas, uiLayer, document.getElementById('stage'));

let state = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
let prevStatus = state.status;
let prevSiege = false;

function clearTargeting() {
  state.targetingAbility = null; state.targetingAbilityIndex = -1;
  state.targetingConsumable = null; state.targetingConsumableKey = null;
}

// ---------------------------------------------------------------------------
// transient banners over the canvas
// ---------------------------------------------------------------------------
function showBanner(text, cls = '', dur = 2.2) {
  const el = document.createElement('div');
  el.className = 'banner ' + cls;
  el.textContent = text;
  overlay.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, dur * 1000);
}

// (first-run onboarding hints live in ui/hints.js; inspect-card content in
//  ui/infocard.js — both created/imported around the HUD boot below)

function canBuildAtSafe(x, y) {
  try { return canBuildAt(state, x, y); } catch { return false; }
}

// While a sheet is open the game auto-pauses; closing restores the player's
// own pause choice.
let pausedBySheet = false, pausedBefore = false;
function setPausedBySheet(open) {
  if (open && !pausedBySheet) { pausedBefore = loop.paused; loop.setPaused(true); pausedBySheet = true; }
  else if (!open && pausedBySheet) { loop.setPaused(pausedBefore); pausedBySheet = false; }
}

// ---------------------------------------------------------------------------
// high-level actions (shared by HUD buttons + keyboard + mouse)
// ---------------------------------------------------------------------------
const actions = {
  openSettings: () => hud.sheets.openSettings(state, { speed: loop.gameSpeed, paused: loop.paused }),
  openStore: () => hud.sheets.openStore(state),
  closeSheet: () => hud.sheets.close(),
  setPausedBySheet,
  setSpeed: (n) => loop.setSpeed(n),
  cycleSpeed: () => {
    const i = CONFIG.SPEEDS.indexOf(loop.gameSpeed);
    loop.setSpeed(CONFIG.SPEEDS[(i + 1) % CONFIG.SPEEDS.length]);
  },
  togglePause: () => loop.togglePause(),
  togglePath: () => { state.showPath = !state.showPath; },
  toggleArt: () => { toggleSprites(); },
  toggleAuto: () => { state.autoStart = !state.autoStart; },
  startWave: () => {
    if (!state.hero || state.waveActive || state.status === 'won' || state.status === 'lost') return;
    const bonus = payEarlyStart(state, state.buildTimer);
    state.buildTimer = 0;
    startWave(state, state.wave + 1);
    const info = waveInfo(state.wave);
    if (bonus > 0) showBanner(`Early start! +${bonus}g`, 'warn', 1.6);
    if (info.hasFlying) showBanner('⚠ Flying incoming!', 'warn');
    if (info.isBoss) showBanner(`Wave ${state.wave}: BOSS`, 'danger');
  },
  selectBuild: (typeId) => {
    state.buildType = (state.buildType === typeId) ? null : typeId;
    state.selected = null; clearTargeting();
  },
  // ---- radial-ring actions (the in-scene build/manage flow) ----
  buildAt: (typeId, x, y) => {
    if (tryBuild(state, typeId, x, y)) hud.closeRadial();   // one-shot: build closes the ring
  },
  upgradeTower: (tower, branch) => {
    if (tryUpgrade(state, tower, branch)) hud.openTowerRing(state, tower);  // rebuilt with new level/prices
  },
  sellTower: (tower) => { hud.closeRadial(); trySell(state, tower); },
  cycleTargetAndRefresh: (tower) => { tower.cycleTargetMode(); hud.openTowerRing(state, tower); },
  cancel: () => {
    if (hud.radialOpen) { hud.closeRadial(); return; }      // Esc unwinds one layer at a time
    state.buildType = null; state.selected = null; state.heroSelected = false; clearTargeting();
  },
  selectHero: () => { if (state.hero && !state.hero.downed) { state.heroSelected = !state.heroSelected; hud.closeRadial(); } },
  heroUpgrade: (key) => { tryHeroUpgrade(state, key); },
  towerBoost: (key) => { tryTowerBoost(state, key); },
  consumable: (key) => {
    const def = CONFIG.CONSUMABLES[key];
    if (def.targetCell) {
      state.targetingConsumable = def; state.targetingConsumableKey = key;
      state.buildType = null; state.targetingAbility = null; state.targetingAbilityIndex = -1;
    } else {
      tryConsumable(state, key, null);
    }
  },
  cycleTarget: () => { if (state.selected) state.selected.cycleTargetMode(); },
  upgrade: (branch) => { if (state.selected) tryUpgrade(state, state.selected, branch); },
  sell: () => { if (state.selected) trySell(state, state.selected); },
  save: () => {
    if (state.waveActive) { showBanner('Save between waves only', 'warn', 1.4); return; }
    if (saveGame(state)) showBanner('Game saved', '', 1.4);
  },
  load: () => {
    const snap = loadSnapshot();
    if (!snap) { showBanner('No save found', 'warn', 1.4); return; }
    state = applySnapshot(snap);
    prevStatus = state.status;
    clearTargeting();
    modal.classList.add('hidden');
    showBanner('Game loaded', '', 1.4);
  },
  castAbility: (i) => {
    const h = state.hero;
    if (!h || !h.canCast(i)) return;
    const ab = h.abilities[i];
    if (ab.targetCell) {
      state.targetingAbility = ab; state.targetingAbilityIndex = i;
      state.buildType = null; state.targetingConsumable = null; state.targetingConsumableKey = null;
    } else {
      h.cast(state, i);
    }
  },
  restart: () => location.reload(),
};

// ---------------------------------------------------------------------------
// start screen — hero selection
// ---------------------------------------------------------------------------
function showStartModal() {
  const hs = getHighScore();
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="card">
    <h1>Mazecore <span style="color:#00d4ff">TD</span></h1>
    <p>Build a maze of towers to force 100 waves of enemies down a long, deadly
       path — but never wall them off completely. Choose your hero:</p>
    <div class="hero-pick" id="heropick"></div>
    ${hasSave() ? '<button class="primary" id="continue" style="padding:8px 22px;margin-bottom:8px">Continue saved game</button><br>' : ''}
    <p class="muted">Right-click to move your hero · Q / W cast abilities · get
       anti-air before wave 15 · P toggles the path overlay.${hs ? ` · Best: wave ${hs}` : ''}</p>
  </div>`;
  const pick = document.getElementById('heropick');
  for (const [id, def] of Object.entries(CONFIG.HEROES)) {
    const b = document.createElement('button');
    b.innerHTML = `<img src="assets/heroes/${id}.png" alt="" style="width:52px;height:52px;align-self:center" onerror="this.remove()">
      <span class="h-glyph" style="color:${def.color}">${def.glyph}</span>
      <span class="h-name">${def.name}</span>
      <span class="h-role">${def.role}</span>`;
    // if the portrait loads, hide the placeholder glyph
    const img = b.querySelector('img');
    if (img) img.addEventListener('load', () => { const g = b.querySelector('.h-glyph'); if (g) g.style.display = 'none'; });
    b.addEventListener('click', () => { createHero(state, id); modal.classList.add('hidden'); showBanner(`${def.name} ready!`, '', 1.5); });
    pick.appendChild(b);
  }
  const cont = document.getElementById('continue');
  if (cont) cont.addEventListener('click', actions.load);
}

// ---------------------------------------------------------------------------
// simulation step
// ---------------------------------------------------------------------------
function update(dt) {
  state.time += dt;
  if (state.status === 'won' || state.status === 'lost') {
    updateFloaters(state, dt); updateEffects(state, dt); updateParticles(state, dt);
    return;
  }

  if (!state.waveActive && state.buildTimer > 0 && state.hero) {
    state.buildTimer = Math.max(0, state.buildTimer - dt);
    if (state.buildTimer <= 0 && state.autoStart) actions.startWave();
  }

  processSpawning(state, dt);
  updateBosses(state, dt);
  updateTowers(state, dt);
  updateProjectiles(state, dt);
  updateEnemies(state, dt, onEnemyKilled, onEnemyLeaked);
  if (state.hero) state.hero.update(dt, state);
  updateEffects(state, dt);
  updateFloaters(state, dt);
  updateParticles(state, dt);

  if (waveComplete(state)) {
    state.waveActive = false;
    if (state.wave >= 1) hints.finish();
    const pay = payWaveClear(state, state.wave);
    showBanner(`Wave ${state.wave} cleared!  +${pay.bonus}g${pay.interest ? ` (+${pay.interest} interest)` : ''}`, '', 2);
    state.buildTimer = CONFIG.BUILD_TIMER;
    if (state.wave >= CONFIG.WIN_WAVE) state.status = 'won';
    else if (waveInfo(state.wave + 1).hasFlying) showBanner('⚠ Flying next wave — get anti-air!', 'warn', 2.5);
  }
  if (state.lives <= 0) state.status = 'lost';

  // siege alert: fires once each time the maze flips from open to sealed
  if (state.siege && !prevSiege) showBanner("⚠ Path sealed — they're attacking your walls!", 'danger', 2.5);
  prevSiege = state.siege;

  if (state.status !== prevStatus && (state.status === 'won' || state.status === 'lost')) showEndModal();
  prevStatus = state.status;
}

function showEndModal() {
  const won = state.status === 'won';
  recordHighScore(state.maxWave);
  const hs = getHighScore();
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="card">
    <h1 style="color:${won ? '#5fce7a' : '#e24b4a'}">${won ? 'VICTORY!' : 'DEFEAT'}</h1>
    <p>${won ? 'You cleared all 100 waves. The maze held.' : `Your lives ran out on wave ${state.wave}.`}</p>
    <p class="muted">Reached wave <b>${state.maxWave}</b> · Hero L<b>${state.hero ? state.hero.level : 1}</b> · Best ever: wave <b>${hs}</b></p>
    <button class="primary" id="again" style="margin-top:14px;padding:10px 24px">Play again</button>
  </div>`;
  document.getElementById('again').addEventListener('click', actions.restart);
}

// ---------------------------------------------------------------------------
// render step
// ---------------------------------------------------------------------------
function draw() {
  viewport.applyTransform(ctx);     // world px -> device px (letterbox + DPR)
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  render(ctx, state);
  hud.refresh(state, { speed: loop.gameSpeed, paused: loop.paused });
  hints.update(state);
}

const loop = new GameLoop(update, draw);
const hud = new HUD(null, actions, { uiLayer, viewport });
const hints = createHints(overlay, hud);
viewport.onResize = () => hud.onViewportResize();
loop.start();

// Portrait phones: the battlefield needs landscape — show the rotate overlay
// and hold the sim while it's up. Desktop portrait windows just letterbox.
(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const portrait = window.matchMedia('(orientation: portrait)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const el = document.getElementById('rotate');
  if (!el) return;
  let pausedByRotate = false;
  const apply = () => {
    const show = portrait.matches && coarse.matches;
    el.classList.toggle('hidden', !show);
    if (show && !loop.paused) { loop.setPaused(true); pausedByRotate = true; }
    else if (!show && pausedByRotate) { loop.setPaused(false); pausedByRotate = false; }
  };
  const sub = (mq) => { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); };
  sub(portrait); sub(coarse);
  apply();
})();

// Debug handle (dev tools / preview verification). `state` is a live getter
// because load() replaces the whole state object.
if (typeof window !== 'undefined') {
  window.__mz = { get state() { return state; }, hud, loop, actions, viewport };
}
showStartModal();
loadSprites();   // async; art pops in when ready, shapes are the fallback

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
setupInput(canvas, {
  onHover(x, y, px, py) { state.hover = { x, y }; if (hud.infocard) hud.infocard.showHover(hoverCardHtml(state, x, y, px, py)); },
  onHoverEnd() { state.hover = null; if (hud.infocard) hud.infocard.clearHover(); },
  onLeftClick(x, y, px, py) {
    if (state.targetingAbility && state.hero) {
      state.hero.cast(state, state.targetingAbilityIndex, { x, y });
      clearTargeting();
      return;
    }
    if (state.targetingConsumable) {
      tryConsumable(state, state.targetingConsumableKey, { x, y });
      clearTargeting();
      return;
    }
    // tapping the hero selects it (KR style; mobile has no right-click)
    const h = state.hero;
    if (h && !h.downed && Math.hypot(px - h.x, py - h.y) <= 20) {
      state.heroSelected = !state.heroSelected;
      state.selected = null;
      hud.closeRadial();
      return;
    }
    const t = (y >= 0 && x >= 0 && state.towerGrid[y] && state.towerGrid[y][x]) || null;
    // hero selected: taps on open ground are move commands and the hero STAYS
    // selected (chain orders); tapping a tower hands control to the tower ring.
    if (state.heroSelected && h && !h.downed && !t) {
      h.commandMove(state, x, y);
      return;
    }
    state.heroSelected = false;
    // tap an enemy -> inspect card (touch has no hover)
    const ne = enemyAt(state, px, py);
    if (ne && hud.infocard) {
      hud.infocard.showTap(enemyCardHtml(ne));
      return;
    }
    // tap a tower -> tower ring (upgrade/sell/target); tap open ground -> build ring
    if (t) {
      hud.openTowerRing(state, t);
      return;
    }
    if (canBuildAtSafe(x, y)) {
      state.selected = null;
      hud.openBuildRing(state, x, y);
      return;
    }
    state.selected = null;
  },
  onRightClick(x, y) { if (state.hero) state.hero.commandMove(state, x, y); },
  onKey(key) {
    switch (key) {
      case ' ': loop.togglePause(); return true;
      case '1': loop.setSpeed(1); return true;
      case '2': loop.setSpeed(2); return true;
      case '3': loop.setSpeed(3); return true;
      case 'p': case 'P': state.showPath = !state.showPath; return true;
      case 's': case 'S': actions.startWave(); return true;
      case 'q': case 'Q': actions.castAbility(0); return true;
      case 'w': case 'W': actions.castAbility(1); return true;
      case 'm': case 'M': actions.selectHero(); return true;
      case 'Escape': actions.cancel(); return true;
    }
    return false;
  },
});

window.MAZECORE = { get state() { return state; }, loop, CONFIG, actions };
console.log('[main] Mazecore TD ready — pick a hero and build your maze.');
