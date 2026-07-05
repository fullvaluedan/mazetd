// Minimal DOM/Canvas shim so we can smoke-test ui/hud.js and ui/render.js in
// Node (the browser preview isn't available in this environment).
function makeEl(tag = 'div') {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [],
    style: {},
    dataset: {},
    _text: '', _html: '',
    disabled: false,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { cs.forEach((c) => this.children.push(c)); },
    addEventListener() {},
    removeEventListener() {},
    remove() { },
    querySelector() { return makeEl('span'); },   // good enough for .t-cost lookups
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 896, height: 576 }; },
    getContext() { return makeCtx(); },
    width: 896, height: 576,
  };
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; this.children = []; } });
  Object.defineProperty(el, 'textContent', { get() { return this._text; }, set(v) { this._text = String(v); } });
  return el;
}
function makeCtx() {
  const noop = () => {};
  return new Proxy({}, { get: (_t, k) => {
    if (k === 'canvas') return makeEl('canvas');
    return noop;   // every method is a no-op; property sets are ignored
  }, set: () => true });
}
const byId = {};
export function installFakeDom() {
  const doc = {
    body: makeEl('body'),
    createElement: (t) => makeEl(t),
    getElementById: (id) => (byId[id] || (byId[id] = makeEl('div'))),
  };
  global.document = doc;
  global.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 800, requestAnimationFrame() {} };
  global.requestAnimationFrame = () => 0;
  global.performance = global.performance || { now: () => 0 };
  return { doc, byId, makeCtx };
}
