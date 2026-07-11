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
import { MultiSelect } from './multiselect.js';

export class HUD {
  constructor(root, actions, scene = null) {
    this.root = root;          // unused (legacy panel mount) — kept for tests
    this.actions = actions;
    this.topbar = null;
    this.wavebar = null;
    this.radial = null;
    this.herobar = null;
    this.infocard = null;
    this.multiselect = null;
    this.sheets = new Sheets(actions);
    if (scene && scene.uiLayer) {
      const statusDeck = scene.statusDeck || scene.uiLayer;
      const commandActions = scene.commandActions || scene.uiLayer;
      const contextPanel = scene.contextPanel || commandActions;
      this.topbar = new TopBar(statusDeck, actions);
      this.wavebar = new WaveBar(scene.uiLayer, scene.viewport, actions, commandActions);
      this.radial = new Radial(scene.uiLayer, scene.viewport);
      this.herobar = new HeroBar(commandActions, actions);
      this.infocard = new InfoCard(contextPanel);
      this.multiselect = new MultiSelect(scene.uiLayer, actions, commandActions);
    }
  }

  // kept for API compatibility with older callers/tests
  build() { }

  // Called when the viewport letterbox changes: re-anchor world-pinned widgets.
  onViewportResize() {
    if (this.wavebar) this.wavebar.position();
    if (this.radial) this.radial.close();   // anchors are stale after a resize
    if (this.multiselect) this.multiselect.closeCard();   // same close-on-stale rule
  }

  // Called when the camera pans/zooms: same stale-anchor rules — chevrons
  // track the world, an open ring would point at the wrong cell.
  onCameraChange() { this.onViewportResize(); }

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
    const items = towerRingItems(state, tower, this.actions);
    const totalSlots = Math.max(1, ...items.map((it) => (it.slot != null ? it.slot : 0))) + 1;
    this.radial.open({ x: tower.cx, y: tower.cy }, items, 'tower',
      () => { if (state.selected === tower) state.selected = null; }, { totalSlots });
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
    if (this.multiselect) this.multiselect.refresh(state);   // ...and in the batch card
    if (this.sheets.isOpen) this.sheets.refresh(state);
  }
}
