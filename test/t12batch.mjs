// U21 checks — marquee multi-select build/sell:
//   rect -> cells enumeration (inclusive, clamped, row-major from the drag-
//   start corner), batchBuild's affordable-prefix + skip-don't-abort
//   semantics, batchSell refund sums (walls 100% / towers 70%), ONE sfx
//   event per batch, and the select-mode gesture routing through the real
//   input handlers (a marquee drag never pans the camera; two-finger pinch
//   still zooms; exiting select mode restores drag-pan).
import { installFakeDom } from './fakedom.mjs';
installFakeDom();
const { CONFIG } = await import('../src/config.js');
const { makeRng } = await import('../src/engine/rng.js');
// grid namespace: COLS/ROWS are live bindings — destructuring would freeze
// them at import time and miss the setGridSize() calls below.
const grid = await import('../src/engine/grid.js');
const { setGridSize, SIZE } = grid;
const { createState, canBuildAt } = await import('../src/game/state.js');
const { addTower } = await import('../src/game/tower.js');
const { marqueeCells, batchBuild, batchSell, sellRefund } = await import('../src/game/shop.js');
const { getLevel } = await import('../src/game/levels.js');
const { Viewport } = await import('../src/ui/viewport.js');
const { setupInput } = await import('../src/engine/input.js');

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const cc = (n) => n * SIZE + SIZE / 2;   // world px of cell center

function freshL8() {
  const lv = getLevel('l8');           // 12x17, no obstacles, CP1 (2,8) / CP2 (9,8)
  setGridSize(lv.cols, lv.rows);
  return createState(makeRng(1), 1, lv);
}

console.log('Marquee: rect -> cells (inclusive, clamped, row-major from the start corner):');
{
  freshL8();   // sets the 12x17 grid
  const f = marqueeCells(cc(1), cc(1), cc(3), cc(2));
  check('forward rect = exactly the 3x2 intersected cells, row-major',
    JSON.stringify(f) === JSON.stringify([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]), JSON.stringify(f));
  const r = marqueeCells(cc(3), cc(2), cc(1), cc(1));
  check('reverse drag enumerates from the drag-start corner',
    r.length === 6 && r[0].x === 3 && r[0].y === 2 && r[5].x === 1 && r[5].y === 1,
    JSON.stringify(r));
  const t = marqueeCells(10, 10, 70, 10);   // 70px reaches into cell 2 (SIZE 32)
  check('boundary-touching cells included (inclusive bounds)',
    t.length === 3 && t[2].x === 2 && t[2].y === 0, JSON.stringify(t));
  const c = marqueeCells(-500, -500, 5000, 5000);
  check('off-grid points clamp to the grid', c.length === grid.COLS * grid.ROWS &&
    c[0].x === 0 && c[0].y === 0 &&
    c[c.length - 1].x === grid.COLS - 1 && c[c.length - 1].y === grid.ROWS - 1,
    `${c.length} cells`);
  const one = marqueeCells(cc(1), cc(1), cc(1), cc(1));
  check('degenerate rect = one cell', one.length === 1 && one[0].x === 1 && one[0].y === 1);
}

console.log('batchBuild: affordable prefix, row-major from the start corner, exact gold:');
{
  const st = freshL8();
  const cells = marqueeCells(cc(3), cc(3), cc(5), cc(5));   // 3x3 at (3,3)..(5,5)
  check('precondition: all 9 cells buildable', cells.every((c) => canBuildAt(st, c.x, c.y)));
  st.gold = CONFIG.TOWERS.wall.cost * 5 + 3;                // 5 walls + 3g change
  const r = batchBuild(st, 'wall', cells);
  check('builds exactly the affordable prefix', r.built === 5 && r.of === 9 &&
    r.spent === CONFIG.TOWERS.wall.cost * 5, JSON.stringify(r));
  check('gold left = the change, to the unit', st.gold === 3, String(st.gold));
  check('first five cells row-major from the start corner',
    !!st.towerGrid[3][3] && !!st.towerGrid[3][4] && !!st.towerGrid[3][5] &&
    !!st.towerGrid[4][3] && !!st.towerGrid[4][4]);
  check('cells past the gold cutoff untouched',
    !st.towerGrid[4][5] && !st.towerGrid[5][3] && !st.towerGrid[5][4] && !st.towerGrid[5][5]);
}
{
  const st = freshL8();
  st.gold = CONFIG.TOWERS.wall.cost * 2;                    // exactly two walls
  const cells = marqueeCells(cc(5), cc(5), cc(3), cc(3));   // drag STARTED at (5,5)
  const r = batchBuild(st, 'wall', cells);
  check('reverse drag fills from ITS start corner', r.built === 2 &&
    !!st.towerGrid[5][5] && !!st.towerGrid[5][4] && !st.towerGrid[5][3], JSON.stringify(r));
  check('gold exactly exhausted', st.gold === 0, String(st.gold));
}

console.log('batchBuild: invalid cells skipped without aborting the batch:');
{
  const st = freshL8();
  st.gold = 1e6;
  addTower(st, 'cannon', 2, 3);                             // pre-occupied mid-rect
  const cells = marqueeCells(cc(0), cc(3), cc(3), cc(3));   // border(0,3) occ(2,3) open(1,3)(3,3)
  const r = batchBuild(st, 'wall', cells);
  check('border + occupied skipped, later cells still built',
    r.built === 2 && r.of === 2, JSON.stringify(r));
  check('walls landed on both open cells', !!st.towerGrid[3][1] && !!st.towerGrid[3][3]);
  check('the pre-existing tower survived', st.towerGrid[3][2] && st.towerGrid[3][2].type === 'cannon');
  const cp = marqueeCells(cc(1), cc(8), cc(3), cc(8));      // includes checkpoint flag CP1 (2,8)
  const r2 = batchBuild(st, 'wall', cp);
  check('checkpoint flag cell skipped too', r2.built === 2 && r2.of === 2 && !st.towerGrid[8][2],
    JSON.stringify(r2));
}

console.log('batchSell: refund = sum of sellRefund (walls 100%, towers 70%):');
{
  const st = freshL8();
  st.gold = 0;
  const w1 = addTower(st, 'wall', 3, 3), w2 = addTower(st, 'wall', 4, 3);
  const c1 = addTower(st, 'cannon', 3, 4), c2 = addTower(st, 'cannon', 4, 4);
  check('rates: wall 100% of invested, tower 70%',
    sellRefund(w1) === w1.invested &&
    sellRefund(c1) === Math.floor(c1.invested * CONFIG.SELL_REFUND) &&
    CONFIG.WALL_REFUND === 1.0 && CONFIG.SELL_REFUND === 0.70);
  const expect = sellRefund(w1) + sellRefund(w2) + sellRefund(c1) + sellRefund(c2);
  // mixed input shapes: two as cells, two as tower entities
  const r = batchSell(st, [{ x: 3, y: 3 }, { x: 4, y: 3 }, c1, c2]);
  check('sold all four for the exact refund sum', r.sold === 4 && r.refund === expect,
    JSON.stringify(r) + ` expect=${expect}`);
  check('gold credited exactly', st.gold === expect, String(st.gold));
  check('grid cleared', !st.towerGrid[3][3] && !st.towerGrid[3][4] &&
    !st.towerGrid[4][3] && !st.towerGrid[4][4]);
  const r0 = batchSell(st, [{ x: 3, y: 3 }]);               // nothing left there
  check('empty cells sell nothing', r0.sold === 0 && r0.refund === 0);
}

console.log('Batches push ONE sfx event each (not one per cell):');
{
  const st = freshL8();
  st.gold = 1e6;
  st.events.length = 0;
  const cells = marqueeCells(cc(3), cc(3), cc(5), cc(3));   // 3 cells
  batchBuild(st, 'wall', cells);
  check('one build event for 3 walls', st.events.length === 1 && st.events[0].t === 'build',
    JSON.stringify(st.events));
  st.events.length = 0;
  batchSell(st, cells);
  check('one sell event for 3 walls', st.events.length === 1 && st.events[0].t === 'sell',
    JSON.stringify(st.events));
  st.events.length = 0;
  batchBuild(st, 'wall', []);
  batchSell(st, []);
  check('empty batches stay silent', st.events.length === 0);
}

// ---------------------------------------------------------------------------
// Select-mode gestures through the real input handlers (t10viewport pattern:
// fake canvas with recorded listeners + plain-object "PointerEvents").
// ---------------------------------------------------------------------------
const gestureCanvas = (rectW, rectH) => {
  const listeners = {};
  return {
    width: 0, height: 0, style: {}, parentElement: null, listeners,
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 10, top: 20, width: rectW, height: rectH }),
  };
};
const fire = (c, type, props) =>
  (c.listeners[type] || []).forEach((f) => f({ preventDefault() {}, button: 0, ...props }));
const box = (w, h) => ({ clientWidth: w, clientHeight: h });

console.log('Select mode: a one-pointer drag marquees and does NOT move the camera:');
{
  setGridSize(CONFIG.GRID_COLS, CONFIG.GRID_ROWS);   // classic 28x18 = 896x576 world
  const c = gestureCanvas(896, 576);
  const v = new Viewport(c, { style: {} }, box(896, 576));
  const log = { clicks: 0, taps: 0, live: [], ends: [] };
  const input = setupInput(c, {
    onLeftClick: () => log.clicks++,
    onSelectTap: () => log.taps++,
    onMarquee: (r) => log.live.push({ ...r }),
    onMarqueeEnd: (r) => log.ends.push(r ? { ...r } : null),
  }, v);

  v.zoomAt(2, 448, 288);           // cam (224,144) — a pan WOULD be visible here
  input.setSelectMode(true);
  fire(c, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
  fire(c, 'pointermove', { pointerId: 1, clientX: 360, clientY: 280 });
  check('camera did not move during the marquee drag',
    v.camX === 224 && v.camY === 144 && v.zoom === 2, `cam ${v.camX},${v.camY} z${v.zoom}`);
  const m = log.live[log.live.length - 1];
  check('live marquee rect in world px (client->world under zoom 2)',
    log.live.length === 1 && near(m.ax, 419) && near(m.ay, 284) && near(m.bx, 399) && near(m.by, 274),
    JSON.stringify(m));
  fire(c, 'pointerup', { pointerId: 1, clientX: 360, clientY: 280 });
  const e = log.ends[0];
  check('release delivers the final rect exactly once', log.ends.length === 1 && e &&
    near(e.ax, 419) && near(e.ay, 284) && near(e.bx, 399) && near(e.by, 274), JSON.stringify(e));
  fire(c, 'click', { clientX: 360, clientY: 280 });
  check('trailing click suppressed (no build, no exit)', log.clicks === 0 && log.taps === 0);

  // plain sub-slop tap: exits select mode via onSelectTap, never onLeftClick
  fire(c, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
  fire(c, 'pointermove', { pointerId: 1, clientX: 103, clientY: 100 });
  fire(c, 'pointerup', { pointerId: 1, clientX: 103, clientY: 100 });
  fire(c, 'click', { clientX: 103, clientY: 100 });
  check('plain tap routes to onSelectTap, radial flow suppressed',
    log.taps === 1 && log.clicks === 0);

  // two-finger gesture: marquee cancels (null), pinch still zooms
  const z0 = v.zoom, liveBefore = log.live.length;
  fire(c, 'pointerdown', { pointerId: 1, clientX: 358, clientY: 308 });
  fire(c, 'pointermove', { pointerId: 1, clientX: 320, clientY: 308 });   // marquee starts
  fire(c, 'pointerdown', { pointerId: 2, clientX: 558, clientY: 308 });   // second finger
  check('second finger cancels the marquee with null',
    log.ends.length === 2 && log.ends[1] === null);
  const liveDuringPinch = log.live.length;
  fire(c, 'pointermove', { pointerId: 1, clientX: 296, clientY: 308 });
  fire(c, 'pointermove', { pointerId: 2, clientX: 582, clientY: 308 });
  check('pinch still zooms while select mode is ON', v.zoom > z0, `zoom ${z0} -> ${v.zoom}`);
  check('no marquee updates during the pinch', log.live.length === liveDuringPinch &&
    liveDuringPinch === liveBefore + 1);
  fire(c, 'pointerup', { pointerId: 1, clientX: 296, clientY: 308 });
  fire(c, 'pointerup', { pointerId: 2, clientX: 582, clientY: 308 });
  fire(c, 'click', { clientX: 439, clientY: 308 });
  check('no rect delivered after a pinch, click eaten',
    log.ends.length === 2 && log.clicks === 0 && log.taps === 1);

  // exiting select mode restores drag-pan
  input.setSelectMode(false);
  const camX0 = v.camX, camY0 = v.camY, ends0 = log.ends.length, live0 = log.live.length;
  fire(c, 'pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
  fire(c, 'pointermove', { pointerId: 1, clientX: 360, clientY: 280 });
  fire(c, 'pointerup', { pointerId: 1, clientX: 360, clientY: 280 });
  fire(c, 'click', { clientX: 360, clientY: 280 });
  check('drag pans the camera again after exit', v.camX > camX0 && v.camY > camY0,
    `cam ${camX0},${camY0} -> ${v.camX.toFixed(1)},${v.camY.toFixed(1)}`);
  check('no marquee events outside select mode',
    log.ends.length === ends0 && log.live.length === live0);
  check('pan click still suppressed, no stray tap exit',
    log.clicks === 0 && log.taps === 1);

  // and a normal tap builds again
  fire(c, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
  fire(c, 'pointerup', { pointerId: 1, clientX: 100, clientY: 100 });
  fire(c, 'click', { clientX: 100, clientY: 100 });
  check('normal tap clicks again after exit', log.clicks === 1);
}

console.log(fails === 0 ? 'BATCH_OK' : `BATCH_FAIL (${fails})`);
