// =============================================================================
// components.js — tiny shared DOM factories + the UI layer/z-index scheme.
//
// Everything chrome-related (top bar, wave button, radial menus, sheets) builds
// from these helpers so the look stays consistent and hud.js stays an
// orchestrator. No framework — plain elements, CSS classes from ui.css.
// =============================================================================

// Layering: canvas 0 < #ui 10 (world-anchored 11, bars 12, banners 13)
// < sheets/modal 20 < ad overlay 30 < rotate overlay 40.
export const Z = {
  WORLD: 11,
  BARS: 12,
  BANNERS: 13,
  SHEET: 20,
  AD: 30,
  ROTATE: 40,
};

export function div(cls, html) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
}

export function btn(label, onClick, cls) {
  const b = document.createElement('button');
  if (cls) b.className = cls;
  b.textContent = label;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export function bar(kind) {
  const wrap = div('bar' + (kind ? ' ' + kind : ''));
  wrap.style.margin = '3px 0';
  const fill = document.createElement('div');
  fill.style.width = '100%';
  wrap.appendChild(fill);
  return { wrap, fill };
}

export function stat(parent, label, valueClass) {
  const s = div('stat');
  const l = div('label'); l.textContent = label;
  const v = div('value' + (valueClass ? ' ' + valueClass : '')); v.textContent = '0';
  s.append(l, v);
  parent.appendChild(s);
  return v;
}

// Tiny glyphs for enemy types (wave preview, incoming chevrons, info cards).
export const EGLYPH = { normal: '●', fast: '»', tank: '▣', swarm: '∴', flyer: '▲', healer: '✚', shield: '◈', boss: '★' };
