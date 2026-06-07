// =============================================================================
// main.js — bootstraps Mazecore TD and owns the update/render wiring.
//
// Phase 1: build the map, show spawns/goals/obstacles and the live path overlay,
// wire pause/speed and the P (toggle path) key. Later phases hang enemies,
// towers, the hero, waves and the HUD off the same hooks.
// =============================================================================

import { CONFIG, CANVAS_W, CANVAS_H } from './config.js';
import { GameLoop } from './engine/loop.js';
import { makeRng } from './engine/rng.js';
import { setupInput } from './engine/input.js';
import { createState } from './game/state.js';
import { render } from './ui/render.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

// Seeded so the map is reproducible. (Phase 8 will let this vary per run.)
const rng = makeRng(CONFIG.SEED);
const state = createState(rng);

function update(dt) {
  state.time += dt;
  // (Phase 2+: enemies, towers, projectiles, hero, waves simulate here.)
}

function draw() {
  render(ctx, state);
}

const loop = new GameLoop(update, draw);
loop.start();

// ---- input ----
setupInput(canvas, {
  onHover(x, y) { state.hover = { x, y }; },
  onHoverEnd() { state.hover = null; },
  onLeftClick() { /* building arrives in Phase 3 */ },
  onRightClick() { /* hero command arrives in Phase 6 */ },
  onKey(key) {
    switch (key) {
      case ' ': loop.togglePause(); return true;
      case '1': loop.setSpeed(1); return true;
      case '2': loop.setSpeed(2); return true;
      case '3': loop.setSpeed(3); return true;
      case 'p': case 'P': state.showPath = !state.showPath; return true;
    }
    return false;
  },
});

// Expose for debugging in the console.
window.MAZECORE = { loop, state, CONFIG };
console.log('[main] Phase 1: map + pathfinding. P = toggle path, Space = pause, 1/2/3 = speed.');
