// =============================================================================
// input.js — translates raw mouse/keyboard events into game intents.
//
// The canvas is drawn at a fixed 896x576 but CSS may scale it down to fit, so we
// convert client pixels back into canvas space (and then into cell coords) using
// the element's bounding rect. Callers pass a `handlers` object; this module
// stays ignorant of game rules.
// =============================================================================

import { SIZE } from './grid.js';

export function setupInput(canvas, handlers) {
  function toCell(ev) {
    const rect = canvas.getBoundingClientRect();
    // Map client px -> canvas px (account for CSS scaling), then -> cell.
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const px = (ev.clientX - rect.left) * sx;
    const py = (ev.clientY - rect.top) * sy;
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
