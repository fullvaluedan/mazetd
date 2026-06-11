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
import { waveInfo } from '../game/wave.js';
import { strongWeak } from '../game/damage.js';
import { heroUpgradeCost, heroUpgradeMaxed, consumableCost, towerBoostCost, towerBoostMaxed } from '../game/shop.js';
import { div, btn, bar, stat, EGLYPH } from './components.js';
import { TopBar } from './topbar.js';
import { WaveBar } from './wavebar.js';
import { Radial, buildRingItems, towerRingItems } from './radial.js';

// Compact strong/weak armor badges for a damage type (e.g. "▲L U  ▼F H").
function badgeHtml(damageType) {
  const sw = strongWeak(damageType);
  const chip = (id) => {
    const a = CONFIG.ARMOR_TYPES[id];
    return a ? `<span style="color:${a.color}">${a.short}</span>` : '';
  };
  const parts = [];
  if (sw.strong.length) parts.push(`<span style="color:#5fce7a">▲</span>${sw.strong.map(chip).join('')}`);
  if (sw.weak.length) parts.push(`<span style="color:#e24b4a">▼</span>${sw.weak.map(chip).join('')}`);
  return parts.join('&nbsp; ');
}

export class HUD {
  // scene (optional): { uiLayer, viewport } — mounts the in-scene widgets
  // (top bar, wave control) over the canvas. Omitted in DOM-shim tests.
  constructor(root, actions, scene = null) {
    this.root = root;
    this.actions = actions;   // { setSpeed, togglePause, togglePath, startWave, ... }
    this.el = {};
    this.topbar = null;
    this.wavebar = null;
    this.radial = null;
    this.build();
    if (scene && scene.uiLayer) {
      this.topbar = new TopBar(scene.uiLayer, actions);
      this.wavebar = new WaveBar(scene.uiLayer, scene.viewport, actions);
      this.radial = new Radial(scene.uiLayer, scene.viewport);
    }
  }

  // Called when the viewport letterbox changes: re-anchor world-pinned widgets.
  onViewportResize() {
    if (this.wavebar) this.wavebar.position();
    if (this.radial) this.radial.close();   // anchors are stale after a resize
  }

  // ---- radial menus (the KR build/upgrade interaction) ----
  get radialOpen() { return !!(this.radial && this.radial.isOpen); }

  openBuildRing(state, x, y) {
    if (!this.radial) return;
    const items = buildRingItems(state, { x, y }, this.actions);   // computes seal warn once
    this.radial.open({ x, y }, items, 'build',
      () => { state.menuCell = null; state.pendingBuild = null; state.menuSeals = false; });
    state.menuCell = { x, y };
    state.menuSeals = items.length > 0 && !!items[0].warn;
    state.pendingBuild = null;
    this.radial.refresh(state);
  }

  openTowerRing(state, tower) {
    if (!this.radial) return;
    this.radial.open({ x: tower.cx, y: tower.cy }, towerRingItems(state, tower, this.actions), 'tower',
      () => { if (state.selected === tower) state.selected = null; });
    state.menuCell = null;
    state.selected = tower;    // (re)select after open — open() closes any prior ring
    this.radial.refresh(state);
  }

  closeRadial() { if (this.radial) this.radial.close(); }

  build() {
    this.root.innerHTML = '';

    // --- title ---
    const title = div('section');
    title.innerHTML = `<div style="font-weight:800;font-size:18px;letter-spacing:.5px">MAZECORE&nbsp;TD</div>
      <div class="muted">Build the maze. Survive 100 waves.</div>`;
    this.root.appendChild(title);

    // (gold/lives/wave + pause/speed + start-wave moved to the in-scene
    //  top bar and wave button — see topbar.js / wavebar.js)

    // --- controls ---
    const controls = div('section');
    controls.innerHTML = `<h3>Controls</h3>`;
    const row2 = div('speed-row');
    this.el.path = btn('Path (P)', () => this.actions.togglePath());
    this.el.art = btn('Art', () => this.actions.toggleArt());
    this.el.save = btn('Save', () => this.actions.save());
    this.el.load = btn('Load', () => this.actions.load());
    row2.append(this.el.path, this.el.art, this.el.save, this.el.load);
    controls.appendChild(row2);
    this.root.appendChild(controls);

    // --- next wave preview ---
    const waveSec = div('section');
    waveSec.innerHTML = `<h3>Next Wave</h3>`;
    this.el.preview = div('muted');
    this.el.preview.style.minHeight = '20px';
    this.el.warn = div('muted');
    this.el.warn.style.color = CONFIG.COLORS.gold;
    this.el.auto = btn('Auto-start: OFF', () => this.actions.toggleAuto());
    this.el.auto.style.width = '100%';
    this.el.auto.style.marginTop = '6px';
    waveSec.append(this.el.preview, this.el.warn, this.el.auto);
    this.root.appendChild(waveSec);

    // (tower shop + selected-tower card replaced by the in-scene radial
    //  menus — tap an empty cell to build, tap a tower to manage it)

    // --- hero panel (hidden until a hero is chosen) ---
    this.buildHeroPanel();

    // --- shop: hero upgrades + consumables ---
    this.buildShop();

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
    if (this.topbar) this.topbar.refresh(state, ui);
    if (this.wavebar) this.wavebar.refresh(state);

    this.el.path.classList.toggle('active', state.showPath);

    // next-wave preview + flying warning
    const nw = state.wave + 1;
    if (nw > CONFIG.WIN_WAVE) {
      this.el.preview.textContent = state.status === 'won' ? 'All 100 waves cleared!' : 'Final wave!';
      this.el.warn.textContent = '';
    } else {
      const info = waveInfo(nw);
      const icons = info.types.map((t) => {
        const e = CONFIG.ENEMIES[t];
        const a = CONFIG.ARMOR_TYPES[e.armorType];
        return `<span style="color:${e.color}">${EGLYPH[t] || '?'}</span><sub style="color:${a ? a.color : '#888'}">${a ? a.short : ''}</sub>`;
      }).join(' ');
      this.el.preview.innerHTML = `<b>Wave ${nw}</b> &nbsp; ${icons} ${info.isBoss ? '&nbsp;<b style="color:#c65bd6">BOSS</b>' : ''} <span class="muted">(${info.count})</span>`;
      this.el.warn.textContent = info.hasFlying ? '⚠ FLYING incoming — bring anti-air!' : '';
    }
    // siege overrides the warn line while any route is sealed
    if (state.siege) {
      this.el.warn.textContent = '⚠ Path sealed — enemies attack your towers!';
      this.el.warn.style.color = CONFIG.COLORS.danger;
    } else {
      this.el.warn.style.color = CONFIG.COLORS.gold;
    }

    this.el.auto.classList.toggle('active', state.autoStart);
    this.el.auto.textContent = 'Auto-start: ' + (state.autoStart ? 'ON' : 'OFF');

    if (this.radial) this.radial.refresh(state);   // live affordability in open rings
    this.refreshHero(state);
    this.refreshShop(state);
  }

  buildShop() {
    // hero stat upgrades (between waves)
    const hu = div('section');
    hu.innerHTML = `<h3>Hero Upgrades <span class="muted" style="font-weight:400">(between waves)</span></h3>`;
    const huGrid = div('tower-grid');
    this.el.heroUpBtns = {};
    for (const [key, def] of Object.entries(CONFIG.HERO_UPGRADES)) {
      const b = document.createElement('button');
      b.style.textAlign = 'left';
      b.addEventListener('click', () => this.actions.heroUpgrade(key));
      this.el.heroUpBtns[key] = b;
      huGrid.appendChild(b);
    }
    hu.appendChild(huGrid);
    this.root.appendChild(hu);

    // global tower boosts (between waves)
    const tb = div('section');
    tb.innerHTML = `<h3>Tower Boosts <span class="muted" style="font-weight:400">(between waves)</span></h3>`;
    const tbGrid = div('tower-grid');
    this.el.towerBoostBtns = {};
    for (const [key, def] of Object.entries(CONFIG.TOWER_BOOSTS)) {
      const b = document.createElement('button');
      b.style.textAlign = 'left';
      b.addEventListener('click', () => this.actions.towerBoost(key));
      this.el.towerBoostBtns[key] = b;
      tbGrid.appendChild(b);
    }
    tb.appendChild(tbGrid);
    this.root.appendChild(tb);

    // consumables (mid-wave)
    const co = div('section');
    co.innerHTML = `<h3>Consumables</h3>`;
    const coGrid = div('tower-grid');
    this.el.consBtns = {};
    for (const [key, def] of Object.entries(CONFIG.CONSUMABLES)) {
      const b = document.createElement('button');
      b.style.textAlign = 'left';
      b.innerHTML = `<b>${def.name}</b><br><span class="muted" style="font-size:10px">${def.desc}</span><br><span class="t-cost">--</span>`;
      b.addEventListener('click', () => this.actions.consumable(key));
      this.el.consBtns[key] = b;
      coGrid.appendChild(b);
    }
    co.appendChild(coGrid);
    this.root.appendChild(co);
  }

  refreshShop(state) {
    const hasHero = !!state.hero;
    for (const [key, def] of Object.entries(CONFIG.HERO_UPGRADES)) {
      const b = this.el.heroUpBtns[key];
      const maxed = hasHero && heroUpgradeMaxed(state, key);
      const cost = hasHero ? heroUpgradeCost(state, key) : def.baseCost;
      const tier = hasHero ? state.heroUpgrades[key] : 0;
      b.innerHTML = `<b>${def.name}</b><br><span class="muted" style="font-size:10px">tier ${tier}/${def.maxTier}</span><br>` +
        (maxed ? `<span class="muted">MAX</span>` : `<span class="t-cost">${cost}g</span>`);
      b.disabled = !hasHero || maxed || state.waveActive || state.gold < cost;
    }
    for (const [key, def] of Object.entries(CONFIG.TOWER_BOOSTS)) {
      const b = this.el.towerBoostBtns[key];
      const maxed = towerBoostMaxed(state, key);
      const cost = towerBoostCost(state, key);
      const tier = state.towerBoosts[key];
      b.innerHTML = `<b>${def.name}</b><br><span class="muted" style="font-size:10px">tier ${tier}/${def.maxTier}</span><br>` +
        (maxed ? `<span class="muted">MAX</span>` : `<span class="t-cost">${cost}g</span>`);
      b.disabled = maxed || state.waveActive || state.gold < cost;
    }
    for (const [key, def] of Object.entries(CONFIG.CONSUMABLES)) {
      const b = this.el.consBtns[key];
      const cost = consumableCost(state, key);
      const costEl = b.querySelector('.t-cost');
      if (costEl) costEl.textContent = `${cost}g`;
      b.disabled = state.gold < cost || state.status === 'won' || state.status === 'lost';
      b.classList.toggle('active', state.targetingConsumable === def);
    }
  }

  buildHeroPanel() {
    const p = div('section');
    p.classList.add('hidden');
    p.innerHTML = `<h3>Hero</h3>`;
    const head = div('');
    head.style.cssText = 'display:flex;gap:8px;align-items:center';
    this.el.heroGlyph = div('');
    this.el.heroGlyph.style.cssText = 'font-size:26px;width:34px;text-align:center';
    const info = div(''); info.style.flex = '1';
    this.el.heroName = div(''); this.el.heroName.style.fontWeight = '700';
    this.el.heroHpBar = bar('hp'); this.el.heroXpBar = bar('xp');
    this.el.heroHpText = div('muted'); this.el.heroHpText.style.fontSize = '11px';
    info.append(this.el.heroName, this.el.heroHpBar.wrap, this.el.heroHpText, this.el.heroXpBar.wrap);
    head.append(this.el.heroGlyph, info);
    p.appendChild(head);

    const abRow = div('ability-row'); abRow.style.marginTop = '8px';
    this.el.abBtns = [];
    for (let i = 0; i < 2; i++) {
      const b = document.createElement('button');
      b.className = 'ability-btn';
      const label = document.createElement('span');
      const cd = document.createElement('div'); cd.className = 'cd';
      b.append(label, cd);
      b.addEventListener('click', () => this.actions.castAbility(i));
      abRow.appendChild(b);
      this.el.abBtns.push({ btn: b, label, cd });
    }
    p.appendChild(abRow);

    // Move command — the touch-friendly substitute for right-click
    this.el.heroMove = btn('Move (M) — then tap the map', () => this.actions.heroMove());
    this.el.heroMove.style.cssText = 'width:100%;margin-top:6px';
    p.appendChild(this.el.heroMove);
    this.el.heroPanel = p;
    this.root.appendChild(p);
  }

  refreshHero(state) {
    const h = state.hero;
    if (!h) { this.el.heroPanel.classList.add('hidden'); return; }
    this.el.heroPanel.classList.remove('hidden');
    // portrait: generated art if available, glyph fallback
    if (this._heroPortraitFor !== h.id) {
      this._heroPortraitFor = h.id;
      this.el.heroGlyph.innerHTML = '';
      const img = document.createElement('img');
      img.alt = '';
      img.style.cssText = 'width:34px;height:34px;display:block;margin:auto';
      img.addEventListener('error', () => { this.el.heroGlyph.textContent = h.def.glyph; });
      img.src = `assets/heroes/${h.id}.png`;
      this.el.heroGlyph.appendChild(img);
    }
    this.el.heroGlyph.style.color = h.def.color;
    this.el.heroName.textContent = `${h.def.name} — L${h.level}` + (h.downed ? `  (down ${Math.ceil(h.respawnLeft)}s)` : '') + (h.buffLeft > 0 ? '  ⤴buffed' : '');
    this.el.heroHpBar.fill.style.width = Math.max(0, 100 * h.hp / h.maxHp) + '%';
    this.el.heroHpText.textContent = `HP ${Math.max(0, Math.ceil(h.hp))}/${h.maxHp}`;
    this.el.heroXpBar.fill.style.width = (h.level >= 10 ? 100 : 100 * h.xp / h.xpToNext()) + '%';
    for (let i = 0; i < 2; i++) {
      const ab = h.abilities[i], ui = this.el.abBtns[i];
      ui.label.textContent = ab.name;
      const frac = ab.cdLeft > 0 ? Math.min(1, ab.cdLeft / (ab.cooldown * h.abilityCdMult)) : 0;
      ui.cd.style.height = (frac * 100) + '%';
      ui.btn.disabled = h.downed || ab.cdLeft > 0;
      ui.btn.classList.toggle('active', state.targetingAbility === ab);
    }
    this.el.heroMove.disabled = h.downed;
    this.el.heroMove.classList.toggle('active', !!state.heroMoveMode);
    this.el.heroMove.textContent = state.heroMoveMode ? 'Tap the map to move…' : 'Move (M) — then tap the map';
  }


  // Lets later phases drop their sections into the panel.
  mount(node) { this.el.shopMount.appendChild(node); }
}

// (DOM helpers div/btn/bar/stat + EGLYPH now live in components.js)
