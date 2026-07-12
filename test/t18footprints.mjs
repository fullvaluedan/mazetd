import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize } from '../src/engine/grid.js';
import { getLevel } from '../src/game/levels.js';
import { canBuildAt, footprintCells, createState, objectiveRect } from '../src/game/state.js';
import { addTower, removeTower, seedStarterWalls } from '../src/game/tower.js';
import { sellRefund, tryBuild } from '../src/game/shop.js';

let fails = 0;
const check = (name, condition, evidence = '') => { if (!condition) { fails++; console.log('  FAIL', name, evidence); } else console.log('  ok  ', name, evidence); };
const level = getLevel('l1');
setGridSize(level.cols, level.rows);
const state = createState(makeRng(7), 7, level);
state.gold = 999;

console.log('Footprints: walls 1x1, every live combat tower 2x2:');
{
  check('wall is one cell', footprintCells('wall', 3, 3).length === 1);
  check('arrow is four cells', footprintCells('arrow', 5, 5).length === 4);
  check('cannon is four cells', footprintCells('cannon', 5, 5).length === 4);
  check('ice is four cells', footprintCells('frost', 5, 5).length === 4);
}

console.log('Atomic occupancy and ownership:');
{
  const tower = addTower(state, 'arrow', 5, 5);
  check('all four covered cells point at one tower', [[5,5],[6,5],[5,6],[6,6]].every(([x,y]) => state.towerGrid[y][x] === tower));
  check('overlapping wall and tower anchors are rejected', !canBuildAt(state, 6, 5, 'wall') && !canBuildAt(state, 4, 5, 'cannon'));
  removeTower(state, tower);
  check('removal clears all covered cells', [[5,5],[6,5],[5,6],[6,6]].every(([x,y]) => state.towerGrid[y][x] === null));
}

console.log('Wall economy and starter brick:');
{
  const goldBefore = state.gold;
  check('wall build costs exactly 1G', tryBuild(state, 'wall', 7, 7) && state.gold === goldBefore - 1);
  const wall = state.towerGrid[7][7];
  check('wall takedown refunds exactly 1G', sellRefund(wall) === 1 && CONFIG.TOWERS.wall.cost === 1);
  const fresh = createState(makeRng(9), 9, level);
  seedStarterWalls(fresh);
  check('level one starts with authored player-owned brick', fresh.towers.filter((t) => t.type === 'wall').length === level.starterWalls.length);
}

console.log('Objective pads reserve their exact visual footprints:');
{
  check('portal pad is non-buildable across its 2x2 mouth', !canBuildAt(state, 1, 0, 'wall') && !canBuildAt(state, 2, 1, 'wall'));
  // U6: l1's crystal is seeded-random inside goalZone; assert the zone
  // contract and derive the reserved pad from the actual goal.
  const goal = state.map.goals[0];
  const zone = level.goalZone;
  check('level one crystal sits inside its goalZone band', goal.cy >= zone.yMin && goal.cy <= zone.yMax && goal.cx >= 2 && goal.cx <= level.cols - 3);
  const rect = objectiveRect(state, goal);
  check('crystal pad is non-buildable across its 2x2 footprint', !canBuildAt(state, rect.x, rect.y, 'wall') && !canBuildAt(state, rect.x + 1, rect.y + 1, 'wall'));
}

console.log(fails ? `FOOTPRINT_FAIL (${fails})` : 'FOOTPRINT_OK');
if (fails) process.exitCode = 1;
