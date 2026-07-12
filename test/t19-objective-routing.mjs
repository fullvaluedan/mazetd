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
check('every crystal cell is an equivalent reach target', [
  [rect.x, rect.y], [rect.x + 1, rect.y], [rect.x, rect.y + 1], [rect.x + 1, rect.y + 1],
].every(([x, y]) => fieldAt(field, x, y) === 0));
check('entry approaches the nearest reachable crystal side', fieldAt(field, 7, 13) === 1 && fieldAt(field, 8, 12) === 1);

console.log(checks.every(Boolean) ? 'OBJECTIVE_ROUTING_QC_OK' : 'OBJECTIVE_ROUTING_QC_FAIL');
if (!checks.every(Boolean)) process.exitCode = 1;
