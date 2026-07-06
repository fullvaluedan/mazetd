// =============================================================================
// viewport.js — letterboxes the per-level world into whatever box the stage
// offers, at devicePixelRatio sharpness, and owns the pan/zoom camera.
//
// World coordinates NEVER change: every draw call still works in world px. Only
// the canvas backing store (cssSize x dpr) and its CSS box are dynamic; one
// setTransform at the top of each frame maps world -> device pixels. The #ui
// overlay div is kept to the exact same CSS box as the canvas, so DOM widgets
// can anchor to world objects through worldToUi().
//
// Camera: camX/camY are the world coords of the top-left visible corner; zoom
// is RELATIVE to the fit-all letterbox (zoom 1 = whole board visible, which IS
// the pre-camera letterbox, exactly; CONFIG.CAMERA.MAX_ZOOM = closest-in).
// Every mapping below composes the camera except applyScreenTransform — the
// bare fit transform for screen-fixed draws (boss bars, damage flash).
// =============================================================================

// World size is PER-LEVEL since the campaign rebuild — read live from grid.js
// (worldW/worldH) on every resize, never cached at module load.
import { worldW, worldH } from '../engine/grid.js';
import { CONFIG } from '../config.js';

const MAX_DPR = 2;   // phones report 3-4; backing stores that big waste GPU/battery

export class Viewport {
  constructor(canvas, uiLayer = null, container = null) {
    this.canvas = canvas;
    this.ui = uiLayer;
    this.container = container || canvas.parentElement || null;
    this.scale = 1;          // CSS px per world px (at zoom 1 = fit-all)
    this.k = 1;              // device px per world px (backing store, at zoom 1)
    this.cssW = worldW(); this.cssH = worldH();
    this.left = 0; this.top = 0;
    this.camX = 0; this.camY = 0; this.zoom = 1;   // camera (see header)
    this.onResize = null;    // hook: close menus / reposition widgets

    this._resize = () => this.resize();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', this._resize);
      window.addEventListener('orientationchange', this._resize);
    }
    // Track the CONTAINER's box too: making the canvas absolute collapses the
    // stage after our first measure, and no window resize fires for that.
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(this.container);
    } else if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(this._resize);   // re-measure once layout settles
    }
    this.resize();
  }

  resize() {
    const vw = (this.container && this.container.clientWidth) ||
      (typeof window !== 'undefined' && window.innerWidth) || worldW();
    const vh = (this.container && this.container.clientHeight) ||
      (typeof window !== 'undefined' && window.innerHeight) || worldH();

    this.scale = Math.min(vw / worldW(), vh / worldH());
    this.cssW = Math.floor(worldW() * this.scale);
    this.cssH = Math.floor(worldH() * this.scale);
    this.left = Math.floor((vw - this.cssW) / 2);
    this.top = Math.floor((vh - this.cssH) / 2);

    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, MAX_DPR);
    this.canvas.width = Math.max(1, Math.round(this.cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(this.cssH * dpr));
    this.k = this.canvas.width / worldW();

    // Any resize (boot, level load, save load, window/orientation change)
    // resets the camera to survey mode: fit-all, centered.
    this.resetCamera();

    const cs = this.canvas.style;
    cs.position = 'absolute';
    cs.width = this.cssW + 'px';
    cs.height = this.cssH + 'px';
    cs.left = this.left + 'px';
    cs.top = this.top + 'px';

    if (this.ui) {
      const us = this.ui.style;
      us.position = 'absolute';
      us.width = this.cssW + 'px';
      us.height = this.cssH + 'px';
      us.left = this.left + 'px';
      us.top = this.top + 'px';
    }

    if (this.onResize) this.onResize();
  }

  // ---- camera (programmatic API; gesture wiring lands in U3) ----

  // Back to survey mode: whole board visible (zoom 1 shows everything, so
  // camX/camY 0 is both "fit-all" and "centered" — the letterbox centers the
  // canvas box itself).
  resetCamera() {
    this.camX = 0; this.camY = 0; this.zoom = 1;
  }

  // Pan by a world-px delta, clamped to the world bounds.
  panBy(dx, dy) {
    this.camX += dx; this.camY += dy;
    this._clampCamera();
  }

  // Multiply zoom by `factor`, keeping world point (wx, wy) stationary on
  // screen (pinch/wheel anchor). Zoom clamps to [1 = fit-all, MAX_ZOOM].
  zoomAt(factor, wx, wy) {
    const prev = this.zoom;
    this.zoom = Math.min(Math.max(prev * factor, 1), CONFIG.CAMERA.MAX_ZOOM);
    // The anchor's camera-relative offset scales by prev/zoom.
    this.camX = wx - (wx - this.camX) * (prev / this.zoom);
    this.camY = wy - (wy - this.camY) * (prev / this.zoom);
    this._clampCamera();
  }

  // Keep the visible window inside the world. At zoom 1 the window IS the
  // world, so the camera pins to 0,0.
  _clampCamera() {
    this.camX = Math.min(Math.max(this.camX, 0), worldW() - worldW() / this.zoom);
    this.camY = Math.min(Math.max(this.camY, 0), worldH() - worldH() / this.zoom);
  }

  // ---- transforms & mappings ----

  // Call at the top of every frame, before any world-space drawing.
  applyTransform(ctx) {
    const kz = this.k * this.zoom;
    ctx.setTransform(kz, 0, 0, kz, -this.camX * kz, -this.camY * kz);
  }

  // Screen-space pass (boss bars, damage flash): the fit transform WITHOUT the
  // camera, so existing world-px draw code lands screen-fixed under pan/zoom —
  // and pixel-identical to the pre-camera letterbox at zoom 1.
  applyScreenTransform(ctx) {
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
  }

  // World px -> CSS px inside the #ui layer (for anchoring DOM widgets).
  worldToUi(wx, wy) {
    const s = this.scale * this.zoom;
    return { x: (wx - this.camX) * s, y: (wy - this.camY) * s };
  }

  // Client (event) px -> world px. Uses the live canvas rect so it stays
  // correct under any CSS scaling or DPR; the rect spans worldW()/zoom world
  // px starting at the camera corner.
  clientToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.camX + (clientX - rect.left) / rect.width * (worldW() / this.zoom),
      y: this.camY + (clientY - rect.top) / rect.height * (worldH() / this.zoom),
    };
  }
}
