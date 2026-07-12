// U6 checks, Level 1's crystal (goal) lands at a seeded-random position in
// its lower-board goalZone each new run, deterministic per seed, safe for
// saves and sims. See docs/plans/2026-07-12-003-...-plan.md unit U6.
import { makeRng } from '../src/engine/rng.js';
import { setGridSize } from '../src/engine/grid.js';
import { CELL } from '../src/engine/grid.js';
import { fieldAt } from '../src/engine/pathfinding.js';
import { getLevel } from '../src/game/levels.js';
import { createState, objectiveRect } from '../src/game/state.js';
import { createMap } from '../src/game/map.js';
import { buildSnapshot, applySnapshot } from '../src/game/save.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

const ROUTE_FLOOR = 14;   // review requirement: every spawn-to-goal route must be >= this many cells
const level = getLevel('l1');

function buildL1(seed) {
  setGridSize(level.cols, level.rows);
  return createState(makeRng(seed), seed, level);
}

function padCellsOf(rect) {
  const cells = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) cells.push({ x, y });
  return cells;
}

console.log('same seed twice -> identical goal center:');
{
  const a = buildL1(555);
  const b = buildL1(555);
  check('goal cx matches', a.map.goals[0].cx === b.map.goals[0].cx, `${a.map.goals[0].cx} vs ${b.map.goals[0].cx}`);
  check('goal cy matches', a.map.goals[0].cy === b.map.goals[0].cy, `${a.map.goals[0].cy} vs ${b.map.goals[0].cy}`);
}

console.log('seeds 1..50: zone/columns/walkability/no-overlap/reachability/route-floor + real spread:');
{
  const zone = level.goalZone;
  const seen = new Set();
  let allInZone = true, allInCols = true, allWalkable = true, allNoOverlap = true;
  let allReachable = true, allRouteFloor = true;
  for (let seed = 1; seed <= 50; seed++) {
    const st = buildL1(seed);
    const g = st.map.goals[0];
    const rect = objectiveRect(st, g);
    seen.add(`${g.cx},${g.cy}`);

    if (g.cy < zone.yMin || g.cy > zone.yMax) allInZone = false;
    if (rect.x < 1 || rect.x + rect.w > level.cols - 1) allInCols = false;

    for (const cell of padCellsOf(rect)) {
      const t = st.map.type(cell.x, cell.y);
      if (t !== CELL.OPEN && t !== CELL.GOAL) allWalkable = false;
      for (const prop of level.props || []) {
        if (prop.cx === cell.x && prop.cy === cell.y) allNoOverlap = false;
      }
      for (const s of st.map.spawns) {
        if (s.cx === cell.x && s.cy === cell.y) allNoOverlap = false;
      }
    }

    const field = st.fields[g.id];
    for (const s of st.map.spawns) {
      const d = fieldAt(field, s.cx, s.cy);
      if (!Number.isFinite(d)) allReachable = false;
      if (!(d >= ROUTE_FLOOR)) allRouteFloor = false;
    }
  }
  check('every placement stays inside the goalZone rows', allInZone);
  check('every pad stays within columns 1..cols-2 (border inset)', allInCols);
  check('every pad cell is walkable (open ground or the goal marker)', allWalkable);
  check('no pad overlaps a spawn or a prop', allNoOverlap);
  check('every spawn keeps a route to the goal pad', allReachable);
  check(`every spawn-to-goal route is >= ${ROUTE_FLOOR} cells`, allRouteFloor);
  check('placement is genuinely randomized (>=5 distinct centers across 50 seeds)', seen.size >= 5, `${seen.size} distinct`);
}

console.log('retry exhaustion falls back to the authored goal without throwing:');
{
  // Fill the whole interior width across the candidate pad's row range so
  // every draw in a single-row goalZone is guaranteed geometrically invalid.
  const obstacles = [];
  for (let y = 3; y <= 6; y++) for (let x = 1; x <= level.cols - 2; x++) obstacles.push([x, y]);
  const blocked = { ...level, goalZone: { yMin: 5, yMax: 5 }, obstacles };
  setGridSize(blocked.cols, blocked.rows);

  let map = null, threw = false;
  try { map = createMap(makeRng(4242), blocked, 4242); }
  catch { threw = true; }

  check('an impossible zone does not throw', !threw);
  check('fallback keeps the authored goal position', !!map &&
    map.goals[0].cx === level.goals[0].cx && map.goals[0].cy === level.goals[0].cy,
    !!map ? `${map.goals[0].cx},${map.goals[0].cy}` : 'no map');
}

console.log('seed round trip: buildSnapshot -> applySnapshot reproduces the same crystal position:');
{
  const st = buildL1(999);
  const before = { ...st.map.goals[0] };
  const snap = buildSnapshot(st);
  const resumed = applySnapshot(snap);
  check('resumed goal cx matches', resumed.map.goals[0].cx === before.cx, `${resumed.map.goals[0].cx} vs ${before.cx}`);
  check('resumed goal cy matches', resumed.map.goals[0].cy === before.cy, `${resumed.map.goals[0].cy} vs ${before.cy}`);
}

console.log(fails === 0 ? 'CRYSTAL_PLACEMENT_QC_OK' : `CRYSTAL_PLACEMENT_QC_FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
