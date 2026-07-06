// U1 checks — viewport letterbox math, DPR backing store, coordinate mappers.
// U2 checks — camera core: pan/zoom clamping, camera-aware mappings, the
// screen-space (camera-independent) pass for boss bars + damage flash.
import { installFakeDom } from './fakedom.mjs';
const { } = installFakeDom();
const { CANVAS_W, CANVAS_H, CONFIG } = await import('../src/config.js');
const { Viewport } = await import('../src/ui/viewport.js');
const { setGridSize } = await import('../src/engine/grid.js');

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

const fakeCanvas = (rectW, rectH) => ({
  width: 0, height: 0, style: {}, parentElement: null,
  getBoundingClientRect: () => ({ left: 10, top: 20, width: rectW, height: rectH }),
});
const box = (w, h) => ({ clientWidth: w, clientHeight: h });

console.log('Letterbox: 1280x800 stage (height-limited):');
{
  const c = fakeCanvas(1244, 800);
  const v = new Viewport(c, { style: {} }, box(1280, 800));
  check('scale = 800/576', Math.abs(v.scale - 800 / 576) < 1e-9, v.scale.toFixed(4));
  check('cssH fills height', v.cssH === 800);
  check('cssW letterboxed', v.cssW === Math.floor(CANVAS_W * 800 / 576), `${v.cssW}`);
  check('centered horizontally', v.left === Math.floor((1280 - v.cssW) / 2) && v.top === 0);
  check('dpr 1: backing = css', c.width === v.cssW && c.height === v.cssH);
  check('k maps world->device', Math.abs(v.k - c.width / CANVAS_W) < 1e-9);

  const u = v.worldToUi(CANVAS_W, CANVAS_H);
  check('worldToUi hits the css corner', Math.abs(u.x - CANVAS_W * v.scale) < 1e-9 && Math.abs(u.y - CANVAS_H * v.scale) < 1e-9);

  // client -> world via the live rect (rect 1244x800 at 10,20)
  const w = v.clientToWorld(10 + 1244, 20 + 800);
  check('clientToWorld hits world corner', Math.abs(w.x - CANVAS_W) < 1e-9 && Math.abs(w.y - CANVAS_H) < 1e-9);
  const w0 = v.clientToWorld(10, 20);
  check('clientToWorld origin', Math.abs(w0.x) < 1e-9 && Math.abs(w0.y) < 1e-9);
}

console.log('DPR 2 backing store (capped at 2):');
{
  global.window.devicePixelRatio = 3;   // phone-style; must cap to 2
  const c = fakeCanvas(896, 576);
  const v = new Viewport(c, null, box(896, 576));
  check('scale 1 at native size', Math.abs(v.scale - 1) < 1e-9);
  check('backing store = css * 2 (capped)', c.width === 896 * 2 && c.height === 576 * 2);
  check('k = 2', Math.abs(v.k - 2) < 1e-9);
  // transform call shape
  let got = null;
  v.applyTransform({ setTransform: (...a) => { got = a; } });
  check('setTransform(k,0,0,k,0,0)', got && got[0] === v.k && got[3] === v.k && got[1] === 0 && got[4] === 0);
  delete global.window.devicePixelRatio;
}

console.log('Resize hook fires:');
{
  const c = fakeCanvas(896, 576);
  const v = new Viewport(c, null, box(896, 576));
  let n = 0;
  v.onResize = () => n++;
  v.resize();
  check('onResize called', n === 1);
}

// ---------------------------------------------------------------------------
// U2: camera core
// ---------------------------------------------------------------------------

console.log('Camera: boots and resizes to fit-all (survey mode):');
{
  const v = new Viewport(fakeCanvas(896, 576), { style: {} }, box(896, 576));
  check('boots at camX/camY 0, zoom 1', v.camX === 0 && v.camY === 0 && v.zoom === 1);
  v.panBy(50, 50);
  check('pan is fully clamped at min zoom', v.camX === 0 && v.camY === 0);
  v.zoomAt(2, 400, 300);
  v.resize();
  check('resize resets the camera', v.camX === 0 && v.camY === 0 && v.zoom === 1);
}

console.log('Camera: clientToWorld <-> worldToUi round-trips (zoom 1.0/1.7/2.5 + pan):');
{
  // rect 896x576 at (10,20) matches the css box (scale 1) — see fakeCanvas
  const v = new Viewport(fakeCanvas(896, 576), { style: {} }, box(896, 576));
  for (const z of [1.0, 1.7, 2.5]) {
    v.resetCamera();
    v.zoomAt(z, 300, 200);   // zoom about an interior anchor
    v.panBy(37, 22);         // nonzero pan (clamps to 0 at zoom 1)
    let ok = true;
    for (const [cx, cy] of [[10, 20], [10 + 896, 20 + 576], [10 + 123, 20 + 456]]) {
      const w = v.clientToWorld(cx, cy);
      const u = v.worldToUi(w.x, w.y);
      // #ui is pinned to the canvas css box, so ui px == client px - rect origin
      if (Math.abs(u.x - (cx - 10)) > 1e-9 || Math.abs(u.y - (cy - 20)) > 1e-9) ok = false;
    }
    check(`round-trips at zoom ${z}`, ok, `cam ${v.camX.toFixed(1)},${v.camY.toFixed(1)}`);
  }
}

console.log('Camera: clamps at all four world edges:');
{
  const v = new Viewport(fakeCanvas(896, 576), { style: {} }, box(896, 576));
  v.zoomAt(2, 448, 288);   // zoom 2 about the center
  v.panBy(-1e6, -1e6);
  check('pins to the left/top edges', v.camX === 0 && v.camY === 0);
  v.panBy(1e6, 1e6);
  check('pins to the right/bottom edges',
    Math.abs(v.camX - (896 - 896 / 2)) < 1e-9 && Math.abs(v.camY - (576 - 576 / 2)) < 1e-9,
    `cam ${v.camX},${v.camY}`);
}

console.log('Camera: zoom bounds:');
{
  const v = new Viewport(fakeCanvas(896, 576), { style: {} }, box(896, 576));
  v.zoomAt(999, 448, 288);
  check('max zoom clamps at 2.5x min', Math.abs(v.zoom - CONFIG.CAMERA.MAX_ZOOM) < 1e-9, String(v.zoom));
  v.zoomAt(1e-6, 448, 288);
  check('min zoom clamps at fit-all', v.zoom === 1 && v.camX === 0 && v.camY === 0);
}

console.log('Camera: min zoom on a 12x16 board = the pre-camera letterbox exactly:');
{
  setGridSize(12, 16);                 // 384x512 world (campaign level-1 shape)
  const vw = 375, vh = 667;            // phone-portrait stage
  const v = new Viewport(fakeCanvas(375, 500), { style: {} }, box(vw, vh));
  const preScale = Math.min(vw / (12 * 32), vh / (16 * 32));   // today's formula
  check('scale = pre-camera fit', Math.abs(v.scale - preScale) < 1e-9, v.scale.toFixed(4));
  check('css box = pre-camera floor',
    v.cssW === Math.floor(12 * 32 * preScale) && v.cssH === Math.floor(16 * 32 * preScale));
  check('centered like pre-camera',
    v.left === Math.floor((vw - v.cssW) / 2) && v.top === Math.floor((vh - v.cssH) / 2));
  let got = null;
  v.applyTransform({ setTransform: (...a) => { got = a; } });
  check('frame transform = (k,0,0,k,0,0) at min zoom',
    got && got[0] === v.k && got[3] === v.k && got[4] === 0 && got[5] === 0);
  setGridSize(CONFIG.GRID_COLS, CONFIG.GRID_ROWS);   // restore for later checks
}

console.log('Camera: worldToUi under pan/zoom lands at the expected CSS px:');
{
  const v = new Viewport(fakeCanvas(896, 576), { style: {} }, box(1280, 800));  // scale 800/576
  v.zoomAt(2, 400, 300);   // anchor math: cam = (200, 150), inside the clamp
  check('camera lands where the anchor math says', Math.abs(v.camX - 200) < 1e-9 && Math.abs(v.camY - 150) < 1e-9);
  const u = v.worldToUi(500, 350);
  check('worldToUi = (w - cam) * scale * zoom',
    Math.abs(u.x - (500 - 200) * (800 / 576) * 2) < 1e-9 &&
    Math.abs(u.y - (350 - 150) * (800 / 576) * 2) < 1e-9,
    `${u.x.toFixed(2)},${u.y.toFixed(2)}`);
}

console.log('Camera: zoomAt keeps the anchor world point stationary on screen:');
{
  const v = new Viewport(fakeCanvas(896, 576), { style: {} }, box(896, 576));
  const before = v.worldToUi(320, 416);
  v.zoomAt(1.6, 320, 416);
  const mid = v.worldToUi(320, 416);
  v.zoomAt(1.3, 320, 416);   // compound zoom, still pinned
  const after = v.worldToUi(320, 416);
  check('anchor pinned across compound zooms',
    Math.abs(before.x - mid.x) < 1e-9 && Math.abs(mid.x - after.x) < 1e-9 &&
    Math.abs(before.y - mid.y) < 1e-9 && Math.abs(mid.y - after.y) < 1e-9);
}

console.log('Screen-space pass: boss bars + flash are camera-independent:');
{
  const { renderScreen } = await import('../src/ui/render.js');
  const v = new Viewport(fakeCanvas(896, 576), { style: {} }, box(896, 576));
  const fakeState = {
    enemies: [{ alive: true, boss: true, hp: 5000, maxHp: 9000, name: 'Gorehorn' }],
    flash: 0.5,
  };
  // Record the DEVICE-px rects of every fillRect through the seam main.js
  // uses (applyScreenTransform then renderScreen) — must not move with camera.
  const record = () => {
    const rects = [];
    let m = [1, 0, 0, 1, 0, 0];
    const ctx = new Proxy({}, {
      get: (_t, k) => {
        if (k === 'setTransform') return (...a) => { m = a; };
        if (k === 'fillRect') return (x, y, w, h) =>
          rects.push([m[0] * x + m[4], m[3] * y + m[5], m[0] * w, m[3] * h].join(','));
        return () => {};
      },
      set: () => true,
    });
    v.applyScreenTransform(ctx);
    renderScreen(ctx, fakeState);
    return rects.join('|');
  };
  const atRest = record();
  v.zoomAt(2.2, 600, 400);
  v.panBy(80, 60);
  const panned = record();
  check('device rects identical under pan/zoom', atRest === panned && atRest.length > 0);
  let got = null;
  v.applyScreenTransform({ setTransform: (...a) => { got = a; } });
  check('screen transform = bare fit transform (k,0,0,k,0,0)',
    got && got[0] === v.k && got[3] === v.k && got[4] === 0 && got[5] === 0);
}

console.log(fails === 0 ? 'VIEWPORT_OK' : `VIEWPORT_FAIL (${fails})`);
