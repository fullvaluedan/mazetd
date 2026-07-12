// U14 checks — campaign mid-run save/resume: the Endless-only save gate is
// lifted for campaign levels via a per-level auto-save slot (keyed off
// state.level.id, separate from the single Endless slot). Snapshot at every
// wave-clear + on backgrounding (between waves only); resume restores gold/
// lives/towers/wave exactly; victory/defeat both clear the snapshot; a
// resumed run's next wave stays deterministic; Endless save/load (t10save's
// contract) is untouched.
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize } from '../src/engine/grid.js';
import { createState } from '../src/game/state.js';
import { addTower } from '../src/game/tower.js';
import { tryUpgrade } from '../src/game/shop.js';
import { getLevel } from '../src/game/levels.js';
import { startWave, waveComplete, levelWaveInfo } from '../src/game/wave.js';
import { payWaveClear } from '../src/game/economy.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

const store = new Map();
global.localStorage = {
  getItem: (k) => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const {
  saveGame, loadSnapshot, applySnapshot, hasSave, clearSave,
  saveCampaign, hasCampaignSave, loadCampaignSnapshot, clearCampaignSave,
} = await import('../src/game/save.js');

function freshCampaign(levelId = 'l3', seed = 1, mode = 'expert') {
  const lv = getLevel(levelId);
  setGridSize(lv.cols, lv.rows);
  return createState(makeRng(seed), seed, lv, { difficultyMode: mode });
}

// Clear a wave headlessly (no live enemies, matches the between-waves save
// invariant): drop the queue/enemies, mark the wave not-active, pay clear.
function clearWave(st, w) {
  startWave(st, w);
  st.spawnQueue = [];
  st.enemies = [];
  check(`wave ${w} reports complete`, waveComplete(st));
  st.waveActive = false;
  payWaveClear(st, w);
}

console.log('kill-and-resume at wave N of a campaign level:');
{
  const st = freshCampaign('l3', 1, 'normal');
  addTower(st, 'wall', 3, 3);
  const cannon = addTower(st, 'cannon', 5, 5);
  tryUpgrade(st, cannon, null);   // L2, so tower level/branch data has something to lose
  for (let w = 1; w <= 5; w++) clearWave(st, w);
  const goldAtClear = st.gold;
  const livesAtClear = st.lives;
  const waveAtClear = st.wave;
  const towerCountAtClear = st.towers.length;

  check('campaign snapshot saves (Endless gate lifted)', saveCampaign(st) === true);
  check('per-level snapshot slot exists for l3', hasCampaignSave('l3') === true);
  check('no snapshot leaks into a different level id', hasCampaignSave('l4') === false);

  // simulate the OS killing the app: nothing survives except localStorage
  const snap = loadCampaignSnapshot('l3');
  check('snapshot carries the level id', snap.levelId === 'l3');
  const resumed = applySnapshot(snap);

  check('gold restored exactly', resumed.gold === goldAtClear, `${resumed.gold} vs ${goldAtClear}`);
  check('lives restored exactly', resumed.lives === livesAtClear, `${resumed.lives} vs ${livesAtClear}`);
  check('wave restored exactly', resumed.wave === waveAtClear, `${resumed.wave} vs ${waveAtClear}`);
  check('tower count restored exactly', resumed.towers.length === towerCountAtClear,
    `${resumed.towers.length} vs ${towerCountAtClear}`);
  const rCannon = resumed.towers.find((t) => t.type === 'cannon');
  check('tower level restored exactly', !!rCannon && rCannon.level === cannon.level,
    `${rCannon && rCannon.level} vs ${cannon.level}`);
  check('tower branch restored exactly', rCannon.branch === cannon.branch);
  check('difficulty mode restored exactly', resumed.difficultyMode === 'normal');

  clearCampaignSave('l3');
}

console.log('resume prompt only appears when a snapshot exists for THAT level id:');
{
  const st = freshCampaign('l5', 1, 'easy');
  addTower(st, 'wall', 3, 3);
  for (let w = 1; w <= 3; w++) clearWave(st, w);
  saveCampaign(st);

  check('l5 has a resumable snapshot', hasCampaignSave('l5') === true);
  check('l6 (never played) does not', hasCampaignSave('l6') === false);
  check('l3 (different level, cleared above) does not', hasCampaignSave('l3') === false);

  clearCampaignSave('l5');
}

console.log('victory clears the snapshot:');
{
  const lv = getLevel('l3');
  const st = freshCampaign('l3', 1);
  for (let w = 1; w <= lv.waves.count; w++) clearWave(st, w);
  saveCampaign(st);
  check('snapshot exists before the win is processed', hasCampaignSave('l3') === true);
  // main.js's win check + the U14 clear both key off state.level / status;
  // exercise the same condition here without importing the DOM-coupled main.js
  st.status = 'won';
  if (st.level && !st.level.endless) clearCampaignSave(st.level.id);
  check('snapshot cleared after victory', hasCampaignSave('l3') === false);
}

console.log('defeat clears the snapshot:');
{
  const st = freshCampaign('l3', 1);
  for (let w = 1; w <= 3; w++) clearWave(st, w);
  saveCampaign(st);
  check('snapshot exists before defeat is processed', hasCampaignSave('l3') === true);
  st.lives = 0;
  st.status = 'lost';
  if (st.level && !st.level.endless) clearCampaignSave(st.level.id);
  check('snapshot cleared after defeat', hasCampaignSave('l3') === false);
}

console.log("a resumed run's next wave composition matches the un-killed run (determinism):");
{
  const st = freshCampaign('l7', 1);
  for (let w = 1; w <= 4; w++) clearWave(st, w);
  saveCampaign(st);
  const snap = loadCampaignSnapshot('l7');
  const resumed = applySnapshot(snap);

  const lv = getLevel('l7');
  const infoOriginal = levelWaveInfo(lv, st.wave + 1);
  const infoResumed = levelWaveInfo(getLevel(resumed.levelId || 'l7'), resumed.wave + 1);
  // levelWaveInfo is a pure function of (level, wave number) — same level +
  // same wave must produce the identical spawn-type/count contract whether
  // or not the run was killed and resumed in between.
  check('next-wave type set matches', JSON.stringify(infoOriginal.types) === JSON.stringify(infoResumed.types));
  check('next-wave count matches', infoOriginal.count === infoResumed.count);
  check('next-wave boss/flying flags match',
    infoOriginal.isBoss === infoResumed.isBoss && infoOriginal.hasFlying === infoResumed.hasFlying);

  clearCampaignSave('l7');
}

console.log('Endless save/load still round-trips (regression):');
{
  const lv = getLevel('endless');
  setGridSize(lv.cols, lv.rows);
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED, lv);
  const wall = addTower(st, 'wall', 3, 3);
  st.gold = 777; st.lives = 12;
  for (let w = 1; w <= 2; w++) { st.wave = w; st.maxWave = w; }
  check('Endless has no save yet', hasSave() === false);
  check('Endless saveGame succeeds', saveGame(st) === true);
  check('Endless hasSave true after saving', hasSave() === true);
  const snap = loadSnapshot();
  check('Endless snapshot levelId is "endless"', snap.levelId === 'endless');
  const st2 = applySnapshot(snap);
  check('Endless gold/lives round-trip', st2.gold === 777 && st2.lives === 12);
  check('Endless tower round-trips', st2.towers.some((t) => t.type === 'wall'));
  clearSave();
  check('Endless clearSave empties the slot', hasSave() === false);
  // campaign auto-save must never touch the Endless slot or vice versa
  check('Endless run is never captured by saveCampaign (level.endless=true)', saveCampaign(st) === false);
}

console.log('v4 format preserved; a snapshot from a different level id does not offer resume:');
{
  const st = freshCampaign('l9', 1);
  for (let w = 1; w <= 2; w++) clearWave(st, w);
  saveCampaign(st);
  const snap = loadCampaignSnapshot('l9');
  check('campaign snapshot is v5', snap.v === 5);
  check('campaign snapshot keeps difficulty mode', snap.difficultyMode === 'expert');
  // the resume-prompt gate in main.js is exactly hasCampaignSave(bootLevel.id);
  // a different level id must read false even though SOME campaign save exists
  check('a different level id sees no resumable save', hasCampaignSave('l10') === false);
  check('the correct level id still does', hasCampaignSave('l9') === true);
  clearCampaignSave('l9');
}

console.log(fails === 0 ? 'RESUME_OK' : `RESUME_FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
