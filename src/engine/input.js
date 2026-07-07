// =============================================================================
// input.js — translates raw mouse/keyboard/pointer events into game intents
// and camera gestures.
//
// All pointer math routes through viewport.clientToWorld — the ONE shared
// client->world mapping (letterbox + DPR + camera pan/zoom) — so hover/click
// coordinates can never disagree with the renderer. Callers pass a `handlers`
// object; this module stays ignorant of game rules.
//
// Gestures (U3): one pointer dragging past CAMERA.DRAG_SLOP pans (below the
// slop it stays a tap and the click flows fire untouched); two pointers pinch-
// zoom about the gesture midpoint, midpoint movement panning as usual; wheel
// zooms about the cursor. The click event that ends a drag/pinch is suppressed
// so a pan can never build or select.
//
// Select mode (U21): setupInput returns { setSelectMode, isSelectMode }. While
// ON, a one-pointer drag draws a world-space marquee instead of panning
// (handlers.onMarquee live, onMarqueeEnd(rect) on release, onMarqueeEnd(null)
// on cancel); two-finger pinch/pan and wheel zoom are untouched; a plain tap
// routes to handlers.onSelectTap (the "exit select mode" hook) instead of
// onLeftClick, so the radial can never open in select mode.
// =============================================================================

import { SIZE } from './grid.js';
import { CONFIG } from '../config.js';

export function setupInput(canvas, handlers, viewport) {
  function toCell(ev) {
    // Shared mapping: client px -> world px (camera-aware), then -> cell.
    const { x: px, y: py } = viewport.clientToWorld(ev.clientX, ev.clientY);
    return { x: Math.floor(px / SIZE), y: Math.floor(py / SIZE), px, py };
  }

  // ---- camera gestures --------------------------------------------------------
  const pointers = new Map();  // active pointers: id -> {x, y} client px
  let mode = 'idle';           // 'idle' | 'press' (may still be a tap) | 'pan' | 'pinch' | 'marquee'
  let press = null;            // pointerdown origin while deciding tap vs pan
  let last = null;             // previous single-pointer position while panning
  let pinch = null;            // previous pinch frame: { dist, midX, midY }
  let dragged = false;         // this gesture panned/pinched/marqueed (not a tap)
  let suppressClick = false;   // eat the click event that ends a drag/pinch
  let selectMode = true;       // one-pointer drag = marquee-select by DEFAULT (a tap
                               // still builds one tower); toggle OFF for one-finger pan.
                               // Two-finger drag pans/pinches regardless of this flag.
  let marquee = null;          // live marquee rect in world px { ax, ay, bx, by }

  // A second finger or a mode toggle kills an in-flight marquee; the UI clears
  // its overlay on the null.
  const cancelMarquee = () => {
    if (!marquee) return;
    marquee = null;
    if (handlers.onMarqueeEnd) handlers.onMarqueeEnd(null);
  };

  // CSS-px delta -> world-px delta at the current zoom (no rect offset needed).
  const cssToWorld = () => 1 / (viewport.scale * viewport.zoom);

  const pinchFrame = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
  };

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;  // right/middle: not a gesture
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    // capture can throw (stale/synthetic pointer ids); the gesture must survive
    try { if (canvas.setPointerCapture) canvas.setPointerCapture(ev.pointerId); } catch { /* uncaptured is fine */ }
    if (pointers.size === 1) {
      mode = 'press';
      press = { x: ev.clientX, y: ev.clientY };
      dragged = false;
      suppressClick = false;   // fresh gesture: never eat a legit tap on a stale flag
    } else if (pointers.size === 2) {
      cancelMarquee();         // two-finger gestures never marquee
      mode = 'pinch';          // a second finger always cancels the tap
      dragged = true;
      pinch = pinchFrame();
    }
  });

  canvas.addEventListener('pointermove', (ev) => {
    const p = pointers.get(ev.pointerId);
    if (!p) return;            // buttonless mouse hover: mousemove below handles it
    p.x = ev.clientX; p.y = ev.clientY;
    if (mode === 'press') {
      if (Math.hypot(p.x - press.x, p.y - press.y) <= CONFIG.CAMERA.DRAG_SLOP) return;
      dragged = true;
      if (selectMode) {
        mode = 'marquee';      // select mode: the drag selects, the camera stays put
        const w = viewport.clientToWorld(press.x, press.y);
        marquee = { ax: w.x, ay: w.y, bx: w.x, by: w.y };
      } else {
        mode = 'pan';
        last = press;          // pan from the origin: no dead jump at the threshold
      }
    }
    if (mode === 'marquee') {
      const w = viewport.clientToWorld(p.x, p.y);
      marquee.bx = w.x; marquee.by = w.y;
      if (handlers.onMarquee) handlers.onMarquee(marquee);
    } else if (mode === 'pan') {
      const k = cssToWorld();  // world follows the finger, so the camera moves opposite
      viewport.panBy((last.x - p.x) * k, (last.y - p.y) * k);
      last = { x: p.x, y: p.y };
    } else if (mode === 'pinch' && pointers.size === 2) {
      const f = pinchFrame();
      if (pinch.dist > 0 && f.dist > 0) {
        // Zoom about the world point under the PREVIOUS midpoint, then pan it
        // to the new midpoint — the standard combined pinch gesture.
        const w = viewport.clientToWorld(pinch.midX, pinch.midY);
        viewport.zoomAt(f.dist / pinch.dist, w.x, w.y);
        const k = cssToWorld();   // after the zoom: midpoint pan is in new-scale px
        viewport.panBy((pinch.midX - f.midX) * k, (pinch.midY - f.midY) * k);
      }
      pinch = f;
    }
  });

  const release = (ev) => {
    if (!pointers.delete(ev.pointerId)) return;
    if (pointers.size === 1) {
      // pinch -> one finger left: keep panning with it
      mode = 'pan';
      const rest = [...pointers.values()][0];
      last = { x: rest.x, y: rest.y };
      pinch = null;
    } else if (pointers.size === 0) {
      if (mode === 'marquee' && marquee) {
        const r = marquee;       // release delivers the final rect exactly once
        marquee = null;
        if (handlers.onMarqueeEnd) handlers.onMarqueeEnd(r);
      }
      suppressClick = dragged;   // the trailing click must not build/select
      mode = 'idle'; press = null; last = null; pinch = null; dragged = false;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // Wheel zooms about the cursor. The exponent keeps discrete notches
  // (deltaY ±100) and smooth trackpad deltas on the same curve.
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const w = viewport.clientToWorld(ev.clientX, ev.clientY);
    viewport.zoomAt(Math.pow(CONFIG.CAMERA.WHEEL_ZOOM_STEP, -ev.deltaY / 100), w.x, w.y);
  }, { passive: false });

  // ---- game intents -------------------------------------------------------------

  canvas.addEventListener('mousemove', (ev) => {
    const c = toCell(ev);
    handlers.onHover && handlers.onHover(c.x, c.y, c.px, c.py);
  });

  canvas.addEventListener('mouseleave', () => {
    handlers.onHoverEnd && handlers.onHoverEnd();
  });

  canvas.addEventListener('click', (ev) => {
    if (suppressClick) { suppressClick = false; return; }   // that "click" was a pan/marquee
    // A plain tap always builds one tower (radial ring) regardless of mode —
    // only a DRAG selects. So drag-to-select never steals single taps.
    const c = toCell(ev);
    handlers.onLeftClick && handlers.onLeftClick(c.x, c.y, c.px, c.py);
  });

  // Right-click commands the hero; suppress the browser context menu.
  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const c = toCell(ev);
    handlers.onRightClick && handlers.onRightClick(c.x, c.y, c.px, c.py);
  });

  window.addEventListener('keydown', (ev) => {
    // Don't steal keys while typing in an input field.
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    const handled = handlers.onKey && handlers.onKey(ev.key);
    if (handled) ev.preventDefault();
  });

  // ---- select mode (U21) --------------------------------------------------------
  return {
    isSelectMode: () => selectMode,
    setSelectMode(on) {
      selectMode = !!on;
      if (!on && mode === 'marquee') {
        // toggled off mid-drag: drop the marquee, let the finger keep panning
        cancelMarquee();
        const rest = [...pointers.values()][0];
        if (rest) { mode = 'pan'; last = { x: rest.x, y: rest.y }; }
        else mode = 'idle';
      }
    },
  };
}
