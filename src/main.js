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
import { createState, canBuildAt, wouldSealAt } from './game/state.js';
import { strongWeak } from './game/damage.js';
import { updateEnemies } from './game/enemy.js';
import { updateTowers } from './game/tower.js';
import { updateProjectiles, updateEffects } from './game/projectile.js';
import { createHero } from './game/hero.js';
import { onEnemyKilled, onEnemyLeaked, updateFloaters, updateParticles, payWaveClear, payEarlyStart } from './game/economy.js';
import { startWave, processSpawning, waveComplete, updateBosses, waveInfo } from './game/wave.js';
import { tryBuild, trySell, tryUpgrade, tryHeroUpgrade, tryConsumable, tryTowerBoost } from './game/shop.js';
import { getTowerStats } from './game/tower.js';
import { saveGame, hasSave, loadSnapshot, applySnapshot, getHighScore, recordHighScore } from './game/save.js';
import { render } from './ui/render.js';
import { HUD } from './ui/hud.js';
import { Tooltip } from './ui/tooltips.js';
import { loadSprites, toggleSprites } from './ui/sprites.js';
import { Viewport } from './ui/viewport.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const modal = document.getElementById('modal');
const uiLayer = document.getElementById('ui');
// Letterbox + DPR: viewport owns the canvas backing store and CSS box from
// here on; all draw code keeps working in fixed 896x576 world coordinates.
const viewport = new Viewport(canvas, uiLayer, document.getElementById('stage'));

let state = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
let prevStatus = state.status;
let prevSiege = false;
const tooltip = new Tooltip();

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

// ---------------------------------------------------------------------------
// first-run onboarding hints (persistent banner until each step is done; only
// for players who haven't cleared wave 1 before)
// ---------------------------------------------------------------------------
const TUTORIAL_KEY = 'mazecore_tutorial_done_v1';
let tutorialDone = false;
try { tutorialDone = !!localStorage.getItem(TUTORIAL_KEY); } catch { tutorialDone = true; }
let hintEl = null, lastHint = '';

function currentHint() {
  if (tutorialDone || !state.hero || state.status !== 'setup' && state.status !== 'playing') return '';
  if (state.wave === 0 && state.towers.length === 0) {
    return state.buildType
      ? 'Now tap a green cell on the map to place it. Long winding maze = more damage.'
      : 'Tap a tower in the shop (Archer is a great start), then tap the map to build.';
  }
  if (state.wave === 0 && state.towers.length > 0 && !state.waveActive) {
    return 'Build a few more, then press Start Wave. Starting early pays bonus gold!';
  }
  if (state.wave === 1 && state.waveActive) return 'Enemies follow the dotted path. Tap your hero, then a cell, to move them.';
  return '';
}

function updateHint() {
  const text = currentHint();
  if (text === lastHint) return;
  lastHint = text;
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.className = 'banner warn';
    overlay.appendChild(hintEl);
  }
  hintEl.textContent = text;
  hintEl.classList.toggle('show', !!text);
}

function finishTutorial() {
  if (tutorialDone) return;
  tutorialDone = true;
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* private mode */ }
}

// ---------------------------------------------------------------------------
// hover tooltip content (enemy under cursor > tower on cell > build preview)
// ---------------------------------------------------------------------------
function specialText(s) {
  const t = [];
  if (s.splashRadius) t.push(`splash ${s.splashRadius.toFixed(1)}`);
  if (s.slowPct) t.push(`slow ${(s.slowPct * 100) | 0}%/${s.slowDur}s`);
  if (s.dotDps) t.push(`poison ${s.dotDps.toFixed(0)}/s·${s.dotDur}s`);
  if (s.chainTargets) t.push(`chain ${s.chainTargets}`);
  if (s.multishot > 1) t.push(`${s.multishot}× shots`);
  if (s.shatter) t.push(`shatter +${(s.shatter * 100) | 0}%`);
  if (s.disrupt) t.push('dispels shields/regen');
  if (s.contagion) t.push('poison spreads on kill');
  if (s.cluster) t.push('cluster blasts');
  return t.join(' · ');
}

// "strong vs Light, Unarmored · weak vs Fortified" line for a damage type.
function matchupText(damageType) {
  const sw = strongWeak(damageType);
  const name = (id) => {
    const a = CONFIG.ARMOR_TYPES[id];
    return a ? `<span style="color:${a.color}">${a.name}</span>` : id;
  };
  const parts = [];
  if (sw.strong.length) parts.push(`<span style="color:#5fce7a">strong vs</span> ${sw.strong.map(name).join(', ')}`);
  if (sw.weak.length) parts.push(`<span style="color:#e24b4a">weak vs</span> ${sw.weak.map(name).join(', ')}`);
  return parts.join(' · ');
}

function buildTooltip(x, y, px, py) {
  // 1) enemy directly under the cursor
  let near = null, nd = Infinity;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d <= e.radius + 5 && d < nd) { nd = d; near = e; }
  }
  if (near) {
    const at = CONFIG.ARMOR_TYPES[near.armorType];
    const traits = [];
    if (near.flying) traits.push('flying');
    if (at) traits.push(`<span style="color:${at.color}">${at.name} armor</span>`);
    if (near.shieldHp > 0) traits.push(`shield ${Math.ceil(near.shieldHp)}`);
    if (near.def.healPct) traits.push('heals allies');
    if (near.slowTimer > 0) traits.push('slowed');
    if (near.poison.length) traits.push('poisoned');
    if (near.stunTimer > 0) traits.push('stunned');
    return `<b style="color:${near.color}">${near.name}</b>${near.boss ? ' ★' : ''}<br>
      HP ${Math.ceil(near.hp).toLocaleString()} / ${near.maxHp.toLocaleString()}<br>
      ${traits.length ? traits.join(' · ') + '<br>' : ''}
      <span class="muted" style="color:#9aa3b2">bounty ${near.bounty}g · ${near.damageToLives}♥ if leaked</span>`;
  }

  // 2) tower on the hovered cell
  const t = (y >= 0 && x >= 0 && state.towerGrid[y] && state.towerGrid[y][x]) || null;
  if (t) {
    const s = t.stats;
    if (t.def.aura) {
      return `<b style="color:${t.def.color}">${t.def.glyph} ${t.def.name}</b> — L${t.level}${t.branch ? ' ' + t.def.branches[t.branch].name : ''}<br>
        +${Math.round(s.auraDmg * 100)}% dmg · +${Math.round(s.auraSpeed * 100)}% atk speed · radius ${s.auraRange.toFixed(1)}<br>
        <span class="muted">buffs nearby towers · strongest aura wins · sell +${Math.floor(t.invested * CONFIG.SELL_REFUND)}g</span>`;
    }
    const dps = (s.damage * (s.multishot || 1) / s.cooldown).toFixed(1);
    const sp = specialText(s);
    const next = t.canUpgrade() ? `<br><span style="color:#f2c14b">▲ upgrade: ${t.nextUpgradeCost()}g</span>` : '<br><span class="muted">max level</span>';
    return `<b style="color:${t.def.color}">${t.def.glyph} ${t.def.name}</b> — L${t.level}${t.branch ? ' ' + t.def.branches[t.branch].name : ''}<br>
      DMG ${s.damage.toFixed(1)} · RNG ${s.range.toFixed(1)} · CD ${s.cooldown.toFixed(2)}s<br>
      ~DPS ${dps} · ${s.damageType}${s.targetsAir ? ' · hits air' : ''}<br>
      ${matchupText(s.damageType) ? matchupText(s.damageType) + '<br>' : ''}
      ${sp ? sp + '<br>' : ''}
      <span class="muted">target: ${t.targetMode} · sell +${Math.floor(t.invested * CONFIG.SELL_REFUND)}g</span>${next}`;
  }

  // 3) build preview when a tower is armed
  if (state.buildType) {
    const def = CONFIG.TOWERS[state.buildType];
    const s = getTowerStats(state.buildType, 1, null);
    const legal = (y >= 0 && x >= 0) ? canBuildAtSafe(x, y) : false;
    if (def.aura) {
      const sealsA = legal && wouldSealAtSafe(x, y);
      const verdictA = !legal
        ? '<b style="color:#e24b4a">cannot build here</b>'
        : sealsA
          ? '<b style="color:#ffa500">⚠ Seals the maze — creeps will attack your towers!</b>'
          : '<b style="color:#5fce7a">click to build</b>';
      return `<b style="color:${def.color}">${def.glyph} ${def.name}</b> — ${def.cost}g<br>
        +${Math.round(s.auraDmg * 100)}% dmg · +${Math.round(s.auraSpeed * 100)}% atk speed · radius ${s.auraRange.toFixed(1)}<br>
        <span class="muted">${def.blurb}</span><br>
        ${verdictA}`;
    }
    const dps = (s.damage / s.cooldown).toFixed(1);
    const seals = legal && wouldSealAtSafe(x, y);
    const verdict = !legal
      ? '<b style="color:#e24b4a">cannot build here</b>'
      : seals
        ? '<b style="color:#ffa500">⚠ Seals the maze — creeps will attack your towers!</b>'
        : '<b style="color:#5fce7a">click to build</b>';
    return `<b style="color:${def.color}">${def.glyph} ${def.name}</b> — ${def.cost}g<br>
      DMG ${s.damage} · RNG ${s.range} · CD ${s.cooldown}s · ~DPS ${dps}<br>
      ${s.damageType}${s.targetsAir ? ' · hits air' : ''}<br>
      ${matchupText(s.damageType) ? matchupText(s.damageType) + '<br>' : ''}
      <span class="muted">${def.blurb}</span><br>
      ${verdict}`;
  }
  return null;
}

// guard canBuildAt against exceptions during tooltip building
function canBuildAtSafe(x, y) {
  try { return canBuildAt(state, x, y); } catch { return false; }
}
function wouldSealAtSafe(x, y) {
  try { return wouldSealAt(state, x, y); } catch { return false; }
}

// ---------------------------------------------------------------------------
// high-level actions (shared by HUD buttons + keyboard + mouse)
// ---------------------------------------------------------------------------
const actions = {
  setSpeed: (n) => loop.setSpeed(n),
  togglePause: () => loop.togglePause(),
  togglePath: () => { state.showPath = !state.showPath; },
  toggleArt: () => { toggleSprites(); },
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
    state.selected = null; clearTargeting();
  },
  cancel: () => { state.buildType = null; state.selected = null; state.heroMoveMode = false; clearTargeting(); },
  heroMove: () => { if (state.hero && !state.hero.downed) state.heroMoveMode = !state.heroMoveMode; },
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
    if (state.waveActive) { showBanner('Save between waves only', 'warn', 1.4); return; }
    if (saveGame(state)) showBanner('Game saved', '', 1.4);
  },
  load: () => {
    const snap = loadSnapshot();
    if (!snap) { showBanner('No save found', 'warn', 1.4); return; }
    state = applySnapshot(snap);
    prevStatus = state.status;
    clearTargeting();
    modal.classList.add('hidden');
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
    }
  },
  restart: () => location.reload(),
};

// ---------------------------------------------------------------------------
// start screen — hero selection
// ---------------------------------------------------------------------------
function showStartModal() {
  const hs = getHighScore();
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="card">
    <h1>Mazecore <span style="color:#00d4ff">TD</span></h1>
    <p>Build a maze of towers to force 100 waves of enemies down a long, deadly
       path — but never wall them off completely. Choose your hero:</p>
    <div class="hero-pick" id="heropick"></div>
    ${hasSave() ? '<button class="primary" id="continue" style="padding:8px 22px;margin-bottom:8px">Continue saved game</button><br>' : ''}
    <p class="muted">Right-click to move your hero · Q / W cast abilities · get
       anti-air before wave 15 · P toggles the path overlay.${hs ? ` · Best: wave ${hs}` : ''}</p>
  </div>`;
  const pick = document.getElementById('heropick');
  for (const [id, def] of Object.entries(CONFIG.HEROES)) {
    const b = document.createElement('button');
    b.innerHTML = `<img src="assets/heroes/${id}.png" alt="" style="width:52px;height:52px;align-self:center" onerror="this.remove()">
      <span class="h-glyph" style="color:${def.color}">${def.glyph}</span>
      <span class="h-name">${def.name}</span>
      <span class="h-role">${def.role}</span>`;
    // if the portrait loads, hide the placeholder glyph
    const img = b.querySelector('img');
    if (img) img.addEventListener('load', () => { const g = b.querySelector('.h-glyph'); if (g) g.style.display = 'none'; });
    b.addEventListener('click', () => { createHero(state, id); modal.classList.add('hidden'); showBanner(`${def.name} ready!`, '', 1.5); });
    pick.appendChild(b);
  }
  const cont = document.getElementById('continue');
  if (cont) cont.addEventListener('click', actions.load);
}

// ---------------------------------------------------------------------------
// simulation step
// ---------------------------------------------------------------------------
function update(dt) {
  state.time += dt;
  if (state.status === 'won' || state.status === 'lost') {
    updateFloaters(state, dt); updateEffects(state, dt); updateParticles(state, dt);
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
  updateParticles(state, dt);

  if (waveComplete(state)) {
    state.waveActive = false;
    if (state.wave >= 1) finishTutorial();
    const pay = payWaveClear(state, state.wave);
    showBanner(`Wave ${state.wave} cleared!  +${pay.bonus}g${pay.interest ? ` (+${pay.interest} interest)` : ''}`, '', 2);
    state.buildTimer = CONFIG.BUILD_TIMER;
    if (state.wave >= CONFIG.WIN_WAVE) state.status = 'won';
    else if (waveInfo(state.wave + 1).hasFlying) showBanner('⚠ Flying next wave — get anti-air!', 'warn', 2.5);
  }
  if (state.lives <= 0) state.status = 'lost';

  // siege alert: fires once each time the maze flips from open to sealed
  if (state.siege && !prevSiege) showBanner("⚠ Path sealed — they're attacking your walls!", 'danger', 2.5);
  prevSiege = state.siege;

  if (state.status !== prevStatus && (state.status === 'won' || state.status === 'lost')) showEndModal();
  prevStatus = state.status;
}

function showEndModal() {
  const won = state.status === 'won';
  recordHighScore(state.maxWave);
  const hs = getHighScore();
  modal.classList.remove('hidden');
  modal.innerHTML = `<div class="card">
    <h1 style="color:${won ? '#5fce7a' : '#e24b4a'}">${won ? 'VICTORY!' : 'DEFEAT'}</h1>
    <p>${won ? 'You cleared all 100 waves. The maze held.' : `Your lives ran out on wave ${state.wave}.`}</p>
    <p class="muted">Reached wave <b>${state.maxWave}</b> · Hero L<b>${state.hero ? state.hero.level : 1}</b> · Best ever: wave <b>${hs}</b></p>
    <button class="primary" id="again" style="margin-top:14px;padding:10px 24px">Play again</button>
  </div>`;
  document.getElementById('again').addEventListener('click', actions.restart);
}

// ---------------------------------------------------------------------------
// render step
// ---------------------------------------------------------------------------
function draw() {
  viewport.applyTransform(ctx);     // world px -> device px (letterbox + DPR)
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  render(ctx, state);
  hud.refresh(state, { speed: loop.gameSpeed, paused: loop.paused });
  updateHint();
}

const loop = new GameLoop(update, draw);
const hud = new HUD(document.getElementById('hud'), actions);
loop.start();
showStartModal();
loadSprites();   // async; art pops in when ready, shapes are the fallback

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
setupInput(canvas, {
  onHover(x, y, px, py) { state.hover = { x, y }; tooltip.set(buildTooltip(x, y, px, py)); },
  onHoverEnd() { state.hover = null; tooltip.set(null); },
  onLeftClick(x, y, px, py) {
    if (state.targetingAbility && state.hero) {
      state.hero.cast(state, state.targetingAbilityIndex, { x, y });
      clearTargeting();
      return;
    }
    if (state.targetingConsumable) {
      tryConsumable(state, state.targetingConsumableKey, { x, y });
      clearTargeting();
      return;
    }
    // touch flow: hero-move mode armed -> this tap is the destination
    if (state.heroMoveMode && state.hero && !state.hero.downed) {
      state.hero.commandMove(state, x, y);
      state.heroMoveMode = false;
      return;
    }
    if (state.buildType) {
      tryBuild(state, state.buildType, x, y);
      state.selected = null;
      return;
    }
    // tapping the hero arms move mode (mobile has no right-click)
    const h = state.hero;
    if (h && !h.downed && Math.hypot(px - h.x, py - h.y) <= 20) {
      state.heroMoveMode = true;
      state.selected = null;
      return;
    }
    const t = (y >= 0 && x >= 0 && state.towerGrid[y] && state.towerGrid[y][x]) || null;
    state.selected = t;
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
      case 'm': case 'M': actions.heroMove(); return true;
      case 'Escape': actions.cancel(); return true;
    }
    return false;
  },
});

window.MAZECORE = { get state() { return state; }, loop, CONFIG, actions };
console.log('[main] Mazecore TD ready — pick a hero and build your maze.');
