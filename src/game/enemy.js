// =============================================================================
// enemy.js — enemy entities: movement, status effects and damage.
//
// Ground enemies walk the maze by following the per-goal BFS distance field
// "downhill" (always stepping to the neighbour cell closest to the goal). This
// means they reroute for free whenever the field is rebuilt after a build/sell.
// Flying enemies ignore the maze entirely and fly straight to the goal.
//
// Damage model (WC3-style matchup matrix, see damage.js + CONFIG.DAMAGE_VS_ARMOR):
//   - every hit  : dmg = raw * matchup(damageType, armorType)   (0.5x .. 1.5x)
//   - magic      : additionally bypasses shields
//   - poison DoT : matrix-scaled once at application, ticks ignore shields
//   - shield     : absorbs non-magic damage until depleted (post-matrix)
//   - shatter (Frost L4B): victim takes +50% from ALL sources while debuffed
// =============================================================================

import { CONFIG } from '../config.js';
import { SIZE, COLS, ROWS, NEIGHBORS4, inBounds, cellCenter, worldToCell } from '../engine/grid.js';
import { fieldAt, UNREACHABLE } from '../engine/pathfinding.js';
import { matchup } from './damage.js';
import { destroyTower } from './tower.js';
import { pushEvent, routeFor, targetCell } from './state.js';

let NEXT_ID = 1;

export class Enemy {
  // stats = { hp, speed (cells/sec), bounty } from the wave generator.
  // opts (optional): { flying } overrides flight (e.g. a flying boss);
  //                   { bossTier } selects the boss ability kit.
  constructor(state, type, spawnId, goalId, stats, opts = {}) {
    const def = CONFIG.ENEMIES[type];
    this.id = NEXT_ID++;
    this.type = type;
    this.def = def;
    this.name = def.name;
    this.flying = (opts.flying != null) ? opts.flying : def.flying;
    this.armorType = def.armorType;
    this.radius = def.radius;
    this.color = def.color;
    this.boss = !!def.boss;
    this.damageToLives = def.lives;

    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.speed = stats.speed;              // cells/sec
    this.bounty = stats.bounty;

    // shield type starts with an absorb pool
    this.shieldHp = def.shieldPct ? def.shieldPct * this.maxHp : 0;
    this.maxShield = this.shieldHp;

    // position
    const spawn = state.map.spawns.find((s) => s.id === spawnId) || state.map.spawns[0];
    this.spawnId = spawn.id;
    this.goalId = goalId;
    const start = cellCenter(spawn.cx, spawn.cy);
    this.x = start.x;
    this.y = start.y;
    this.cx = spawn.cx;
    this.cy = spawn.cy;

    // movement: the waypoint chain (checkpoints in order, then our goal).
    // stage indexes route[]; each stage walks the BFS field of that target.
    this.route = routeFor(state, spawn.id);
    this.stage = 0;
    const goal = state.map.goals.find((g) => g.id === goalId) || state.map.goals[0];
    this.goalCell = { x: goal.cx, y: goal.cy };
    this.targetCell = { x: spawn.cx, y: spawn.cy };
    this.targetCenter = { x: start.x, y: start.y };

    // status
    this.slowTimer = 0; this.slowPct = 0;
    this.stunTimer = 0;
    this.shatterTimer = 0; this.shatterMult = 0;
    this.poison = [];           // [{dps, until}]
    this.disrupted = false;     // regen dispelled (Arcane Disrupt)
    this.bob = state.rng ? state.rng.next() * Math.PI * 2 : 0; // flyer bob phase
    this.burstLeft = 0;         // boss speed-burst window (sec)
    this.slowImmuneLeft = 0;    // boss slow-immunity window (sec)

    // boss ability kit (escalates with tier = waveNum/10)
    if (this.boss) {
      const tier = opts.bossTier || 1;
      this.bossTier = tier;
      this.bossKit = { heal: true, spawn: tier >= 2, burst: tier >= 3, immune: tier >= 4 };
      this.healTimer = 6; this.spawnTimer = 8; this.burstTimer = 12; this.immuneTimer = 14;
    }

    this.alive = true;
    this.reachedGoal = false;
    this.siegeTarget = null;    // tower being chewed while the path is sealed
    this.hitFlash = 0;          // cosmetic: squash/flash timer (renderer only)
    this.spawnedAt = state.time || 0;   // cosmetic: spawn pop-in

    if (this.flying) {
      this.aimAtStage(state);
    } else {
      this.advanceTarget(state);
    }
  }

  // Flyers travel straight to the CURRENT stage target (checkpoints still
  // apply to the skies — that's what keeps flags meaningful vs air waves).
  aimAtStage(state) {
    const c = targetCell(state, this.route[this.stage]) || this.goalCell && { x: this.goalCell.x, y: this.goalCell.y };
    this.targetCenter = cellCenter(c.x, c.y);
  }

  // Ordering metric for tower target modes ('first'/'last'): smaller = closer
  // to escaping. Stages still to go dominate; distance breaks ties.
  remainingDist(state) {
    const stagesLeft = this.route.length - 1 - this.stage;
    if (this.flying) {
      const d = Math.hypot(this.targetCenter.x - this.x, this.targetCenter.y - this.y) / SIZE;
      return d + stagesLeft * 10000;
    }
    const d = fieldAt(state.fields[this.route[this.stage]], this.cx, this.cy);
    return (d === UNREACHABLE ? 9000 : d) + stagesLeft * 10000;
  }

  // --- status effects -------------------------------------------------------
  applySlow(pct, dur) {
    if (this.slowImmuneLeft > 0) return;     // boss immunity window
    if (pct >= this.slowPct || this.slowTimer <= 0) this.slowPct = pct;
    this.slowTimer = Math.max(this.slowTimer, dur);
  }
  applyStun(dur) { this.stunTimer = Math.max(this.stunTimer, dur); }
  applyShatter(extraMult, dur) { this.shatterMult = extraMult; this.shatterTimer = Math.max(this.shatterTimer, dur); }
  applyPoison(dps, dur, state) {
    this.poison.push({ dps, until: state.time + dur });
    if (this.poison.length > CONFIG.DOT_MAX_STACKS) {
      // drop the weakest stack so we never exceed the cap
      this.poison.sort((a, b) => a.dps - b.dps);
      this.poison.shift();
    }
  }

  // Apply a hit. Returns the actual damage dealt to hp (for floating numbers).
  takeDamage(raw, type) {
    if (!this.alive) return 0;
    let dmg = raw * matchup(type, this.armorType);
    if (this.shatterTimer > 0) dmg *= (1 + this.shatterMult);
    // shields absorb everything except magic
    if (type !== 'magic' && this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
    }
    const before = this.hp;
    this.hp -= dmg;
    if (dmg > 0) this.hitFlash = 0.12;   // cosmetic only — never read by the sim
    return before - this.hp;
  }

  removeShield() { this.shieldHp = 0; }

  // --- per-tick update ------------------------------------------------------
  step(dt, state) {
    if (!this.alive) return;
    // timers
    if (this.stunTimer > 0) this.stunTimer -= dt;
    if (this.slowImmuneLeft > 0) { this.slowImmuneLeft -= dt; this.slowTimer = 0; this.slowPct = 0; }
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowPct = 0; }
    if (this.shatterTimer > 0) this.shatterTimer -= dt;
    if (this.burstLeft > 0) this.burstLeft -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.tickPoison(state, dt);
    if (this.hp <= 0) return;

    if (this.stunTimer > 0) return;     // frozen/taunted: no movement

    // Siege mode: cut off from the goal, parked next to a wall tower — chew it.
    if (!this.flying && this.siegeTarget) {
      const t = this.siegeTarget;
      if (!t.alive || state.towerGrid[t.cy][t.cx] !== t) {
        this.siegeTarget = null;          // wall fell/sold between reroutes
        this.advanceTarget(state);
      } else {
        this.attackTower(state, t, dt);
        return;                           // no movement while attacking
      }
    }

    const slowFactor = this.slowTimer > 0 ? (1 - this.slowPct) : 1;
    const burst = this.burstLeft > 0 ? 1.5 : 1;
    const movePx = this.speed * slowFactor * burst * SIZE * dt;
    if (this.flying) this.moveStraight(movePx, state);
    else this.moveGrid(movePx, state);
  }

  // Wall-damage dps: each enemy type carries an attack-power stat (`atk` in
  // CONFIG.ENEMIES, shown on its info card), scaled up with the wave.
  attackTower(state, tower, dt) {
    const S = CONFIG.SIEGE;
    const atk = this.def.atk != null ? this.def.atk : this.def.hpMult;
    const dps = (S.dpsBase + S.dpsPerWave * state.wave) * atk;
    tower.hp -= dps * dt;
    tower.underAttack = S.underAttackFlash;
    // chewing noise, deterministically throttled on sim time
    if (state.time - (state._wallSfxAt || 0) > 0.25) { state._wallSfxAt = state.time; pushEvent(state, 'wallhit'); }
    if (tower.hp <= 0) destroyTower(state, tower);   // reroutes everyone via onMazeChanged
  }

  tickPoison(state, dt) {
    if (this.poison.length === 0) return;
    let dps = 0;
    for (let i = this.poison.length - 1; i >= 0; i--) {
      if (state.time >= this.poison[i].until) { this.poison.splice(i, 1); continue; }
      dps += this.poison[i].dps;
    }
    if (dps > 0) this.hp -= dps * dt;   // poison ignores armor & shields tick-wise
  }

  // Healer types restore nearby allies (BUILD_PROMPT §4). No-op if disrupted.
  healAllies(state, dt) {
    if (this.disrupted || !this.def.healPct) return;
    const r = this.def.healRadius;
    for (const o of state.enemies) {
      if (!o.alive || o === this) continue;
      const dxc = (o.x - this.x) / SIZE, dyc = (o.y - this.y) / SIZE;
      if (dxc * dxc + dyc * dyc <= r * r) {
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * this.def.healPct * dt);
      }
    }
  }

  moveStraight(movePx, state) {
    const dx = this.targetCenter.x - this.x;
    const dy = this.targetCenter.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= movePx || dist < 0.001) {
      // reached the current waypoint: advance the stage or escape
      if (this.stage < this.route.length - 1) {
        this.stage++;
        this.aimAtStage(state);
      } else {
        this.reachedGoal = true;
      }
      return;
    }
    this.x += (dx / dist) * movePx;
    this.y += (dy / dist) * movePx;
    const c = worldToCell(this.x, this.y);
    this.cx = c.x; this.cy = c.y;
  }

  moveGrid(movePx, state) {
    let remaining = movePx;
    let guard = 0;
    while (remaining > 0 && !this.reachedGoal && guard++ < 16) {
      const dx = this.targetCenter.x - this.x;
      const dy = this.targetCenter.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining) {
        this.x = this.targetCenter.x;
        this.y = this.targetCenter.y;
        remaining -= dist;
        this.cx = this.targetCell.x;
        this.cy = this.targetCell.y;
        this.advanceTarget(state);
        if (this.targetCell.x === this.cx && this.targetCell.y === this.cy && !this.reachedGoal) {
          // No improving neighbour (transient during a rebuild): stop for now.
          break;
        }
      } else {
        this.x += (dx / dist) * remaining;
        this.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
  }

  // Pick the neighbour of (cx,cy) closest to the CURRENT stage target, using
  // its live field. Reaching a checkpoint advances the stage (creeps then walk
  // the maze again toward the next flag — the Gem TD loop). If our cell is cut
  // off from the stage target (sealed), fall back to the weighted breach
  // field; when its downhill step lands on a tower cell, park here and mark
  // that tower as our siege target instead of moving.
  advanceTarget(state) {
    let key = this.route[this.stage];
    let field = state.fields[key];
    // standing on the stage target: advance to the next flag, or escape
    while (fieldAt(field, this.cx, this.cy) === 0) {
      if (this.stage >= this.route.length - 1) { this.reachedGoal = true; return; }
      this.stage++;
      key = this.route[this.stage];
      field = state.fields[key];
    }
    let sieging = false;
    if (fieldAt(field, this.cx, this.cy) === UNREACHABLE && state.siegeFields && state.siegeFields[key]) {
      field = state.siegeFields[key];
      sieging = true;
    }
    const here = fieldAt(field, this.cx, this.cy);
    let best = null, bestD = here;
    for (let i = 0; i < 4; i++) {
      const nx = this.cx + NEIGHBORS4[i][0];
      const ny = this.cy + NEIGHBORS4[i][1];
      const d = fieldAt(field, nx, ny);
      if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
    }
    if (best) {
      const wall = sieging ? state.towerGrid[best.y][best.x] : null;
      if (wall) {
        // next step is a wall tower: stop adjacent and chew through it
        this.siegeTarget = wall;
        this.targetCell = { x: this.cx, y: this.cy };
        this.targetCenter = cellCenter(this.cx, this.cy);
        return;
      }
      this.siegeTarget = null;
      this.targetCell = best;
      this.targetCenter = cellCenter(best.x, best.y);
    } else {
      // stuck: aim at our own cell (will retry next rebuild)
      this.targetCell = { x: this.cx, y: this.cy };
      this.targetCenter = cellCenter(this.cx, this.cy);
    }
  }

  // Called by onMazeChanged: re-derive the next step from the refreshed field.
  // Clearing siegeTarget first means selling a wall resumes the walk instantly
  // (juggling stays smooth) and a fallen wall hands off to the next one.
  reroute(state) {
    this.siegeTarget = null;
    this.reachedGoal = false;
    this.advanceTarget(state);
  }
}

// Move every enemy one tick; resolve kills (gold) and leaks (lives).
// onKilled/onLeaked are injected by the caller (economy) to avoid a circular dep.
export function updateEnemies(state, dt, onKilled, onLeaked) {
  // healers first, so allies are topped up before they take/lose hp this tick
  for (const e of state.enemies) if (e.alive) e.healAllies(state, dt);

  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.step(dt, state);
    if (e.hp <= 0) { e.alive = false; onKilled && onKilled(state, e); }
    else if (e.reachedGoal) { e.alive = false; onLeaked && onLeaked(state, e); }
  }
  // compact the list
  if (state.enemies.some((e) => !e.alive)) {
    state.enemies = state.enemies.filter((e) => e.alive);
  }
}
