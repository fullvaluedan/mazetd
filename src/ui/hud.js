// =============================================================================
// hud.js — orchestrator for all game chrome. The old 320px side panel is gone;
// everything lives over the canvas now:
//   topbar.js   gold/lives/wave chips, speed, pause, store, settings gear
//   wavebar.js  NEXT WAVE button + incoming-wave chevrons at the spawns
//   radial.js   tap-a-cell build ring / tap-a-tower manage ring
//   herobar.js  hero portrait + abilities dock
//   sheets.js   settings + store modal sheets
//   infocard.js docked inspect card (replaces the cursor tooltip)
//
// HUD(root, actions, scene) keeps its constructor/refresh signature for the
// DOM-shim smoke tests; root is unused (kept for compatibility) and scene
// ({uiLayer, viewport}) mounts the real widgets.
// =============================================================================

import { TopBar } from './topbar.js';
import { WaveBar } from './wavebar.js';
import { Radial, buildRingItems, towerRingItems } from './radial.js';
import { HeroBar } from './herobar.js';
import { Sheets } from './sheets.js';
import { InfoCard } from './infocard.js';

export class HUD {
  constructor(root, actions, scene = null) {
    this.root = root;          // unused (legacy panel mount) — kept for tests
    this.actions = actions;
    this.topbar = null;
    this.wavebar = null;
    this.radial = null;
    this.herobar = null;
    this.infocard = null;
    this.sheets = new Sheets(actions);
    if (scene && scene.uiLayer) {
      this.topbar = new TopBar(scene.uiLayer, actions);
      this.wavebar = new WaveBar(scene.uiLayer, scene.viewport, actions);
      this.radial = new Radial(scene.uiLayer, scene.viewport);
      this.herobar = new HeroBar(scene.uiLayer, actions);
      this.infocard = new InfoCard(scene.uiLayer);
    }
  }

  // kept for API compatibility with older callers/tests
  build() { }

  // Called when the viewport letterbox changes: re-anchor world-pinned widgets.
  onViewportResize() {
    if (this.wavebar) this.wavebar.position();
    if (this.radial) this.radial.close();   // anchors are stale after a resize
  }

  // ---- radial menus (the KR build/upgrade interaction) ----
  get radialOpen() { return !!(this.radial && this.radial.isOpen); }

  openBuildRing(state, x, y) {
    if (!this.radial) return;
    const items = buildRingItems(state, { x, y }, this.actions);   // computes seal warn once
    this.radial.open({ x, y }, items, 'build',
      () => { state.menuCell = null; state.pendingBuild = null; state.menuSeals = false; });
    state.menuCell = { x, y };
    state.menuSeals = items.length > 0 && !!items[0].warn;
    state.pendingBuild = null;
    this.radial.refresh(state);
  }

  openTowerRing(state, tower) {
    if (!this.radial) return;
    this.radial.open({ x: tower.cx, y: tower.cy }, towerRingItems(state, tower, this.actions), 'tower',
      () => { if (state.selected === tower) state.selected = null; });
    state.menuCell = null;
    state.selected = tower;    // (re)select after open — open() closes any prior ring
    this.radial.refresh(state);
  }

  closeRadial() { if (this.radial) this.radial.close(); }

  // ---- per-frame ----
  refresh(state, ui) {
    if (this.topbar) this.topbar.refresh(state, ui);
    if (this.wavebar) this.wavebar.refresh(state);
    if (this.herobar) this.herobar.refresh(state);
    if (this.radial) this.radial.refresh(state);     // live affordability in open rings
    if (this.sheets.isOpen) this.sheets.refresh(state);
  }
}
