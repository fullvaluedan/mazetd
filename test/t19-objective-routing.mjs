import { setGridSize } from '../src/engine/grid.js';
import { fieldAt } from '../src/engine/pathfinding.js';
import { makeRng } from '../src/engine/rng.js';
import { getLevel } from '../src/game/levels.js';
import { createState, objectiveRect } from '../src/game/state.js';

const level = getLevel('l1');
setGridSize(level.cols, level.rows);
const state = createState(makeRng(23), 23, level);
const goal = state.map.goals[0];
const rect = objectiveRect(state, goal);
const field = state.fields[goal.id];
const checks = [];
const check = (label, ok) => { checks.push(ok); console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}`); };

check('crystal objective is a square 2x2 destination', rect.w === 2 && rect.h === 2);
// Derive from the ACTUAL goal rect of the constructed state (U6: the crystal
// can now sit anywhere in l1's goalZone, not just the old fixed corner) -
// hardcoded approach cells would silently stop meaning anything once the
// goal moved.
const padCells = [
  [rect.x, rect.y], [rect.x + 1, rect.y], [rect.x, rect.y + 1], [rect.x + 1, rect.y + 1],
];
check('every crystal cell is an equivalent reach target', padCells.every(([x, y]) => fieldAt(field, x, y) === 0));
const padKey = (x, y) => `${x},${y}`;
const padSet = new Set(padCells.map(([x, y]) => padKey(x, y)));
const outsideNeighborDists = [];
for (const [x, y] of padCells) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (!padSet.has(padKey(nx, ny))) outsideNeighborDists.push(fieldAt(field, nx, ny));
  }
}
check('at least one orthogonal neighbor of the crystal pad sits one step out',
  outsideNeighborDists.some((d) => d === 1));

console.log(checks.every(Boolean) ? 'OBJECTIVE_ROUTING_QC_OK' : 'OBJECTIVE_ROUTING_QC_FAIL');
if (!checks.every(Boolean)) process.exitCode = 1;
