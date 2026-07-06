// =============================================================================
// input.js — translates raw mouse/keyboard events into game intents.
//
// All pointer math routes through viewport.clientToWorld — the ONE shared
// client->world mapping (letterbox + DPR + camera pan/zoom) — so hover/click
// coordinates can never disagree with the renderer. Callers pass a `handlers`
// object; this module stays ignorant of game rules.
// =============================================================================

import { SIZE } from './grid.js';

export function setupInput(canvas, handlers, viewport) {
  function toCell(ev) {
    // Shared mapping: client px -> world px (camera-aware), then -> cell.
    const { x: px, y: py } = viewport.clientToWorld(ev.clientX, ev.clientY);
    return { x: Math.floor(px / SIZE), y: Math.floor(py / SIZE), px, py };
  }

  canvas.addEventListener('mousemove', (ev) => {
    const c = toCell(ev);
    handlers.onHover && handlers.onHover(c.x, c.y, c.px, c.py);
  });

  canvas.addEventListener('mouseleave', () => {
    handlers.onHoverEnd && handlers.onHoverEnd();
  });

  canvas.addEventListener('click', (ev) => {
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
}
