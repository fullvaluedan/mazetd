// Structural proof contract for the premium redesign harness and stable UI
// hooks. Browser geometry remains a separate checkpoint; this test ensures
// its named states and coordinate-space anchors cannot silently disappear.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const index = read('index.html');
const screens = read('src/ui/screens.js');
const radial = read('src/ui/radial.js');
const sheets = read('src/ui/sheets.js');
const harness = read('test/ui-harness.html');

let fails = 0;
const check = (name, condition, evidence = '') => {
  if (!condition) { fails++; console.log('  FAIL', name, evidence); }
  else console.log('  ok  ', name, evidence);
};

const spaces = [
  'screen', 'shell-status', 'board-slot', 'world', 'world-overlay',
  'board-overlay', 'shell-command', 'modal',
];
console.log('Coordinate-space mounts:');
for (const space of spaces) {
  check(`${space} mount exists`, index.includes(`data-ui-space="${space}"`));
}

const states = [
  'title', 'difficulty', 'map', 'battle-empty', 'radial-empty',
  'radial-tower', 'info', 'settings', 'victory', 'defeat',
  'wall-grid',
  'tower-roster', 'enemy-roster',
  'store', 'resume', 'maze-end', 'leaderboard', 'stageLeaderboard',
  'tutorial',
];
console.log('Deterministic harness states:');
for (const state of states) {
  check(`${state} state is registered`, harness.includes(`'${state}'`));
}
check('harness exposes browser automation seam', harness.includes('window.__uiHarness'));
check('harness snapshots local storage', harness.includes('snapshotStorage'));
check('harness restores local storage', harness.includes('restoreStorage'));

console.log('Stable selectors and accessible dismiss controls:');
check('mounted screen publishes data-ui-state', screens.includes('modal.dataset.uiState = name'));
check('hidden screen removes stale state', screens.includes('delete this.modal.dataset.uiState'));
check('radial close has an accessible label', radial.includes("setAttribute('aria-label', 'Close build menu')"));
check('sheet close has an accessible label', sheets.includes("setAttribute('aria-label'"));
check('radial center selector remains stable', radial.includes("x.className = 'radial-center'"));
check('info card remains explicit-action capable', radial.includes("label: 'Tower info'") && radial.includes('inspectTower(tower)'));
check('positioned wave control does not animate its anchor', read('src/ui/ui.css').includes('.radial { animation: none; opacity: 1; }'));
const battleCss = read('src/ui/styles/battle.css');
check('radial actions preserve their translated anchor when pressed', battleCss.includes('.radial-item:active:not(:disabled)') && battleCss.includes('transform: translate(-50%, -50%)'));
check('radial close target is always at least 44px', battleCss.includes('.radial-center { width: 44px; height: 44px; }'));
check('primary battle controls use the local icon sheet', read('src/ui/icons.js').includes("assets/ui/icons.svg") && !read('src/ui/topbar.js').includes('🪙'));
check('notifications mount in reserved shell chrome', index.includes('id="notifications"') && read('src/main.js').includes('(notifications || overlay).appendChild(el)'));
check('campaign victories expose remaining-resource score breakdown', screens.includes('calculateStageScore(state.gold, state.lives)') && screens.includes('showStageLeaderboard'));
check('next-wave rail reads the deterministic spawn summary', read('src/ui/topbar.js').includes('waveInfoFor(state, nextWave)') && read('src/ui/styles/battle.css').includes('.wave-brief'));
check('difficulty entry uses the exact three simple labels', screens.includes('mode.toUpperCase()') && !screens.includes('difficultyLabel(mode)}</span>'));
check('boss health mounts in reserved shell chrome', read('src/ui/topbar.js').includes("div('boss-status hidden')"));
const components = read('src/ui/components.js');
check('topmost surfaces trap focus and inert the battle shell', components.includes('export function lockSurface') && components.includes('shell.inert = true') && components.includes("event.key !== 'Tab'"));
check('sheets close on Escape and restore focus', read('src/ui/sheets.js').includes('lockSurface(backdrop, () => this.close())'));

console.log(fails === 0 ? 'UI_CONTRACT_OK' : `UI_CONTRACT_FAIL (${fails})`);
if (fails) process.exitCode = 1;
