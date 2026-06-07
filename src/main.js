// =============================================================================
// main.js — bootstraps Mazecore TD and owns the update/render wiring.
//
// Phase 3: build/select/sell towers (legal cells only), towers acquire targets
// and fire (projectiles + hitscan), kills pay gold, and building/selling
// re-routes enemies through the maze.
// =============================================================================

import { CONFIG, CANVAS_W, CANVAS_H } from './config.js';
import { GameLoop } from './engine/loop.js';
import { makeRng } from './engine/rng.js';
import { setupInput } from './engine/input.js';
import { createState } from './game/state.js';
import { updateEnemies } from './game/enemy.js';
import { updateTowers } from './game/tower.js';
import { updateProjectiles, updateEffects } from './game/projectile.js';
import { onEnemyKilled, onEnemyLeaked, updateFloaters, payWaveClear } from './game/economy.js';
import { startWave, processSpawning, waveComplete } from './game/wave.js';
import { tryBuild, trySell, tryUpgrade } from './game/shop.js';
import { render } from './ui/render.js';
import { HUD } from './ui/hud.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

const rng = makeRng(CONFIG.SEED);
const state = createState(rng);

// ---------------------------------------------------------------------------
// high-level actions (shared by HUD buttons + keyboard + mouse)
// ---------------------------------------------------------------------------
const actions = {
  setSpeed: (n) => loop.setSpeed(n),
  togglePause: () => loop.togglePause(),
  togglePath: () => { state.showPath = !state.showPath; },
  startWave: () => {
    if (state.waveActive || state.status === 'won' || state.status === 'lost') return;
    startWave(state, state.wave + 1);
  },
  selectBuild: (typeId) => {
    state.buildType = (state.buildType === typeId) ? null : typeId;
    state.selected = null;
  },
  cancel: () => { state.buildType = null; state.selected = null; },
  cycleTarget: () => { if (state.selected) state.selected.cycleTargetMode(); },
  upgrade: (branch) => { if (state.selected) tryUpgrade(state, state.selected, branch); },
  sell: () => { if (state.selected) trySell(state, state.selected); },
};

// ---------------------------------------------------------------------------
// simulation step
// ---------------------------------------------------------------------------
function update(dt) {
  state.time += dt;
  if (state.status === 'won' || state.status === 'lost') {
    updateFloaters(state, dt);
    updateEffects(state, dt);
    return;
  }

  processSpawning(state, dt);
  updateTowers(state, dt);
  updateProjectiles(state, dt);
  updateEnemies(state, dt, onEnemyKilled, onEnemyLeaked);
  updateEffects(state, dt);
  updateFloaters(state, dt);

  if (waveComplete(state)) {
    state.waveActive = false;
    payWaveClear(state, state.wave);
    if (state.wave >= CONFIG.WIN_WAVE) state.status = 'won';
  }
  if (state.lives <= 0) state.status = 'lost';
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

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
setupInput(canvas, {
  onHover(x, y) { state.hover = { x, y }; },
  onHoverEnd() { state.hover = null; },
  onLeftClick(x, y) {
    if (state.buildType) {
      // Build, and stay armed so the player can place several quickly (Esc cancels).
      tryBuild(state, state.buildType, x, y);
      state.selected = null;
    } else {
      // select a tower on this cell (or clear selection)
      const t = (y >= 0 && x >= 0 && state.towerGrid[y] && state.towerGrid[y][x]) || null;
      state.selected = t;
    }
  },
  onRightClick() { /* hero command arrives in Phase 6 */ },
  onKey(key) {
    switch (key) {
      case ' ': loop.togglePause(); return true;
      case '1': loop.setSpeed(1); return true;
      case '2': loop.setSpeed(2); return true;
      case '3': loop.setSpeed(3); return true;
      case 'p': case 'P': state.showPath = !state.showPath; return true;
      case 's': case 'S': actions.startWave(); return true;
      case 'Escape': actions.cancel(); return true;
    }
    return false;
  },
});

window.MAZECORE = { loop, state, CONFIG, actions };
console.log('[main] Phase 3: towers, combat & maze re-routing.');
