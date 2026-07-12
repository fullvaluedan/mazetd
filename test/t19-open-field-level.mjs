import { LEVELS } from '../src/game/levels.js';
import { createMap } from '../src/game/map.js';
import { CELL } from '../src/engine/grid.js';
import { createState, isObjectiveCell } from '../src/game/state.js';
import { makeRng } from '../src/engine/rng.js';
import { inspectPng } from '../tools/asset-qc.mjs';

const level = LEVELS[0];
const map = createMap(null, level);
const state = createState(makeRng(19), level);
const checks = [];
const check = (label, ok) => {
  checks.push(ok);
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}`);
};

check('Level 1 remains the 12x16 portrait grid', level.cols === 12 && level.rows === 16);
check('open-field props are level-owned and non-blocking', map.props.length === 6 && map.props.every((prop) => map.cells[prop.cy][prop.cx] !== CELL.OBSTACLE));
check('props stay on legal interior cells', map.props.every((prop) => prop.cx > 0 && prop.cx < level.cols - 1 && prop.cy > 0 && prop.cy < level.rows - 1));
check('props never overlap an objective footprint', map.props.every((prop) => !isObjectiveCell(state, prop.cx, prop.cy)));
check('approved open-field floor is an exact 64px tile', (() => { const png = inspectPng('assets/tiles/floor-openfield-v2.png'); return png.width === 64 && png.height === 64; })());
check('portal object is an exact 2x2 128px square asset', (() => { const png = inspectPng('assets/objectives/portal-openfield-v3.png'); return png.width === 128 && png.height === 128; })());
check('crystal object is an exact 2x2 128px square asset', (() => { const png = inspectPng('assets/objectives/crystal-openfield-v3.png'); return png.width === 128 && png.height === 128; })());

console.log(checks.every(Boolean) ? 'OPEN_FIELD_LEVEL_QC_OK' : 'OPEN_FIELD_LEVEL_QC_FAIL');
if (!checks.every(Boolean)) process.exitCode = 1;
