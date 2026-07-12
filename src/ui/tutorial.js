// =============================================================================
// tutorial.js, U5: skippable scripted tutorial for the first Level 1 run.
//
// Step 0 is a modal intro card, mounted like a screens.js surface straight
// into #modal (lockSurface, focus trap, dataset.uiState = 'tutorial') and
// pausing the game the same way a sheet does. Steps 1-4 are small non-modal
// overlay chips over the live board: the maze stays fully interactive, and
// off-script play never breaks the machine, a step only advances on its own
// matching action (or the explicit Next/Done button on the final step).
//
// Headless-safe throughout, matching hints.js's own pattern: any missing DOM
// or storage failure is treated as "already done" so the module can be
// imported and driven directly in a Node test with no document at all.
//
// Deliberately built as one small, directly-testable machine (see
// createTutorial's deps) rather than split logic/DOM layers: the exported
// object is the whole thing, constructible with fake storage/DOM/hooks.
// =============================================================================

import { div, lockSurface } from './components.js';

export const FLAG_KEY = 'mazecore_tutorial_l1_done_v1';

// index 0 is unused (step 0 is the modal intro, handled separately below).
const CHIP_STEPS = [
  null,
  { text: 'Build walls to shape the path.' },
  { text: 'Place a tower on a 2x2 space.' },
  { text: 'Start the wave.' },
  { text: 'Upgrade a tower to grow its power.', final: true },
];

function readFlag(storage) {
  try { return !!(storage && storage.getItem(FLAG_KEY)); } catch { return true; }
}
function writeFlag(storage) {
  try { if (storage) storage.setItem(FLAG_KEY, '1'); } catch { /* private mode / storage disabled */ }
}

function countWalls(state) { return (state.towers || []).filter((t) => t && t.def && t.def.wall).length; }
function countTowers(state) { return (state.towers || []).filter((t) => t && t.def && !t.def.wall).length; }
function maxLevel(state) { return (state.towers || []).reduce((m, t) => Math.max(m, (t && t.level) || 1), 1); }

// deps: { storage, hasSave, onPause, getModalRoot }, all optional, all
// headless-safe. `storage` defaults to localStorage when present; `hasSave`
// defaults to "no save"; `onPause` defaults to a no-op; `getModalRoot`
// defaults to document.getElementById('modal').
export function createTutorial(deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage
    : (typeof localStorage !== 'undefined' ? localStorage : null);
  const hasSave = deps.hasSave || (() => false);
  const onPause = deps.onPause || (() => {});
  const getModalRoot = deps.getModalRoot
    || (() => (typeof document !== 'undefined' ? document.getElementById('modal') : null));

  let active = false;
  let step = 0;              // 0 = intro, 1-4 = chips
  let step4Satisfied = false;
  let baseline = { walls: 0, towers: 0, level: 1 };
  let modalEl = null, modalUnlock = null, chipEl = null;

  function snapshot(state) {
    baseline = { walls: countWalls(state), towers: countTowers(state), level: maxLevel(state) };
  }

  function maybeStart(state) {
    if (active) return false;
    if (readFlag(storage)) return false;
    if (hasSave()) return false;                              // resume prompt wins
    if (!state || !state.level || state.level.id !== 'l1') return false;
    let root = null;
    try { root = getModalRoot(); } catch { root = null; }
    if (!root) return false;                                  // headless-safe: never activate without DOM
    active = true;
    step = 0;
    step4Satisfied = false;
    snapshot(state);
    try { renderIntro(root); } catch { /* swallow DOM failures mid-mount, stay inert */ }
    return true;
  }

  function renderIntro(root) {
    const s = div('tutorial-intro', `
      <div class="tutorial-title">WELCOME TO MAZECORE</div>
      <div class="tutorial-line">Wall the path and build your towers.</div>
      <div class="tutorial-line">Protect the crystal from the horde.</div>`);
    const row = div('tutorial-intro-buttons');
    const startBtn = document.createElement('button');
    startBtn.className = 'ui-btn tutorial-start';
    startBtn.textContent = 'START';
    startBtn.setAttribute('aria-label', 'Start tutorial');
    startBtn.addEventListener('click', beginChips);
    const skipBtn = document.createElement('button');
    skipBtn.className = 'tutorial-skip-link';
    skipBtn.textContent = 'SKIP';
    skipBtn.setAttribute('aria-label', 'Skip tutorial');
    skipBtn.addEventListener('click', skip);
    row.append(startBtn, skipBtn);
    s.appendChild(row);
    root.dataset.uiState = 'tutorial';
    root.innerHTML = '';
    root.appendChild(s);
    root.classList.remove('hidden');
    modalEl = root;
    modalUnlock = lockSurface(root);
    onPause(true);
  }

  function beginChips() {
    if (!active || step !== 0) return;   // only a valid transition out of the intro
    teardownModal();
    onPause(false);
    step = 1;
    mountChipContainer();
  }

  function mountChipContainer() {
    const c = div('tutorial-chip');
    c.setAttribute('aria-live', 'polite');
    try { document.body.appendChild(c); } catch { chipEl = null; return; }
    chipEl = c;
    renderStepContent();
  }

  function renderStepContent() {
    if (!chipEl) return;
    const def = CHIP_STEPS[step];
    if (!def) return;
    const showDone = !!(def.final && step4Satisfied);
    chipEl.innerHTML = '';
    const text = div('tutorial-chip-text');
    text.textContent = showDone ? 'Tutorial complete!' : def.text;
    chipEl.appendChild(text);
    const row = div('tutorial-chip-actions');
    if (def.final) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'ui-btn tutorial-next';
      nextBtn.textContent = showDone ? 'DONE' : 'NEXT';
      nextBtn.setAttribute('aria-label', showDone ? 'Finish tutorial' : 'Next tutorial step');
      nextBtn.addEventListener('click', next);
      row.appendChild(nextBtn);
    }
    const skipBtn = document.createElement('button');
    skipBtn.className = 'tutorial-skip-link';
    skipBtn.textContent = 'SKIP TUTORIAL';
    skipBtn.setAttribute('aria-label', 'Skip tutorial');
    skipBtn.addEventListener('click', skip);
    row.appendChild(skipBtn);
    chipEl.appendChild(row);
  }

  function advanceTo(n) {
    step = n;
    renderStepContent();
  }

  // ---- per-frame poll (the existing per-frame refresh path owns the call) --
  function refresh(state) {
    if (!active || !state) return;
    // Interruption: the level ended, force-end before anything else reacts.
    if (state.status === 'won' || state.status === 'lost') { forceEnd(); return; }
    if (step === 0) return;                                    // paused; nothing to poll
    if (step === 1) { if (countWalls(state) > baseline.walls) advanceTo(2); return; }
    if (step === 2) { if (countTowers(state) > baseline.towers) advanceTo(3); return; }
    if (step === 3) { if (state.waveActive) advanceTo(4); return; }
    if (step === 4 && !step4Satisfied && maxLevel(state) > baseline.level) {
      step4Satisfied = true;
      writeFlag(storage);        // completing step 4 sets the flag right away
      renderStepContent();       // ...and flips the chip to its DONE face
    }
  }

  function teardownModal() {
    if (modalUnlock) { try { modalUnlock(); } catch { /* already unbound */ } modalUnlock = null; }
    if (modalEl) {
      try { delete modalEl.dataset.uiState; modalEl.classList.add('hidden'); modalEl.innerHTML = ''; }
      catch { /* headless-safe */ }
      modalEl = null;
    }
  }
  function teardownChip() {
    if (chipEl) { try { chipEl.remove(); } catch { /* headless-safe */ } chipEl = null; }
  }
  function teardownAll() {
    teardownModal();
    teardownChip();
    try { onPause(false); } catch { /* headless-safe */ }
    active = false;
  }

  function complete() { writeFlag(storage); teardownAll(); }
  function skip() { if (!active) return; complete(); }
  function next() { if (!active || step !== 4) return; complete(); }
  function forceEnd() { if (!active) return; complete(); }

  return {
    maybeStart,
    begin: beginChips,   // simulates tapping START on the intro card (also the real button's handler)
    refresh,
    skip,
    next,
    get active() { return active; },
    get step() { return step; },
  };
}
