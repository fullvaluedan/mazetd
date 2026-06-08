// =============================================================================
// tooltips.js — a single floating tooltip that follows the cursor.
//
// Kept dumb on purpose: it only knows how to show/hide an HTML string near the
// mouse. main.js decides WHAT to show (tower stats, build preview, enemy info)
// based on what the cursor is over, and calls set(html) / set(null).
// =============================================================================

export class Tooltip {
  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;pointer-events:none;z-index:50;max-width:250px;' +
      'background:rgba(18,21,29,0.96);border:1px solid #2c3240;border-radius:6px;' +
      'padding:8px 10px;font:12px Segoe UI,sans-serif;color:#e8ecf3;display:none;line-height:1.5;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.4)';
    document.body.appendChild(this.el);
    this.mx = 0; this.my = 0;
    window.addEventListener('mousemove', (e) => {
      this.mx = e.clientX; this.my = e.clientY;
      if (this.el.style.display !== 'none') this.position();
    });
  }

  set(html) {
    if (!html) { this.el.style.display = 'none'; return; }
    this.el.innerHTML = html;
    this.el.style.display = 'block';
    this.position();
  }

  position() {
    const pad = 14;
    const r = this.el.getBoundingClientRect();
    let x = this.mx + pad, y = this.my + pad;
    if (x + r.width > window.innerWidth) x = this.mx - r.width - pad;
    if (y + r.height > window.innerHeight) y = this.my - r.height - pad;
    this.el.style.left = Math.max(0, x) + 'px';
    this.el.style.top = Math.max(0, y) + 'px';
  }
}
