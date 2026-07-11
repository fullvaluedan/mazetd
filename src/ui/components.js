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

export { icon, setIconButton } from './icons.js';

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

export function lockSurface(root, onEscape = null) {
  const shell = typeof document !== 'undefined' ? document.getElementById('battle-shell') : null;
  const invoker = typeof document !== 'undefined' ? document.activeElement : null;
  if (shell) shell.inert = true;
  const focusable = () => [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
  const onKey = (event) => {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault(); event.stopPropagation(); onEscape(); return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  root.addEventListener('keydown', onKey);
  setTimeout(() => { const first = focusable()[0]; if (first && first.focus) first.focus(); }, 0);
  return () => {
    root.removeEventListener('keydown', onKey);
    if (shell) shell.inert = false;
    if (invoker && invoker.focus) invoker.focus();
  };
}

// Tiny glyphs for enemy types (wave preview, incoming chevrons, info cards).
export const EGLYPH = { normal: '●', fast: '»', tank: '▣', swarm: '∴', flyer: '▲', healer: '✚', shield: '◈', boss: '★' };
