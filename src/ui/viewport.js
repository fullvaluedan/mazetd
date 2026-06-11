// =============================================================================
// viewport.js — letterboxes the fixed 896x576 world into whatever box the
// stage offers, at devicePixelRatio sharpness.
//
// World coordinates NEVER change: every draw call still works in 896x576. Only
// the canvas backing store (cssSize x dpr) and its CSS box are dynamic; one
// setTransform at the top of each frame maps world -> device pixels. The #ui
// overlay div is kept to the exact same CSS box as the canvas, so DOM widgets
// can anchor to world objects through worldToUi().
// =============================================================================

// World size is PER-LEVEL since the campaign rebuild — read live from grid.js
// (worldW/worldH) on every resize, never cached at module load.
import { worldW, worldH } from '../engine/grid.js';

const MAX_DPR = 2;   // phones report 3-4; backing stores that big waste GPU/battery

export class Viewport {
  constructor(canvas, uiLayer = null, container = null) {
    this.canvas = canvas;
    this.ui = uiLayer;
    this.container = container || canvas.parentElement || null;
    this.scale = 1;          // CSS px per world px
    this.k = 1;              // device px per world px (backing store)
    this.cssW = worldW(); this.cssH = worldH();
    this.left = 0; this.top = 0;
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

  // Call at the top of every frame, before any world-space drawing.
  applyTransform(ctx) {
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
  }

  // World px -> CSS px inside the #ui layer (for anchoring DOM widgets).
  worldToUi(wx, wy) {
    return { x: wx * this.scale, y: wy * this.scale };
  }

  // Client (event) px -> world px. Uses the live canvas rect so it stays
  // correct under any CSS scaling or DPR.
  clientToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * worldW(),
      y: (clientY - rect.top) / rect.height * worldH(),
    };
  }
}
