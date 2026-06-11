// =============================================================================
// infocard.js — the touch-friendly replacement for the cursor tooltip: ONE
// docked card (top-center, under the top bar) that shows whatever the player
// is inspecting. Desktop hover feeds it live; on touch, tapping an enemy (or
// long-pressing a radial item) shows it with an auto-dismiss timer.
// =============================================================================

import { CONFIG } from '../config.js';
import { strongWeak } from '../game/damage.js';
import { getTowerStats } from '../game/tower.js';
import { canBuildAt, wouldSealAt } from '../game/state.js';
import { sellRefund } from '../game/shop.js';
import { div } from './components.js';

const TAP_DISMISS_MS = 5000;

export class InfoCard {
  constructor(uiLayer) {
    this.el = div('infocard hidden');
    uiLayer.appendChild(this.el);
    this._timer = 0;
    this._hover = false;
  }

  // hover: follows the cursor's subject; cleared on hover-end
  showHover(html) {
    if (!html) { if (this._hover) this.hide(); return; }
    this._hover = true;
    this._set(html);
  }
  clearHover() { if (this._hover) this.hide(); }

  // tap: sticky with auto-dismiss (touch flow)
  showTap(html) {
    if (!html) return;
    this._hover = false;
    this._set(html);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.hide(), TAP_DISMISS_MS);
  }

  hide() {
    this._hover = false;
    clearTimeout(this._timer);
    this.el.classList.add('hidden');
  }

  _set(html) {
    if (this._html !== html) { this._html = html; this.el.innerHTML = html; }
    this.el.classList.remove('hidden');
  }
}

// ---- content builders --------------------------------------------------------

function specialText(s) {
  const t = [];
  if (s.splashRadius) t.push(`splash ${s.splashRadius.toFixed(1)}`);
  if (s.slowPct) t.push(`slow ${(s.slowPct * 100) | 0}%/${s.slowDur}s`);
  if (s.dotDps) t.push(`poison ${s.dotDps.toFixed(0)}/s·${s.dotDur}s`);
  if (s.chainTargets) t.push(`chain ${s.chainTargets}`);
  if (s.multishot > 1) t.push(`${s.multishot}× shots`);
  if (s.shatter) t.push(`shatter +${(s.shatter * 100) | 0}%`);
  if (s.disrupt) t.push('dispels shields/regen');
  if (s.contagion) t.push('poison spreads on kill');
  if (s.cluster) t.push('cluster blasts');
  return t.join(' · ');
}

// "strong vs Light, Unarmored · weak vs Fortified" line for a damage type.
export function matchupText(damageType) {
  const sw = strongWeak(damageType);
  const name = (id) => {
    const a = CONFIG.ARMOR_TYPES[id];
    return a ? `<span style="color:${a.color}">${a.name}</span>` : id;
  };
  const parts = [];
  if (sw.strong.length) parts.push(`<span style="color:#5fce7a">strong vs</span> ${sw.strong.map(name).join(', ')}`);
  if (sw.weak.length) parts.push(`<span style="color:#e24b4a">weak vs</span> ${sw.weak.map(name).join(', ')}`);
  return parts.join(' · ');
}

export function enemyCardHtml(e) {
  const at = CONFIG.ARMOR_TYPES[e.armorType];
  const traits = [];
  if (e.flying) traits.push('flying');
  if (at) traits.push(`<span style="color:${at.color}">${at.name} armor</span>`);
  if (e.shieldHp > 0) traits.push(`shield ${Math.ceil(e.shieldHp)}`);
  if (e.def.healPct) traits.push('heals allies');
  if (e.slowTimer > 0) traits.push('slowed');
  if (e.poison.length) traits.push('poisoned');
  if (e.stunTimer > 0) traits.push('stunned');
  if (e.siegeTarget) traits.push('<span style="color:#ff6b66">attacking your wall!</span>');
  const atk = e.def.atk != null ? e.def.atk : 0;
  const atkLine = atk > 0
    ? ` · <span style="color:#ffa500">⚔ wall dmg ×${atk}</span>`
    : (e.flying ? ' · <span class="muted">can\'t attack walls</span>' : '');
  return `<b style="color:${e.color}">${e.name}</b>${e.boss ? ' ★' : ''}<br>
    HP ${Math.ceil(e.hp).toLocaleString()} / ${e.maxHp.toLocaleString()}${atkLine}<br>
    ${traits.length ? traits.join(' · ') + '<br>' : ''}
    <span class="muted">bounty ${e.bounty}g · ${e.damageToLives}♥ if leaked</span>`;
}

export function towerCardHtml(t) {
  const s = t.stats;
  if (t.def.wall) {
    return `<b style="color:${t.def.color}">${t.def.glyph} Wall</b><br>
      HP ${Math.ceil(t.hp)}/${Math.ceil(t.maxHp)} · pure maze block<br>
      <span class="muted">${t.def.blurb} · sell +${sellRefund(t)}g</span>`;
  }
  if (t.def.aura) {
    return `<b style="color:${t.def.color}">${t.def.glyph} ${t.def.name}</b> — L${t.level}${t.branch ? ' ' + t.def.branches[t.branch].name : ''}<br>
      +${Math.round(s.auraDmg * 100)}% dmg · +${Math.round(s.auraSpeed * 100)}% atk speed · radius ${s.auraRange.toFixed(1)}<br>
      <span class="muted">buffs nearby towers · strongest aura wins · sell +${Math.floor(t.invested * CONFIG.SELL_REFUND)}g</span>`;
  }
  const dps = (s.damage * (s.multishot || 1) / s.cooldown).toFixed(1);
  const sp = specialText(s);
  const hp = t.hp < t.maxHp ? `<br><span style="color:#ff6b66">wall HP ${Math.ceil(t.hp)}/${Math.ceil(t.maxHp)}</span>` : '';
  const next = t.canUpgrade() ? `<br><span style="color:#f2c14b">▲ upgrade: ${t.nextUpgradeCost()}g</span>` : '<br><span class="muted">max level</span>';
  return `<b style="color:${t.def.color}">${t.def.glyph} ${t.def.name}</b> — L${t.level}${t.branch ? ' ' + t.def.branches[t.branch].name : ''}<br>
    DMG ${s.damage.toFixed(1)} · RNG ${s.range.toFixed(1)} · CD ${s.cooldown.toFixed(2)}s<br>
    ~DPS ${dps} · ${s.damageType}${s.targetsAir ? ' · hits air' : ''}<br>
    ${matchupText(s.damageType) ? matchupText(s.damageType) + '<br>' : ''}
    ${sp ? sp + '<br>' : ''}
    <span class="muted">target: ${t.targetMode} · sell +${Math.floor(t.invested * CONFIG.SELL_REFUND)}g</span>${hp}${next}`;
}

// Full stat card for a tower TYPE (radial long-press, build preview).
export function typeCardHtml(typeId, verdictHtml = '') {
  const def = CONFIG.TOWERS[typeId];
  const s = getTowerStats(typeId, 1, null);
  if (def.wall) {
    return `<b style="color:${def.color}">${def.glyph} ${def.name}</b> — ${def.cost}g<br>
      Tough maze block (HP ${CONFIG.TOWER_HP.wallBase}). No attack.<br>
      <span class="muted">${def.blurb}</span>${verdictHtml ? '<br>' + verdictHtml : ''}`;
  }
  if (def.aura) {
    return `<b style="color:${def.color}">${def.glyph} ${def.name}</b> — ${def.cost}g<br>
      +${Math.round(s.auraDmg * 100)}% dmg · +${Math.round(s.auraSpeed * 100)}% atk speed · radius ${s.auraRange.toFixed(1)}<br>
      <span class="muted">${def.blurb}</span>${verdictHtml ? '<br>' + verdictHtml : ''}`;
  }
  const dps = (s.damage / s.cooldown).toFixed(1);
  return `<b style="color:${def.color}">${def.glyph} ${def.name}</b> — ${def.cost}g<br>
    DMG ${s.damage} · RNG ${s.range} · CD ${s.cooldown}s · ~DPS ${dps}<br>
    ${s.damageType}${s.targetsAir ? ' · hits air' : ''}<br>
    ${matchupText(s.damageType) ? matchupText(s.damageType) + '<br>' : ''}
    <span class="muted">${def.blurb}</span>${verdictHtml ? '<br>' + verdictHtml : ''}`;
}

// Desktop-hover content: enemy under cursor > tower on cell > armed build preview.
export function hoverCardHtml(state, x, y, px, py) {
  let near = null, nd = Infinity;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d <= e.radius + 5 && d < nd) { nd = d; near = e; }
  }
  if (near) return enemyCardHtml(near);

  const t = (y >= 0 && x >= 0 && state.towerGrid[y] && state.towerGrid[y][x]) || null;
  if (t) return towerCardHtml(t);

  if (state.buildType) {
    let legal = false, seals = false;
    try { legal = canBuildAt(state, x, y); seals = legal && wouldSealAt(state, x, y); } catch { /* edge cells */ }
    const verdict = !legal
      ? '<b style="color:#e24b4a">cannot build here</b>'
      : seals
        ? '<b style="color:#ffa500">⚠ Seals the maze — creeps will attack your towers!</b>'
        : '<b style="color:#5fce7a">click to build</b>';
    return typeCardHtml(state.buildType, verdict);
  }
  return null;
}

// Tap helper: the enemy under a tap point, if any.
export function enemyAt(state, px, py) {
  let near = null, nd = Infinity;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d <= e.radius + 6 && d < nd) { nd = d; near = e; }
  }
  return near;
}
