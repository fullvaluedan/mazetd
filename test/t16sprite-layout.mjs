import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'assets/manifest.json'), 'utf8'));
const icons = readFileSync(join(root, 'assets/ui/icons.svg'), 'utf8');
const renderSource = readFileSync(join(root, 'src/ui/render.js'), 'utf8');
const { wallNeighborMask } = await import('../src/ui/render.js');
let fails = 0;
const check = (name, condition) => {
  console.log(condition ? '  ok  ' : '  FAIL', name);
  if (!condition) fails++;
};

console.log('Sprite layout and UI metadata contract:');
const ui = manifest['ui-icons'];
const wallMeta = manifest['tower-wall'];
check('UI icon sheet has versioned metadata', ui?.version === 1 && ui?.kind === 'svg-symbol-sheet');
check('UI icon sheet declares a 24px intrinsic grid', ui?.intrinsic?.[0] === 24 && ui?.intrinsic?.[1] === 24);
check('UI icon sheet uses contain scaling', ui?.scaleMode === 'contain');
check('wall metadata fixes a 32px logical footprint', wallMeta?.kind === 'sprite' && wallMeta?.logical?.[0] === 32 && wallMeta?.logical?.[1] === 32);
check('wall pivot is cell-centered', wallMeta?.pivot?.[0] === 0.5 && wallMeta?.pivot?.[1] === 0.5);
for (const id of ['coin', 'heart', 'reward', 'pause', 'play', 'shop', 'settings', 'close', 'info', 'upgrade', 'target', 'sell', 'lock', 'drag', 'pan', 'save', 'load', 'retry', 'map', 'trophy', 'volume', 'wall']) {
  check(`${id} symbol exists`, icons.includes(`id="${id}"`));
}

console.log('Connected wall topology:');
const wall = { def: { wall: true } };
const grid = Array.from({ length: 3 }, () => Array(3).fill(null));
grid[1][1] = wall;
const wallState = { towerGrid: grid };
check('isolated wall mask is 0', wallNeighborMask(wallState, 1, 1) === 0);
grid[0][1] = wall;
grid[1][2] = wall;
grid[2][1] = wall;
grid[1][0] = wall;
check('cross wall mask is NESW (15)', wallNeighborMask(wallState, 1, 1) === 15);
grid[0][1] = null;
check('T wall mask omits north (14)', wallNeighborMask(wallState, 1, 1) === 14);
check('wall renderer uses full-bleed undercoat', renderSource.includes('adjacent cells can never expose ground'));
check('wall renderer never scales connected geometry', !renderSource.includes('drawConnectedWall(ctx, state, t, pop)'));
check('wall level pips remain excluded', renderSource.includes('if (!t.def.wall)'));

console.log(fails === 0 ? 'SPRITE_LAYOUT_OK' : `SPRITE_LAYOUT_FAIL (${fails})`);
if (fails) process.exitCode = 1;
