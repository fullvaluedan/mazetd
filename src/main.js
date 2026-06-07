// =============================================================================
// main.js — bootstraps Mazecore TD (Phase 0 scaffold).
//
// At this stage it just stands up the fixed-timestep loop, paints a dark canvas
// and proves that pause + speed controls work. Later phases plug the map,
// enemies, towers, heroes, waves and HUD into the update/render hooks here.
// =============================================================================

import { CONFIG, CANVAS_W, CANVAS_H } from './config.js';
import { GameLoop } from './engine/loop.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

// --- temporary Phase 0 state: just a ticking counter we can see move ---
let simTime = 0;          // seconds of simulation elapsed
let ticksThisSecond = 0;
let lastReport = 0;

function update(dt) {
  simTime += dt;
  ticksThisSecond++;
  // Report the measured tick rate once a (real) second so we can confirm ~60Hz.
  if (simTime - lastReport >= 1) {
    console.log(`[loop] sim ~${ticksThisSecond}Hz  speed=${loop.gameSpeed}x  paused=${loop.paused}  t=${simTime.toFixed(1)}s`);
    ticksThisSecond = 0;
    lastReport = simTime;
  }
}

function render() {
  ctx.fillStyle = CONFIG.COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // A faint grid so the canvas clearly is "alive", plus a status line.
  ctx.strokeStyle = CONFIG.COLORS.gridLine;
  ctx.lineWidth = 1;
  for (let x = 0; x <= CONFIG.GRID_COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CONFIG.CELL + 0.5, 0);
    ctx.lineTo(x * CONFIG.CELL + 0.5, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y <= CONFIG.GRID_ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CONFIG.CELL + 0.5);
    ctx.lineTo(CANVAS_W, y * CONFIG.CELL + 0.5);
    ctx.stroke();
  }

  ctx.fillStyle = CONFIG.COLORS.textDim;
  ctx.font = '14px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Mazecore TD — Phase 0 scaffold', CANVAS_W / 2, CANVAS_H / 2 - 10);
  ctx.fillText(`sim time ${simTime.toFixed(1)}s   ${loop.paused ? 'PAUSED' : loop.gameSpeed + '×'}`,
    CANVAS_W / 2, CANVAS_H / 2 + 14);
  ctx.textAlign = 'left';
}

const loop = new GameLoop(update, render);
loop.start();

// --- minimal keyboard controls (full input handling arrives in Phase 1) ---
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); loop.togglePause(); }
  else if (e.key === '1') loop.setSpeed(1);
  else if (e.key === '2') loop.setSpeed(2);
  else if (e.key === '3') loop.setSpeed(3);
});

// Expose for quick console poking during development.
window.MAZECORE = { loop, CONFIG };
console.log('[main] Mazecore TD scaffold running. Space = pause, 1/2/3 = speed.');
