// U1 checks — viewport letterbox math, DPR backing store, coordinate mappers.
import { installFakeDom } from './fakedom.mjs';
const { } = installFakeDom();
const { CANVAS_W, CANVAS_H } = await import('../src/config.js');
const { Viewport } = await import('../src/ui/viewport.js');

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

console.log(fails === 0 ? 'VIEWPORT_OK' : `VIEWPORT_FAIL (${fails})`);
