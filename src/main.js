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
import { createState } from './game/state.js';
import { updateEnemies } from './game/enemy.js';
import { updateTowers } from './game/tower.js';
import { updateProjectiles, updateEffects } from './game/projectile.js';
import { createHero } from './game/hero.js';
import { onEnemyKilled, onEnemyLeaked, updateFloaters, payWaveClear, payEarlyStart } from './game/economy.js';
import { startWave, processSpawning, waveComplete, updateBosses, waveInfo } from './game/wave.js';
import { tryBuild, trySell, tryUpgrade } from './game/shop.js';
import { render } from './ui/render.js';
import { HUD } from './ui/hud.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const modal = document.getElementById('modal');

const rng = makeRng(CONFIG.SEED);
const state = createState(rng);
let prevStatus = state.status;

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

// ---------------------------------------------------------------------------
// high-level actions (shared by HUD buttons + keyboard + mouse)
// ---------------------------------------------------------------------------
const actions = {
  setSpeed: (n) => loop.setSpeed(n),
  togglePause: () => loop.togglePause(),
  togglePath: () => { state.showPath = !state.showPath; },
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
    state.selected = null; state.targetingAbility = null; state.targetingAbilityIndex = -1;
  },
  cancel: () => {
    state.buildType = null; state.selected = null;
    state.targetingAbility = null; state.targetingAbilityIndex = -1; state.targetingConsumable = null;
  },
  cycleTarget: () => { if (state.selected) state.selected.cycleTargetMode(); },
  upgrade: (branch) => { if (state.selected) tryUpgrade(state, state.selected, branch); },
  sell: () => { if (state.selected) trySell(state, state.selected); },
  castAbility: (i) => {
    const h = state.hero;
    if (!h || !h.canCast(i)) return;
    const ab = h.abilities[i];
    if (ab.targetCell) {
      state.targetingAbility = ab; state.targetingAbilityIndex = i; state.buildType = null;
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
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="card">
    <h1>Mazecore <span style="color:#00d4ff">TD</span></h1>
    <p>Build a maze of towers to force 100 waves of enemies down a long, deadly
       path — but never wall them off completely. Choose your hero:</p>
    <div class="hero-pick" id="heropick"></div>
    <p class="muted">Right-click to move your hero · Q / W cast abilities · get
       anti-air before wave 15 · P toggles the path overlay.</p>
  </div>`;
  const pick = document.getElementById('heropick');
  for (const [id, def] of Object.entries(CONFIG.HEROES)) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="h-glyph" style="color:${def.color}">${def.glyph}</span>
      <span class="h-name">${def.name}</span>
      <span class="h-role">${def.role}</span>`;
    b.addEventListener('click', () => { createHero(state, id); modal.classList.add('hidden'); showBanner(`${def.name} ready!`, '', 1.5); });
    pick.appendChild(b);
  }
}

// ---------------------------------------------------------------------------
// simulation step
// ---------------------------------------------------------------------------
function update(dt) {
  state.time += dt;
  if (state.status === 'won' || state.status === 'lost') {
    updateFloaters(state, dt); updateEffects(state, dt);
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

  if (waveComplete(state)) {
    state.waveActive = false;
    const pay = payWaveClear(state, state.wave);
    showBanner(`Wave ${state.wave} cleared!  +${pay.bonus}g${pay.interest ? ` (+${pay.interest} interest)` : ''}`, '', 2);
    state.buildTimer = CONFIG.BUILD_TIMER;
    if (state.wave >= CONFIG.WIN_WAVE) state.status = 'won';
    else if (waveInfo(state.wave + 1).hasFlying) showBanner('⚠ Flying next wave — get anti-air!', 'warn', 2.5);
  }
  if (state.lives <= 0) state.status = 'lost';

  if (state.status !== prevStatus && (state.status === 'won' || state.status === 'lost')) showEndModal();
  prevStatus = state.status;
}

function showEndModal() {
  const won = state.status === 'won';
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="card">
    <h1 style="color:${won ? '#5fce7a' : '#e24b4a'}">${won ? 'VICTORY!' : 'DEFEAT'}</h1>
    <p>${won ? 'You cleared all 100 waves. The maze held.' : `Your lives ran out on wave ${state.wave}.`}</p>
    <p class="muted">Reached wave <b>${state.maxWave}</b> · Hero L<b>${state.hero ? state.hero.level : 1}</b> · Gold <b>${Math.floor(state.gold)}</b></p>
    <button class="primary" id="again" style="margin-top:14px;padding:10px 24px">Play again</button>
  </div>`;
  document.getElementById('again').addEventListener('click', actions.restart);
}

// ---------------------------------------------------------------------------
// render step
// ---------------------------------------------------------------------------
function draw() {
  render(ctx, state);
  hud.refresh(state, { speed: loop.gameSpeed, paused: loop.paused });
}

const loop = new GameLoop(update, draw);
const hud = new HUD(document.getElementById('hud'), actions);
loop.start();
showStartModal();

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
setupInput(canvas, {
  onHover(x, y) { state.hover = { x, y }; },
  onHoverEnd() { state.hover = null; },
  onLeftClick(x, y) {
    if (state.targetingAbility && state.hero) {
      state.hero.cast(state, state.targetingAbilityIndex, { x, y });
      state.targetingAbility = null; state.targetingAbilityIndex = -1;
      return;
    }
    if (state.buildType) {
      tryBuild(state, state.buildType, x, y);
      state.selected = null;
    } else {
      const t = (y >= 0 && x >= 0 && state.towerGrid[y] && state.towerGrid[y][x]) || null;
      state.selected = t;
    }
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
      case 'Escape': actions.cancel(); return true;
    }
    return false;
  },
});

window.MAZECORE = { loop, state, CONFIG, actions };
console.log('[main] Phase 6: heroes — select, command, abilities, XP, respawn.');
