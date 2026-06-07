// =============================================================================
// hud.js — the HTML/CSS side panel (everything that is NOT the canvas).
//
// Built once into #hud, then refresh(state, ui) is called every frame to update
// the live values cheaply (text content / disabled flags only — no re-layout).
// Sections are added phase by phase: Phase 2 ships the stat readout, the
// pause/speed controls and the Start-Wave button. Later phases add the tower
// shop, the selected-tower card, the hero panel and the consumables shop.
// =============================================================================

import { CONFIG } from '../config.js';

export class HUD {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;   // { setSpeed, togglePause, togglePath, startWave, ... }
    this.el = {};
    this.build();
  }

  build() {
    this.root.innerHTML = '';

    // --- title ---
    const title = div('section');
    title.innerHTML = `<div style="font-weight:800;font-size:18px;letter-spacing:.5px">MAZECORE&nbsp;TD</div>
      <div class="muted">Build the maze. Survive 100 waves.</div>`;
    this.root.appendChild(title);

    // --- stat readout ---
    const stats = div('hud-row');
    this.el.gold = stat(stats, 'Gold', 'gold');
    this.el.lives = stat(stats, 'Lives', 'lives');
    this.el.wave = stat(stats, 'Wave', '');
    this.root.appendChild(stats);

    // --- controls: pause + speeds ---
    const controls = div('section');
    controls.innerHTML = `<h3>Controls</h3>`;
    const row = div('speed-row');
    this.el.pause = btn('▮▮', () => this.actions.togglePause());
    this.el.s1 = btn('1×', () => this.actions.setSpeed(1));
    this.el.s2 = btn('2×', () => this.actions.setSpeed(2));
    this.el.s3 = btn('3×', () => this.actions.setSpeed(3));
    row.append(this.el.pause, this.el.s1, this.el.s2, this.el.s3);
    controls.appendChild(row);
    const row2 = div('speed-row');
    row2.style.marginTop = '6px';
    this.el.path = btn('Path (P)', () => this.actions.togglePath());
    row2.append(this.el.path);
    controls.appendChild(row2);
    this.root.appendChild(controls);

    // --- next wave + start ---
    const waveSec = div('section');
    waveSec.innerHTML = `<h3>Next Wave</h3>`;
    this.el.preview = div('muted');
    this.el.preview.style.minHeight = '20px';
    this.el.warn = div('muted');
    this.el.warn.style.color = CONFIG.COLORS.gold;
    this.el.start = btn('Start Wave (S)', () => this.actions.startWave());
    this.el.start.className = 'primary';
    this.el.start.style.width = '100%';
    this.el.start.style.marginTop = '6px';
    waveSec.append(this.el.preview, this.el.warn, this.el.start);
    this.root.appendChild(waveSec);

    // placeholder containers that later phases populate
    this.el.shopMount = div('');
    this.root.appendChild(this.el.shopMount);

    // --- help footer ---
    const help = div('section');
    help.innerHTML = `<h3>Help</h3><div class="muted" style="line-height:1.5">
      <span class="kbd">L-click</span> build/select &nbsp;
      <span class="kbd">R-click</span> move hero<br>
      <span class="kbd">P</span> path &nbsp; <span class="kbd">Space</span> pause &nbsp;
      <span class="kbd">1/2/3</span> speed &nbsp; <span class="kbd">S</span> start &nbsp;
      <span class="kbd">Esc</span> cancel</div>`;
    this.root.appendChild(help);
  }

  refresh(state, ui) {
    this.el.gold.textContent = Math.floor(state.gold);
    this.el.lives.textContent = state.lives;
    this.el.wave.textContent = `${state.wave}/${CONFIG.WIN_WAVE}`;

    // active speed/pause highlighting
    this.el.pause.classList.toggle('active', ui.paused);
    this.el.s1.classList.toggle('active', !ui.paused && ui.speed === 1);
    this.el.s2.classList.toggle('active', !ui.paused && ui.speed === 2);
    this.el.s3.classList.toggle('active', !ui.paused && ui.speed === 3);
    this.el.path.classList.toggle('active', state.showPath);

    // start button state
    this.el.start.disabled = state.waveActive || state.status === 'won' || state.status === 'lost';
    this.el.start.textContent = state.waveActive ? 'Wave in progress…' : 'Start Wave (S)';
  }

  // Lets later phases drop their sections into the panel.
  mount(node) { this.el.shopMount.appendChild(node); }
}

// ---- tiny DOM helpers ----
function div(cls) { const d = document.createElement('div'); if (cls) d.className = cls; return d; }
function btn(label, onClick) { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', onClick); return b; }
function stat(parent, label, valueClass) {
  const s = div('stat');
  const l = div('label'); l.textContent = label;
  const v = div('value' + (valueClass ? ' ' + valueClass : '')); v.textContent = '0';
  s.append(l, v);
  parent.appendChild(s);
  return v;
}
