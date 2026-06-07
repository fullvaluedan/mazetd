// =============================================================================
// loop.js — fixed-timestep game loop, decoupled from rendering.
//
// The simulation always advances in fixed 1/60s steps. This keeps physics,
// cooldowns and pathing perfectly deterministic regardless of the monitor's
// refresh rate. Rendering happens once per animation frame.
//
//   - gameSpeed (1x/2x/3x) runs N sim ticks per frame.
//   - pause stops the sim but keeps rendering (so the HUD stays live).
//   - MAX_STEPS_PER_FRAME stops a slow tab from "spiralling" (trying to catch up
//     with thousands of ticks after the browser was backgrounded).
// =============================================================================

import { CONFIG, TICK_DT } from '../config.js';

export class GameLoop {
  constructor(update, render) {
    this.update = update;      // update(dt) — advance the sim by one fixed tick
    this.render = render;      // render(alpha) — draw the current frame
    this.gameSpeed = 1;
    this.paused = false;
    this.running = false;
    this.accumulator = 0;      // leftover real-time waiting to be simulated (sec)
    this.lastTime = 0;
    this.tickCount = 0;        // total sim ticks run (handy for debugging)
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._frame);
  }

  setSpeed(mult) { this.gameSpeed = mult; }
  togglePause() { this.paused = !this.paused; return this.paused; }
  setPaused(p) { this.paused = p; }

  _frame(now) {
    if (!this.running) return;
    let frameSec = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamp huge gaps (e.g. tab was backgrounded) to avoid a catch-up spiral.
    if (frameSec > 0.25) frameSec = 0.25;

    if (!this.paused) {
      // gameSpeed multiplies how much sim-time we owe per real second.
      this.accumulator += frameSec * this.gameSpeed;
      let steps = 0;
      while (this.accumulator >= TICK_DT && steps < CONFIG.MAX_STEPS_PER_FRAME) {
        this.update(TICK_DT);
        this.accumulator -= TICK_DT;
        steps++;
        this.tickCount++;
      }
      // If we hit the step cap, drop the backlog rather than accumulate it.
      if (steps >= CONFIG.MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }

    // alpha = how far we are between sim ticks, for optional render interpolation.
    const alpha = this.accumulator / TICK_DT;
    this.render(alpha);
    requestAnimationFrame(this._frame);
  }
}
