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

// Tiny glyphs for the next-wave preview.
const EGLYPH = { normal: '●', fast: '»', tank: '▣', swarm: '∴', flyer: '▲', healer: '✚', shield: '◈', boss: '★' };

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
    this.el.art = btn('Art', () => this.actions.toggleArt());
    this.el.save = btn('Save', () => this.actions.save());
    this.el.load = btn('Load', () => this.actions.load());
    row2.append(this.el.path, this.el.art, this.el.save, this.el.load);
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
    this.el.auto = btn('Auto-start: OFF', () => this.actions.toggleAuto());
    this.el.auto.style.width = '100%';
    this.el.auto.style.marginTop = '6px';
    waveSec.append(this.el.preview, this.el.warn, this.el.start, this.el.auto);
    this.root.appendChild(waveSec);

    // --- tower shop ---
    const shop = div('section');
    shop.innerHTML = `<h3>Towers</h3>`;
    const grid = div('tower-grid');
    this.el.towerBtns = {};
    for (const [id, def] of Object.entries(CONFIG.TOWERS)) {
      const b = document.createElement('button');
      b.className = 'tower-btn';
      const badges = badgeHtml(def.damageType);
      b.innerHTML = `<span class="t-name">${def.glyph} ${def.name}</span>
        <span class="t-cost">${def.cost}g</span>
        <span class="t-blurb">${def.blurb}${badges ? '<br>' + badges : ''}</span>`;
      b.addEventListener('click', () => this.actions.selectBuild(id));
      this.el.towerBtns[id] = b;
      grid.appendChild(b);
    }
    shop.appendChild(grid);
    this.root.appendChild(shop);

    // --- selected-tower / build card (rebuilt when the selection shape changes) ---
    this.el.cardMount = div('');
    this.root.appendChild(this.el.cardMount);

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
    this.el.gold.textContent = Math.floor(state.gold);
    this.el.lives.textContent = state.lives;
    this.el.wave.textContent = `${state.wave}/${CONFIG.WIN_WAVE}`;

    // active speed/pause highlighting
    this.el.pause.classList.toggle('active', ui.paused);
    this.el.s1.classList.toggle('active', !ui.paused && ui.speed === 1);
    this.el.s2.classList.toggle('active', !ui.paused && ui.speed === 2);
    this.el.s3.classList.toggle('active', !ui.paused && ui.speed === 3);
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

    // start button state + early-start bonus
    const bonus = Math.floor(state.buildTimer * CONFIG.EARLY_START_BONUS_PER_SEC);
    this.el.start.disabled = state.waveActive || state.status === 'won' || state.status === 'lost';
    this.el.start.textContent = state.waveActive
      ? 'Wave in progress…'
      : (bonus > 0 ? `Start Wave (S)  +${bonus}g` : 'Start Wave (S)');
    this.el.auto.classList.toggle('active', state.autoStart);
    this.el.auto.textContent = 'Auto-start: ' + (state.autoStart ? 'ON' : 'OFF');

    // tower shop: affordability + which build is armed
    for (const [id, def] of Object.entries(CONFIG.TOWERS)) {
      const b = this.el.towerBtns[id];
      b.disabled = state.gold < def.cost && state.buildType !== id;
      b.classList.toggle('active', state.buildType === id);
    }

    this.refreshCard(state);
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

  // Rebuild the card DOM only when the selection "shape" changes; update the
  // cheap dynamic bits (affordability) every frame.
  refreshCard(state) {
    const t = state.selected;
    const key = t
      ? `t${t.uid}:${t.level}:${t.branch}:${t.targetMode}`
      : (state.buildType ? `b:${state.buildType}` : 'none');
    if (key !== this._cardKey) { this._cardKey = key; this.renderCard(state); }
    if (t) {
      // refresh upgrade-button affordability live
      if (this._upBtns) for (const ub of this._upBtns) ub.btn.disabled = state.gold < ub.cost;
    }
  }

  renderCard(state) {
    const mount = this.el.cardMount;
    mount.innerHTML = '';
    this._upBtns = [];
    const t = state.selected;

    if (!t) {
      if (state.buildType) {
        const def = CONFIG.TOWERS[state.buildType];
        const card = div('section');
        card.innerHTML = `<h3>Place ${def.name}</h3>
          <div class="muted">Click a legal cell (green) to build for
          <span style="color:${CONFIG.COLORS.gold}">${def.cost}g</span>.
          Red = would block the path. <span class="kbd">Esc</span> to cancel.</div>`;
        mount.appendChild(card);
      }
      return;
    }

    const s = t.stats;
    const card = div('section');
    const dps = s.cooldown > 0 ? (s.damage * (s.multishot || 1) / s.cooldown) : s.damage;
    const special = [];
    if (s.splashRadius) special.push(`splash ${s.splashRadius.toFixed(1)}`);
    if (s.slowPct) special.push(`slow ${(s.slowPct * 100) | 0}% / ${s.slowDur}s`);
    if (s.dotDps) special.push(`poison ${s.dotDps.toFixed(0)}/s · ${s.dotDur}s`);
    if (s.chainTargets) special.push(`chain ${s.chainTargets}`);
    if (s.multishot > 1) special.push(`${s.multishot}× shots`);
    if (s.shatter) special.push(`shatter +${(s.shatter * 100) | 0}%`);
    if (s.disrupt) special.push('dispels');
    if (s.contagion) special.push('contagion');
    if (s.cluster) special.push('cluster');

    card.innerHTML = `<h3>${t.def.glyph} ${t.def.name} — L${t.level}${t.branch ? ' ' + t.def.branches[t.branch].name : ''}</h3>
      <div class="muted" style="line-height:1.6">
        DMG ${s.damage.toFixed(1)} · RNG ${s.range.toFixed(1)} · CD ${s.cooldown.toFixed(2)}s<br>
        ~DPS ${dps.toFixed(1)} · ${s.damageType}${s.targetsAir ? ' · air✔' : ' · ground'} ${badgeHtml(s.damageType)}<br>
        ${special.length ? special.join(' · ') : '—'}
      </div>`;

    // target mode toggle
    const tmRow = div('speed-row');
    tmRow.style.marginTop = '6px';
    const tmBtn = document.createElement('button');
    tmBtn.style.flex = '1';
    tmBtn.textContent = 'Target: ' + t.targetMode;
    tmBtn.addEventListener('click', () => this.actions.cycleTarget());
    tmRow.appendChild(tmBtn);
    card.appendChild(tmRow);

    // upgrade button(s)
    if (t.canUpgrade()) {
      const cost = t.nextUpgradeCost();
      if (t.level < 3) {
        const up = document.createElement('button');
        up.style.width = '100%'; up.style.marginTop = '6px';
        up.textContent = `Upgrade → L${t.level + 1} (${cost}g)`;
        up.addEventListener('click', () => this.actions.upgrade(null));
        card.appendChild(up);
        this._upBtns.push({ btn: up, cost });
      } else {
        // L3 -> L4 fork: two branch choices
        const label = div('muted');
        label.style.margin = '6px 0 2px';
        label.textContent = `Choose specialization (${cost}g):`;
        card.appendChild(label);
        for (const key of ['A', 'B']) {
          const br = t.def.branches[key];
          const ub = document.createElement('button');
          ub.style.width = '100%'; ub.style.marginTop = '4px';
          ub.style.textAlign = 'left';
          ub.innerHTML = `<b>${br.name}</b><br><span class="muted" style="font-size:11px">${br.desc}</span>`;
          ub.addEventListener('click', () => this.actions.upgrade(key));
          card.appendChild(ub);
          this._upBtns.push({ btn: ub, cost });
        }
      }
    }

    // sell
    const sell = document.createElement('button');
    sell.className = 'danger';
    sell.style.width = '100%'; sell.style.marginTop = '6px';
    const refund = Math.floor(t.invested * CONFIG.SELL_REFUND);
    sell.textContent = `Sell (+${refund}g)`;
    sell.addEventListener('click', () => this.actions.sell());
    card.appendChild(sell);

    mount.appendChild(card);
  }

  // Lets later phases drop their sections into the panel.
  mount(node) { this.el.shopMount.appendChild(node); }
}

// ---- tiny DOM helpers ----
function div(cls) { const d = document.createElement('div'); if (cls) d.className = cls; return d; }
function btn(label, onClick) { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', onClick); return b; }
function bar(kind) {
  const wrap = div('bar' + (kind ? ' ' + kind : ''));
  wrap.style.margin = '3px 0';
  const fill = document.createElement('div');
  fill.style.width = '100%';
  wrap.appendChild(fill);
  return { wrap, fill };
}
function stat(parent, label, valueClass) {
  const s = div('stat');
  const l = div('label'); l.textContent = label;
  const v = div('value' + (valueClass ? ' ' + valueClass : '')); v.textContent = '0';
  s.append(l, v);
  parent.appendChild(s);
  return v;
}
