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
import { startWave, processSpawning, waveComplete, updateBosses, waveInfoFor, winWave } from './game/wave.js';
import { getLevel } from './game/levels.js';
import { setGridSize } from './engine/grid.js';
import { tryBuild, trySell, tryUpgrade, tryHeroUpgrade, tryConsumable, tryTowerBoost, batchBuild, batchSell, batchUpgrade } from './game/shop.js';
import {
  saveGame, hasSave, loadSnapshot, applySnapshot, getHighScore, recordHighScore,
  saveCampaign, hasCampaignSave, loadCampaignSnapshot, clearCampaignSave,
} from './game/save.js';
import { render, renderScreen } from './ui/render.js';
import { HUD } from './ui/hud.js';
import { loadSprites, toggleSprites } from './ui/sprites.js';
import { Viewport } from './ui/viewport.js';
import { createHints } from './ui/hints.js';
import { hoverCardHtml, enemyCardHtml, enemyAt } from './ui/infocard.js';
import { Screens } from './ui/screens.js';
import * as sfx from './services/sfx.js';
import * as ads from './services/ads.js';
import * as profile from './services/profile.js';
import { starsFor } from './ui/screens.js';
import { addGold } from './game/economy.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const modal = document.getElementById('modal');
const uiLayer = document.getElementById('ui');
// Letterbox + DPR: viewport owns the canvas backing store and CSS box from
// here on; all draw code keeps working in fixed 896x576 world coordinates.
const viewport = new Viewport(canvas, uiLayer, document.getElementById('stage'));

// Campaign level boot (until the level-select screen lands): ?level=l1 .. l20
// or ?level=endless. Without the param you get the classic 28x18 board.
const bootLevel = (() => {
  try {
    const id = new URLSearchParams(location.search).get('level');
    return id ? getLevel(id) : null;
  } catch { return null; }
})();
if (bootLevel) {
  setGridSize(bootLevel.cols, bootLevel.rows);
  viewport.resize();   // the viewport was built against the default world size
}

let state = createState(makeRng(CONFIG.SEED), CONFIG.SEED, bootLevel);
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
  toggleSfx: () => sfx.toggleMuted(),
  sfxMuted: () => sfx.isMuted(),
  // ---- rewarded ads (grants live ONLY here in the UI layer) ----
  adInfo: () => {
    const ready = ads.isReady('FREE_GOLD', state);
    return {
      ready,
      label: ready ? `📺 +${ads.grantAmount('FREE_GOLD', state)}g` : `📺 ${ads.cooldownText('FREE_GOLD', state)}`,
    };
  },
  freeGold: async () => {
    if (!ads.isReady('FREE_GOLD', state)) return;
    const wasPaused = loop.paused;
    loop.setPaused(true);
    const { granted } = await ads.show('FREE_GOLD', state);
    loop.setPaused(wasPaused);
    if (granted) {
      const amt = ads.grantAmount('FREE_GOLD', state);
      addGold(state, amt);
      showBanner(`+${amt} gold!`, 'warn', 1.8);
      sfx.play('reward');
    }
  },
  reviveAd: async () => {
    if (state.status !== 'lost' || !ads.isReady('REVIVE', state)) return;
    const { granted } = await ads.show('REVIVE', state);
    if (granted) {
      state.reviveUsed = true;
      state.lives = CONFIG.ADS.REVIVE.lives;
      state.status = 'playing';
      prevStatus = 'playing';
      state.flash = 0;
      screens.hide();
      showBanner(`Revived with ${CONFIG.ADS.REVIVE.lives} ♥ — hold the line!`, 'warn', 2.5);
      sfx.play('reward');
    }
  },
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
    // (the !state.hero check was a hero-era "fully booted" proxy)
    if ((CONFIG.HEROES_ENABLED && !state.hero) || state.waveActive || state.status === 'won' || state.status === 'lost') return;
    const bonus = payEarlyStart(state, state.buildTimer);
    state.buildTimer = 0;
    startWave(state, state.wave + 1);
    const info = waveInfoFor(state, state.wave);
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
    if (tryBuild(state, typeId, x, y)) { sfx.play('build'); hud.closeRadial(); }   // one-shot: build closes the ring
  },
  upgradeTower: (tower, branch) => {
    if (tryUpgrade(state, tower, branch)) { sfx.play('upgrade'); hud.openTowerRing(state, tower); }  // rebuilt with new level/prices
  },
  sellTower: (tower) => { hud.closeRadial(); trySell(state, tower); sfx.play('sell'); },
  cycleTargetAndRefresh: (tower) => { tower.cycleTargetMode(); hud.openTowerRing(state, tower); },
  // ---- marquee multi-select (U21): mode toggle + batch build/sell ----
  // The authoritative mode flag lives in the input layer (it routes gestures);
  // hud.multiselect mirrors it for the toggle button + chooser card.
  setSelectMode: (on) => {
    input.setSelectMode(on);
    hud.closeRadial();                       // ring and marquee never coexist
    if (hud.multiselect) hud.multiselect.setActive(on);
    if (!on) state.marquee = null;
  },
  toggleSelectMode: () => actions.setSelectMode(!input.isSelectMode()),
  batchBuild: (typeId, cells) => {
    const r = batchBuild(state, typeId, cells);   // one 'build' sfx event per batch
    if (r.of > 0) {
      showBanner(r.built < r.of ? `Built ${r.built}/${r.of} — out of gold` : `Built ${r.built}/${r.of}`,
        r.built < r.of ? 'warn' : '', 1.8);
    }
  },
  batchSell: (cells) => {
    const r = batchSell(state, cells);            // one 'sell' sfx event per batch
    if (r.sold > 0) showBanner(`Sold ${r.sold} — +${r.refund}g refund`, '', 1.8);
  },
  batchUpgrade: (cells) => {
    const r = batchUpgrade(state, cells);         // cheapest-first, one 'build' sfx
    if (r.upgraded > 0) {
      const tail = r.upgraded < r.of ? ` (${r.of - r.upgraded} unaffordable)` : '';
      showBanner(`Upgraded ${r.upgraded}${tail} — ${r.spent}g`, r.upgraded < r.of ? 'warn' : '', 1.8);
    } else showBanner('No towers to upgrade there', 'warn', 1.4);
  },
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
    if (state.level && !state.level.endless) { showBanner('Saving is for Endless runs (campaign levels are short)', 'warn', 1.8); return; }
    if (state.waveActive) { showBanner('Save between waves only', 'warn', 1.4); return; }
    if (saveGame(state)) showBanner('Game saved', '', 1.4);
  },
  load: () => {
    if (state.level && !state.level.endless) { showBanner('Loading is for Endless runs', 'warn', 1.6); return; }
    const snap = loadSnapshot();
    if (!snap) { showBanner('No save found', 'warn', 1.4); return; }
    state = applySnapshot(snap);
    viewport.resize();   // the load may have changed the grid size (Endless 13x24); re-letterbox + camera reset
    prevStatus = state.status;
    clearTargeting();
    screens.hide();
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
      sfx.play('cast');
    }
  },
  restart: () => location.reload(),
};

// (start/hero-select/victory/defeat screens live in ui/screens.js)

// ---------------------------------------------------------------------------
// simulation step
// ---------------------------------------------------------------------------
function update(dt) {
  state.time += dt;
  if (state.status === 'won' || state.status === 'lost') {
    updateFloaters(state, dt); updateEffects(state, dt); updateParticles(state, dt);
    return;
  }

  if (!state.waveActive && state.buildTimer > 0 && (state.hero || !CONFIG.HEROES_ENABLED)) {
    state.buildTimer = Math.max(0, state.buildTimer - dt);
    // Auto-chain waves — but NOT the first: wave 1 waits for a manual NEXT WAVE
    // tap (state.wave is 0 until the player launches it). (user 2026-07-07)
    if (state.buildTimer <= 0 && state.autoStart && state.wave >= 1) actions.startWave();
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
    if (state.wave >= winWave(state)) state.status = 'won';
    else if (waveInfoFor(state, state.wave + 1).hasFlying) showBanner('⚠ Flying next wave — get anti-air!', 'warn', 2.5);
    // U14: auto-save campaign progress at every wave-clear (the safe
    // between-waves point — no live enemies/projectiles to serialize). A
    // player killed by the OS mid-run resumes at the last wave cleared.
    if (state.level && !state.level.endless && state.status !== 'won') saveCampaign(state);
  }
  if (state.lives <= 0) state.status = 'lost';

  // siege alert: fires once each time the maze flips from open to sealed
  if (state.siege && !prevSiege) { showBanner("⚠ Path sealed — they're attacking your walls!", 'danger', 2.5); sfx.play('alarm'); }
  prevSiege = state.siege;

  if (state.status !== prevStatus && (state.status === 'won' || state.status === 'lost')) {
    sfx.play(state.status === 'won' ? 'win' : 'lose');
    showEndModal();
  }
  prevStatus = state.status;
}

function showEndModal() {
  recordHighScore(state.maxWave);
  // campaign: bank stars + the hero's earned progression
  if (state.level && !state.level.endless && state.status === 'won') {
    profile.recordStars(state.level.id, starsFor(state));
  }
  // U14: victory or defeat both end the run — never offer resume into a
  // finished level.
  if (state.level && !state.level.endless) clearCampaignSave(state.level.id);
  profile.recordHeroProgress(state.hero);
  screens.showEnd(state);
}

// ---------------------------------------------------------------------------
// render step
// ---------------------------------------------------------------------------
// sim event queue -> sounds (the sim never imports sfx; it only pushes data)
const SHOT_SOUND = { pierce: 'shot_pierce', siege: 'shot_siege', magic: 'shot_magic', poison: 'shot_poison', chaos: 'shot_magic' };
function drainEvents() {
  if (!state.events || state.events.length === 0) return;
  for (const ev of state.events) {
    sfx.play(ev.t === 'shot' ? (SHOT_SOUND[ev.d] || 'shot_magic') : ev.t);
  }
  state.events.length = 0;
}

function draw() {
  // Clear in DEVICE px: under the camera the world no longer fills the canvas
  // 1:1, so a world-rect clear could leave stale pixels behind.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  viewport.applyTransform(ctx);     // world px -> device px (letterbox + DPR + camera)
  render(ctx, state, viewport);     // viewport: U4 view culling + static-layer blit
  viewport.applyScreenTransform(ctx);   // camera off: screen-fixed chrome
  renderScreen(ctx, state);             // boss bars + damage flash
  drainEvents();
  hud.refresh(state, { speed: loop.gameSpeed, paused: loop.paused });
  hints.update(state);
}

const loop = new GameLoop(update, draw);
const hud = new HUD(null, actions, { uiLayer, viewport });
const hints = createHints(overlay, hud);
const screens = new Screens(modal, {
  pickHero: (id) => {
    profile.setHeroId(id);
    if (bootLevel) {
      const h = createHero(state, id);
      profile.applyHeroProfile(h);
      showBanner(`${CONFIG.HEROES[id].name} L${h.level} ready!`, '', 1.5);
    } else {
      screens.showMap();             // title flow continues to the campaign map
    }
  },
  continueRun: () => actions.load(),
  // U14: resume a campaign snapshot in place (no reload — applySnapshot swaps
  // `state` directly, same as the Endless continueRun path above).
  resumeCampaign: () => {
    const snap = loadCampaignSnapshot(bootLevel.id);
    if (!snap) { enterLevel(); return; }   // snapshot vanished between prompt and click; boot fresh
    state = applySnapshot(snap);
    viewport.resize();
    prevStatus = state.status;
    clearTargeting();
    showBanner(`${bootLevel.name} — resumed at wave ${state.wave}`, '', 2.2);
  },
  restartCampaign: () => { clearCampaignSave(bootLevel.id); enterLevel(); },
  openSettings: () => actions.openSettings(),
  restart: () => actions.restart(),
  hasSave: () => hasSave(),
  highScore: () => getHighScore(),
  revive: () => actions.reviveAd(),
  canRevive: () => ads.isReady('REVIVE', state),
});
viewport.onResize = () => hud.onViewportResize();
viewport.onCameraChange = () => hud.onCameraChange();
loop.start();

// Audio unlock must happen inside the FIRST user gesture (iOS requirement).
['pointerdown', 'keydown', 'touchstart'].forEach((evt) =>
  window.addEventListener(evt, () => sfx.initAudio(), { once: true, passive: true }));

// U14: the OS can kill a backgrounded mobile WebView at any moment, so back
// up campaign progress the instant the page is hidden — but only between
// waves (the same invariant as the wave-clear autosave: never serialize live
// enemies/projectiles). Mid-wave backgrounding just keeps the last
// wave-clear snapshot; that's the accepted wave-boundary granularity.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (state.level && !state.level.endless && !state.waveActive
      && state.status !== 'won' && state.status !== 'lost') {
      saveCampaign(state);
    }
  });
}

// The campaign is a VERTICAL game now: landscape phones get the rotate
// prompt and the sim holds while it's up. Desktop windows just letterbox.
(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const portrait = window.matchMedia('(orientation: portrait)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const el = document.getElementById('rotate');
  if (!el) return;
  let pausedByRotate = false;
  const apply = () => {
    const show = !portrait.matches && coarse.matches;
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
  window.__mz = { get state() { return state; }, hud, loop, actions, viewport, screens };
}
// Boot: with ?level= go straight into the level (hero from the profile,
// first-run picks one in place); without it, the title/menu shell. Factored
// so the U14 resume prompt's "Restart" choice can re-run the exact same
// fresh-start flow.
function enterLevel() {
  const heroId = CONFIG.HEROES_ENABLED ? profile.getProfile().hero.id : null;
  if (heroId) {
    const h = createHero(state, heroId);
    profile.applyHeroProfile(h);
    showBanner(`${bootLevel.name} — ${CONFIG.HEROES[heroId].name} L${h.level} ready!`, '', 2.2);
  } else if (CONFIG.HEROES_ENABLED) {
    screens.showHeroSelect();
  } else {
    showBanner(`${bootLevel.name} — build your maze!`, '', 2.2);
  }
}
if (bootLevel) {
  // U14: a campaign level (never Endless — that keeps its title-screen
  // CONTINUE flow) with a snapshot on file offers Resume/Restart before
  // anything else boots.
  if (!bootLevel.endless && hasCampaignSave(bootLevel.id)) {
    const snap = loadCampaignSnapshot(bootLevel.id);
    if (snap) screens.showResumePrompt(bootLevel, snap.wave);
    else enterLevel();
  } else {
    enterLevel();
  }
} else {
  screens.showTitle();
}
loadSprites().then(() => screens.refreshArt());   // art pops in when ready; shapes are the fallback

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
const input = setupInput(canvas, {
  onHover(x, y, px, py) { state.hover = { x, y }; if (hud.infocard) hud.infocard.showHover(hoverCardHtml(state, x, y, px, py)); },
  onHoverEnd() { state.hover = null; if (hud.infocard) hud.infocard.clearHover(); },
  // ---- marquee multi-select (U21) ----
  onSelectTap() { actions.setSelectMode(false); },   // plain tap exits select mode
  onMarquee(rect) { state.marquee = rect; },         // live world-space overlay
  onMarqueeEnd(rect) {
    if (rect && hud.multiselect) hud.multiselect.openChooser(state, rect);
    else state.marquee = null;                       // cancelled (pinch / toggle-off)
  },
  onLeftClick(x, y, px, py) {
    if (state.targetingAbility && state.hero) {
      state.hero.cast(state, state.targetingAbilityIndex, { x, y });
      sfx.play('cast');
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
}, viewport);

window.MAZECORE = { get state() { return state; }, loop, CONFIG, actions };
console.log('[main] Mazecore TD ready — pick a hero and build your maze.');
