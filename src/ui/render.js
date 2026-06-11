// =============================================================================
// render.js — all canvas drawing. Everything is drawn from flat shapes + the
// CONFIG palette so the placeholder art looks intentional, not broken.
//
// This is the single place that reads game state and paints a frame. It never
// mutates state. Phases add more layers (enemies, towers, projectiles, hero,
// effects) but the structure stays: background -> map -> overlays -> entities ->
// effects -> cursor.
// =============================================================================

import { CONFIG } from '../config.js';
import { CELL, COLS, ROWS, SIZE, cellCenter, cellCenterX, cellCenterY, worldW, worldH } from '../engine/grid.js';
import { canBuildAt, wouldSealAt } from '../game/state.js';
import { getSprite } from './sprites.js';

const C = CONFIG.COLORS;

export function render(ctx, state) {
  // screen shake (juice): jitter the whole world layer
  const shaking = state.shake > 0.1;
  if (shaking) {
    ctx.save();
    const m = state.shake;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  drawBackground(ctx);
  drawMap(ctx, state);
  if (state.showPath) drawPaths(ctx, state);
  drawSpawnGoalMarkers(ctx, state);
  drawTowers(ctx, state);
  drawEnemies(ctx, state);
  drawProjectiles(ctx, state);
  drawEffects(ctx, state);
  drawParticles(ctx, state);
  drawSelected(ctx, state);
  drawHero(ctx, state);
  drawFloaters(ctx, state);
  drawHover(ctx, state);
  drawMenuCell(ctx, state);
  drawAbilityTarget(ctx, state);
  if (shaking) ctx.restore();

  // these stay screen-fixed (not shaken)
  drawBossBars(ctx, state);
  if (state.flash > 0) drawFlash(ctx, state);
}

function drawParticles(ctx, state) {
  if (!state.particles) return;
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function drawHero(ctx, state) {
  const h = state.hero;
  if (!h) return;

  if (h.downed) {
    // ghost + respawn countdown at the base
    const c = cellCenter(h.baseCell.x, h.baseCell.y);
    ctx.globalAlpha = 0.4;
    drawHeroShape(ctx, c.x, c.y, h.def.color, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.text;
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`↻ ${Math.ceil(h.respawnLeft)}s`, c.x, c.y - 16);
    ctx.textAlign = 'left';
    return;
  }

  // move-target marker
  if (h.moveTarget) {
    const m = cellCenter(h.moveTarget.x, h.moveTarget.y);
    ctx.strokeStyle = withAlpha(h.def.color, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, 6 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  // move-mode indicator: pulsing ring + "tap to move" affordance
  if (state.heroSelected) {
    ctx.strokeStyle = 'rgba(255,224,138,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 16 + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // attack range (faint) + hawk-eye buff glow
  ctx.strokeStyle = withAlpha(h.def.color, h.buffLeft > 0 ? 0.45 : 0.18);
  ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.arc(h.x, h.y, h.range * SIZE, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // cosmetic: walk bob while moving (orders OR auto-chase), idle breathe,
  // facing flip, melee lunge toward the target, hit flash when swarmed
  const heroMoving = !!(h.moveTarget || h.path);
  if (h._lastX != null && Math.abs(h.x - h._lastX) > 0.2) h._face = h.x < h._lastX ? -1 : 1;
  h._lastX = h.x;
  const heroBob = heroMoving
    ? -Math.abs(Math.sin(state.time * 9)) * 2.5
    : Math.sin(state.time * 2) * 1.1;
  const lungeK = h.lunge > 0 ? (h.lunge / 0.18) * 6 : 0;
  const lx = Math.cos(h.angle) * lungeK, ly = Math.sin(h.angle) * lungeK;
  if (h.hitFlash > 0) {
    ctx.strokeStyle = `rgba(255,90,80,${Math.min(1, h.hitFlash / 0.08)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  const heroFrame = heroMoving ? Math.floor(state.time * 7) % 4 : 0;
  const heroSprite = getSprite('hero-' + h.id, heroFrame);
  if (heroSprite) {
    ctx.save();
    ctx.translate(h.x + lx, h.y + heroBob + ly);
    ctx.scale(h._face || 1, 1);
    const s = 34;
    ctx.drawImage(heroSprite, -s / 2, -s / 2, s, s);
    ctx.restore();
  } else {
    drawHeroShape(ctx, h.x + lx, h.y + heroBob + ly, h.def.color, h.angle);
  }

  // HP bar + level
  const bw = 26, bx = h.x - bw / 2, by = h.y - 18;
  ctx.fillStyle = C.hpBack; ctx.fillRect(bx, by, bw, 4);
  ctx.fillStyle = '#5fce7a'; ctx.fillRect(bx, by, bw * Math.max(0, h.hp / h.maxHp), 4);
  ctx.fillStyle = '#ffe08a';
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('L' + h.level, h.x, by - 3);
  ctx.textAlign = 'left';
}

function drawHeroShape(ctx, x, y, color, angle) {
  ctx.save();
  ctx.translate(x, y);
  // diamond body
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0c0e14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11); ctx.lineTo(9, 0); ctx.lineTo(0, 11); ctx.lineTo(-9, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // facing nub
  ctx.fillStyle = '#0c0e14';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 7, Math.sin(angle) * 7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAbilityTarget(ctx, state) {
  if (!state.targetingAbility && !state.targetingConsumable) return;
  if (!state.hover) return;
  const { x, y } = state.hover;
  const c = cellCenter(x, y);
  const radius = state.targetingAbility ? state.targetingAbility.radius
    : (state.targetingConsumable && state.targetingConsumable.radius) || 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,224,138,0.8)';
  ctx.fillStyle = 'rgba(255,224,138,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(c.x, c.y, radius * SIZE, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawBossBars(ctx, state) {
  const bosses = state.enemies.filter((e) => e.alive && e.boss);
  if (bosses.length === 0) return;
  const bw = 360, bh = 14;
  let y = 10;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  for (const b of bosses) {
    const x = (worldW() - bw) / 2;
    ctx.fillStyle = 'rgba(12,14,20,0.85)';
    roundRect(ctx, x - 2, y - 2, bw + 4, bh + 4, 4); ctx.fill();
    ctx.fillStyle = '#3a1f3f';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#c65bd6';
    ctx.fillRect(x, y, bw * Math.max(0, b.hp / b.maxHp), bh);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${b.name}  ${Math.ceil(b.hp).toLocaleString()} / ${b.maxHp.toLocaleString()}`, worldW() / 2, y + bh - 3);
    y += bh + 6;
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawBackground(ctx) {
  const bgImg = getSprite('misc-background');
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, worldW(), worldH());
    // dim slightly so entities and the grid stay readable on painted terrain
    ctx.fillStyle = 'rgba(18,21,29,0.35)';
    ctx.fillRect(0, 0, worldW(), worldH());
  } else {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, worldW(), worldH());
  }
  ctx.strokeStyle = C.gridLine;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * SIZE + 0.5, 0);
    ctx.lineTo(x * SIZE + 0.5, worldH());
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * SIZE + 0.5);
    ctx.lineTo(worldW(), y * SIZE + 0.5);
    ctx.stroke();
  }
}

function drawMap(ctx, state) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = state.map.cells[y][x];
      if (t === CELL.BORDER) {
        ctx.fillStyle = C.border;
        ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
      } else if (t === CELL.OBSTACLE) {
        drawObstacle(ctx, x, y);
      }
    }
  }
}

function drawObstacle(ctx, x, y) {
  const px = x * SIZE, py = y * SIZE, pad = 2, r = 5;
  roundRect(ctx, px + pad, py + pad, SIZE - pad * 2, SIZE - pad * 2, r);
  ctx.fillStyle = C.obstacle;
  ctx.fill();
  // subtle inner highlight
  ctx.fillStyle = C.obstacleHi;
  roundRect(ctx, px + pad + 2, py + pad + 2, SIZE - pad * 2 - 4, (SIZE - pad * 2) / 2.4, 3);
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPaths(ctx, state) {
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -(state.time * 24) % 12;   // gentle marching dashes
  ctx.strokeStyle = C.path;
  for (const s of state.map.spawns) {
    const path = state.paths[s.id];
    if (!path || path.length < 2) continue;
    ctx.beginPath();
    const start = cellCenter(path[0].x, path[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < path.length; i++) {
      const p = cellCenter(path[i].x, path[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpawnGoalMarkers(ctx, state) {
  ctx.save();
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const s of state.map.spawns) {
    const c = cellCenter(s.cx, s.cy);
    // green diamond
    ctx.fillStyle = C.spawn;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 9);
    ctx.lineTo(c.x + 9, c.y);
    ctx.lineTo(c.x, c.y + 9);
    ctx.lineTo(c.x - 9, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0c0e14';
    ctx.fillText(s.id, c.x, c.y + 0.5);
  }

  for (const g of state.map.goals) {
    const c = cellCenter(g.cx, g.cy);
    // red ring
    ctx.strokeStyle = C.goal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.goal;
    ctx.fillText(g.id, c.x, c.y + 0.5);
  }

  // checkpoint flags (Gem TD): gold banner on a pole, numbered, gentle wave
  const cps = state.map.checkpoints || [];
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    const c = cellCenter(cp.cx, cp.cy);
    const wave = Math.sin(state.time * 3 + i) * 2;
    ctx.strokeStyle = '#7a5a2e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(c.x - 4, c.y + 12);
    ctx.lineTo(c.x - 4, c.y - 12);
    ctx.stroke();
    ctx.fillStyle = '#ffd35c';
    ctx.beginPath();
    ctx.moveTo(c.x - 3, c.y - 12);
    ctx.lineTo(c.x + 12 + wave, c.y - 8);
    ctx.lineTo(c.x - 3, c.y - 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2106';
    ctx.font = 'bold 9px Segoe UI, sans-serif';
    ctx.fillText(String(i + 1), c.x + 3, c.y - 7.5);
    ctx.font = 'bold 11px Segoe UI, sans-serif';
  }
  ctx.restore();
}

function drawTowers(ctx, state) {
  for (const t of state.towers) {
    const px = t.cx * SIZE, py = t.cy * SIZE;
    const cx = cellCenterX(t.cx), cy = cellCenterY(t.cy);
    const sprite = getSprite('tower-' + t.type);

    // cosmetic: build pop-in + recoil kick opposite the shot direction
    const age = state.time - (t.builtAt != null ? t.builtAt : -10);
    const pop = age < 0.22 ? 0.55 + 0.45 * (age / 0.22) : 1;
    let rx = 0, ry = 0;
    if (t.muzzle > 0 && !t.def.aura) {
      const r = (t.muzzle / 0.08) * 2.2;
      rx = -Math.cos(t.angle) * r; ry = -Math.sin(t.angle) * r;
    }
    if (age >= 0 && age < 0.3) {                  // build dust ring
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - age / 0.3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + (age / 0.3) * 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (sprite) {
      // sprite art: draw slightly larger than the cell for presence
      const s = (SIZE + 6) * pop;
      ctx.drawImage(sprite, cx - s / 2 + rx, cy - s / 2 - 2 + ry, s, s);
    } else {
      const pad = 3, r = 6;
      // base body
      roundRect(ctx, px + pad, py + pad, SIZE - pad * 2, SIZE - pad * 2, r);
      ctx.fillStyle = t.def.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // barrel pointing at the last target
      ctx.strokeStyle = '#0c0e14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(t.angle) * 11, cy + Math.sin(t.angle) * 11);
      ctx.stroke();

      // glyph
      ctx.fillStyle = '#0c0e14';
      ctx.font = 'bold 13px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.def.glyph, cx, cy - 1);
    }

    // muzzle flash (both modes)
    if (t.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,240,180,0.9)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(t.angle) * 12, cy + Math.sin(t.angle) * 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // siege: red outline while being chewed + HP bar once damaged
    if (t.underAttack > 0) {
      ctx.strokeStyle = `rgba(226,75,74,${Math.min(1, t.underAttack / 0.2)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1.5, py + 1.5, SIZE - 3, SIZE - 3);
    }
    if (t.hp < t.maxHp) {
      const frac = Math.max(0, t.hp / t.maxHp);
      ctx.fillStyle = C.hpBack;
      ctx.fillRect(px + 4, py + SIZE - 4, SIZE - 8, 3);
      ctx.fillStyle = frac > 0.4 ? C.hpFront : C.danger;
      ctx.fillRect(px + 4, py + SIZE - 4, (SIZE - 8) * frac, 3);
    }

    // level pips along the bottom
    const pips = t.level;
    for (let i = 0; i < pips; i++) {
      ctx.fillStyle = i === 3 ? '#ffe08a' : '#0c0e14';
      ctx.beginPath();
      ctx.arc(px + 7 + i * 6, py + SIZE - 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // branch letter at L4
    if (t.branch) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = 'bold 9px Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(t.branch, px + SIZE - 4, py + 9);
    }
    // Beacons pulse softly; buffed towers get a small pink pip
    if (t.def.aura) {
      const pulse = 0.25 + 0.15 * Math.sin(state.time * 3);
      ctx.strokeStyle = withAlpha(t.def.color, pulse);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    } else if (t.buffDmg > 0 || t.buffSpeed > 0) {
      ctx.fillStyle = '#e08ac8';
      ctx.beginPath();
      ctx.arc(px + SIZE - 6, py + SIZE - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function drawProjectiles(ctx, state) {
  for (const p of state.projectiles) {
    // oriented streak along the velocity + bright head
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const heavy = p.stats.splashRadius > 0;
    const len = heavy ? 7 : 10;
    ctx.strokeStyle = withAlpha(p.color, 0.5);
    ctx.lineWidth = heavy ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(p.x - (dx / d) * len, p.y - (dy / d) * len);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, heavy ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects(ctx, state) {
  for (const e of state.effects) {
    const a = Math.max(0, e.life / e.max);
    if (e.kind === 'beam') {
      ctx.strokeStyle = withAlpha(e.color, a);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    } else if (e.kind === 'chain') {
      ctx.strokeStyle = withAlpha(e.color, a);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < e.points.length; i++) {
        const pt = e.points[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    } else if (e.kind === 'splash') {
      ctx.strokeStyle = withAlpha(e.color, a * 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * SIZE * (1 - a * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === 'spark') {
      ctx.fillStyle = withAlpha(e.color, a);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3 * a + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSelected(ctx, state) {
  const t = state.selected;
  if (!t || !t.stats) return;
  // highlight border
  ctx.strokeStyle = C.rangeRing;
  ctx.lineWidth = 2;
  ctx.strokeRect(t.cx * SIZE + 1, t.cy * SIZE + 1, SIZE - 2, SIZE - 2);
  if (t.def.aura) {
    // aura coverage (NOT affected by the shop range boost) + a faint fill
    const r = t.stats.auraRange * SIZE;
    const cx = cellCenterX(t.cx), cy = cellCenterY(t.cy);
    ctx.fillStyle = withAlpha(t.def.color, 0.10 + 0.04 * Math.sin(state.time * 3));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(t.def.color, 0.6);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  // show the boosted range, matching what targeting actually uses
  drawRangeRing(ctx, t.cx, t.cy, t.effectiveRange ? t.effectiveRange(state) : t.stats.range);
}

function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    if (!e.alive) continue;
    let ey = e.y;
    if (e.flying) {
      // soft shadow on the ground + gentle bob
      ey = e.y + Math.sin(state.time * 3 + e.bob) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.radius + 4, e.radius * 0.8, e.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // healer aura
    if (e.def.healPct && !e.disrupted) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
      ctx.strokeStyle = `rgba(95,206,122,${0.12 + 0.12 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, ey, e.def.healRadius * SIZE * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- animated body ------------------------------------------------------
    // All purely cosmetic, driven by state.time + per-enemy phase (e.bob):
    // walk bob/waddle, horizontal facing, hit squash, spawn pop, siege chomp.
    const slowF = e.slowTimer > 0 ? (1 - e.slowPct) : 1;
    const stepHz = 1.6 * e.speed * slowF;
    const phase = state.time * stepHz * Math.PI * 2 + e.bob * 7;
    const moving = !e.flying && !e.siegeTarget && e.stunTimer <= 0 &&
      (Math.abs(e.targetCenter.x - e.x) > 0.5 || Math.abs(e.targetCenter.y - e.y) > 0.5);

    // facing: remember the last meaningful horizontal direction
    const fdx = e.targetCenter.x - e.x;
    if (Math.abs(fdx) > 0.5) e._face = fdx < 0 ? -1 : 1;

    // spawn pop-in with a slight overshoot
    const age = state.time - (e.spawnedAt || 0);
    const pop = age < 0.25 ? (age / 0.25) * (1.25 - 0.25 * (age / 0.25)) : 1;

    // hit squash + walk bob/tilt + siege lunge
    let sqX = 1, sqY = 1, bobY = 0, tilt = 0, lungeX = 0, lungeY = 0;
    if (e.hitFlash > 0) { const f = e.hitFlash / 0.12; sqX = 1 + 0.22 * f; sqY = 1 - 0.26 * f; }
    if (moving) {
      bobY = -Math.abs(Math.sin(phase)) * Math.min(3, e.radius * 0.28);
      tilt = Math.sin(phase) * 0.09;
    }
    if (e.siegeTarget) {
      const a = Math.atan2(e.siegeTarget.py - ey, e.siegeTarget.px - e.x);
      const l = Math.max(0, Math.sin(state.time * 7 + e.bob)) * 4;
      lungeX = Math.cos(a) * l; lungeY = Math.sin(a) * l;
    }

    const frame = moving ? Math.floor(state.time * stepHz * 4 + e.bob) % 4 : 0;
    const sprite = getSprite('enemy-' + e.type, frame);

    ctx.save();
    ctx.translate(e.x + lungeX, ey + bobY + lungeY);
    if (tilt) ctx.rotate(tilt);
    ctx.scale((e._face || 1) * pop * sqX, pop * sqY);
    if (sprite) {
      const s = e.radius * 2.6;   // sprites carry whitespace; oversize a bit
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
    } else {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      if (e.boss) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.restore();

    // boss name (both modes)
    if (e.boss) {
      ctx.fillStyle = C.text;
      ctx.font = 'bold 11px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.name, e.x, ey - e.radius - 10);
      ctx.textAlign = 'left';
    }

    // shield ring
    if (e.shieldHp > 0) {
      ctx.strokeStyle = 'rgba(120,170,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, ey, e.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // status outlines: slow (cyan) / poison (green) / stun (white dashes)
    if (e.slowTimer > 0) outline(ctx, e.x, ey, e.radius + 1.5, 'rgba(110,200,255,0.9)');
    if (e.poison.length) outline(ctx, e.x, ey, e.radius + 3.5, 'rgba(120,210,90,0.85)');
    if (e.stunTimer > 0) outline(ctx, e.x, ey, e.radius + 5.5, 'rgba(255,255,255,0.7)');

    // hp bar (skip for full-hp tiny swarm to reduce clutter)
    if (e.hp < e.maxHp || e.boss) {
      const bw = Math.max(14, e.radius * 2);
      const bx = e.x - bw / 2, by = ey - e.radius - 7;
      ctx.fillStyle = C.hpBack;
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = e.boss ? '#e24b4a' : C.hpFront;
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
}

function outline(ctx, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFloaters(ctx, state) {
  ctx.save();
  ctx.font = 'bold 12px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function drawFlash(ctx, state) {
  ctx.fillStyle = `rgba(226,75,74,${0.35 * state.flash})`;
  ctx.fillRect(0, 0, worldW(), worldH());
}

function drawHover(ctx, state) {
  if (!state.hover) return;
  const { x, y } = state.hover;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;

  // If a tower is selected for building, colour by legality and show range.
  // Orange = legal but seals the maze — the wave will attack your walls.
  if (state.buildType) {
    const legal = canBuildAt(state, x, y);
    const seals = legal && wouldSealAt(state, x, y);
    ctx.fillStyle = !legal ? C.hoverBad : (seals ? C.hoverSeal : C.hoverOk);
    ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
    const def = CONFIG.TOWERS[state.buildType];
    if (def) drawRangeRing(ctx, x, y, def.range);
  } else if (state.map.type(x, y) === CELL.OPEN && !state.towerGrid[y][x]) {
    ctx.fillStyle = C.hoverOk;
    ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
  }
}

// Radial build ring open: highlight the chosen cell (orange when the placement
// would seal the maze — cached at ring-open, not re-BFS'd per frame) and show
// the hovered tower option's range.
function drawMenuCell(ctx, state) {
  if (!state.menuCell) return;
  const { x, y } = state.menuCell;
  ctx.fillStyle = state.menuSeals ? C.hoverSeal : C.hoverOk;
  ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
  ctx.strokeStyle = state.menuSeals ? 'rgba(255,165,0,0.9)' : C.rangeRing;
  ctx.lineWidth = 2;
  ctx.strokeRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);
  if (state.pendingBuild) {
    const def = CONFIG.TOWERS[state.pendingBuild];
    if (def) drawRangeRing(ctx, x, y, def.aura ? def.auraByLevel[0].range : def.range);
  }
}

export function drawRangeRing(ctx, cx, cy, rangeCells) {
  ctx.save();
  ctx.strokeStyle = C.rangeRing;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cellCenterX(cx), cellCenterY(cy), rangeCells * SIZE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Convert a #rrggbb (or existing rgba) colour to an rgba string with alpha.
function withAlpha(color, a) {
  if (color[0] === '#') {
    const n = parseInt(color.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

// ---- shared drawing helpers ----
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
