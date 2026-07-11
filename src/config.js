// =============================================================================
// config.js — ALL tunable constants and data tables for Mazecore TD.
//
// The whole game reads its numbers from here. If you want to rebalance, retheme
// or experiment, this is the only file you should need to touch. There are NO
// magic numbers buried in the gameplay code — they all live in CONFIG.
// =============================================================================

export const CONFIG = {
  // ---------------------------------------------------------------------------
  // MAP / GRID
  // ---------------------------------------------------------------------------
  GRID_COLS: 28,
  GRID_ROWS: 18,
  CELL: 32,                 // pixels per cell -> canvas is 28*32 x 18*32 = 896x576
  SEED: 1337,               // default RNG seed for reproducible maps

  // Spawn openings (on the map border). Enemies appear here.
  SPAWNS: [
    { id: 'S1', cx: 1,  cy: 0  },   // top-left
    { id: 'S2', cx: 0,  cy: 8  },   // left-middle
    { id: 'S3', cx: 1,  cy: 17 },   // bottom-left
  ],
  // Goal openings (on the map border). Enemies that reach one cost you lives.
  GOALS: [
    { id: 'G1', cx: 27, cy: 6  },   // right-middle
    { id: 'G2', cx: 26, cy: 17 },   // bottom-right
  ],

  // Procedural obstacles scattered at map init.
  OBSTACLE_CLUSTERS_MIN: 6,
  OBSTACLE_CLUSTERS_MAX: 10,
  OBSTACLE_CLUSTER_CELLS_MIN: 1,
  OBSTACLE_CLUSTER_CELLS_MAX: 3,

  // ---------------------------------------------------------------------------
  // CAMERA
  // Zoom is RELATIVE to the fit-all letterbox: 1 = the whole board visible
  // (survey mode, identical to the pre-camera letterbox). input.js drives the
  // viewport's panBy/zoomAt API from drag/pinch/wheel gestures.
  // ---------------------------------------------------------------------------
  CAMERA: {
    MAX_ZOOM: 2.5,          // closest-in: 2.5x the fit-all scale
    DRAG_SLOP: 8,           // CSS px a pointer travels before a press becomes a pan (below = tap)
    WHEEL_ZOOM_STEP: 1.1,   // zoom factor per 100px wheel notch, anchored at the cursor
  },

  // v1 ships hero-less (user call 2026-07-06). The hero system stays in the
  // codebase and the classic-board sims; the campaign game never creates one
  // and every hero UI surface hides behind this flag.
  HEROES_ENABLED: false,

  // ---------------------------------------------------------------------------
  // ECONOMY
  // ---------------------------------------------------------------------------
  START_GOLD: 1000,            // classic/Endless only (campaign sets per-level gold); 800->1000 after wall 5g->1g shifted the classic serpentine + tipped the warrior run
  START_LIVES: 20,
  SELL_REFUND: 0.70,            // 70% of total invested (towers)
  WALL_REFUND: 1.0,            // walls sell back in full — juggling is free
  INTEREST_RATE: 0.05,         // +5% of current gold on wave clear
  INTEREST_CAP: 40,            // capped at +40 gold
  EARLY_START_BONUS_PER_SEC: 1, // gold decayed per second elapsed since the build timer opened
  WAVE_CALL_BONUS_BASE: 10,     // early-call bonus cap at wave 1 (user 2026-07-08)
  WAVE_CALL_BONUS_PER_WAVE: 5,  // +5g cap per wave: wave1=10, wave2=15, wave3=20, ...

  // Player-facing balance presets. Expert is the current shipped baseline.
  DIFFICULTY_MODES: {
    expert: { goldMult: 1,   towerDamageMult: 1   },
    normal: { goldMult: 1.4, towerDamageMult: 1.2 },
    easy:   { goldMult: 2,   towerDamageMult: 1.5 },
  },

  // ---------------------------------------------------------------------------
  // WAVES & ENEMY SCALING (waves 1..100)
  // ---------------------------------------------------------------------------
  WIN_WAVE: 100,
  HP_BASE: 10,
  HP_LINEAR: 0.15,
  HP_EXP: 1.05,               // tuned in Phase 8 (was 1.10 — too steep to beat)
  DIFFICULTY: 0.65,           // global hp multiplier; tuned in Phase 8
  ENEMY_HP_SCALE: 4,          // core global: +300% HP on all non-boss enemies (user 2026-07-07)
  BOSS_HP_SCALE: 11,          // core global: +1000% HP on bosses
  DAMAGE_SCALE: 3.0,          // global tower-damage multiplier; tuned in Phase 8
  UPGRADE_COST_SCALE: 2,      // roster-only: +100% upgrade cost (user 2026-07-08)
  GOLD_PER_ROUND_SCALE: 0.65, // -35% gold-per-round: wave-clear bonus + bounties only,
                               // NOT interest or income towers (user 2026-07-08)

  ENEMY_BASE_SPEED: 1.7,       // cells/second at speedMult 1.0, wave 1
  SPEED_WAVE_FACTOR: 0.004,    // speed(w) = base * min(1.6, 1 + 0.004*w)
  SPEED_WAVE_CAP: 1.6,

  COUNT_BASE: 10,
  COUNT_PER_WAVE: 0.55,        // count(w) = floor(10 + 0.55*w)  (tuned Phase 8)
  SWARM_PACK_MIN: 4,           // tuned Phase 8 (was 8) — softer swarm spike
  SWARM_PACK_MAX: 7,

  BOUNTY_BASE: 3,
  BOUNTY_PER_WAVE: 1.6,        // bounty(w) = floor(3 + 1.6*w) * typeBountyMult (tuned Phase 8)
  WAVECLEAR_BASE: 20,
  WAVECLEAR_PER_WAVE: 12,      // clear bonus = floor(20 + 12*w)  (tuned Phase 8)

  SPAWN_STAGGER: 0.5,          // seconds between enemies in a wave
  BUILD_TIMER: 18,             // seconds of build time before a wave auto-readies (for early-start bonus)
  WAVE_CALL_COOLDOWN: 10,      // seconds between wave-calls; waves can now stack on the field (user 2026-07-07)

  // ---------------------------------------------------------------------------
  // ENEMY TYPES
  // hpMult/speedMult multiply the per-wave base values. `lives` = damageToLives.
  // armorType indexes into DAMAGE_VS_ARMOR below (WC3-style matchup matrix).
  // ---------------------------------------------------------------------------
  ENEMIES: {
    normal: { name: 'Grunt',     hpMult: 1.0,  speedMult: 1.0, armorType: 'medium',    flying: false, lives: 1,  atk: 1.0,  bountyMult: 1.0, radius: 9,  color: '#9aa3b2' },
    fast:   { name: 'Runner',    hpMult: 0.55, speedMult: 1.9, armorType: 'light',     flying: false, lives: 1,  atk: 0.7,  bountyMult: 0.8, radius: 8,  color: '#f2d24b' },
    tank:   { name: 'Brute',     hpMult: 2.6,  speedMult: 0.7, armorType: 'fortified', flying: false, lives: 2,  atk: 2.2,  bountyMult: 1.7, radius: 12, color: '#d98a4b' },
    swarm:  { name: 'Spawnling', hpMult: 0.25, speedMult: 1.2, armorType: 'unarmored', flying: false, lives: 1,  atk: 0.35,  bountyMult: 0.5, radius: 5,  color: '#aab0bc' },
    flyer:  { name: 'Wisp',      hpMult: 0.8,  speedMult: 1.3, armorType: 'light',     flying: true,  lives: 1,  atk: 0,  bountyMult: 1.1, radius: 9,  color: '#4fd6e0' },
    healer: { name: 'Mender',    hpMult: 1.4,  speedMult: 0.9, armorType: 'medium',    flying: false, lives: 2,  atk: 0.8,  bountyMult: 1.6, radius: 10, color: '#5fce7a', healPct: 0.03, healRadius: 2.6 },
    shield: { name: 'Warden',    hpMult: 1.6,  speedMult: 0.9, armorType: 'heavy',     flying: false, lives: 2,  atk: 1.2,  bountyMult: 1.6, radius: 10, color: '#5b8bd6', shieldPct: 0.25 },
    boss:   { name: 'Boss',      hpMult: 1.0,  speedMult: 0.6, armorType: 'boss',      flying: false, lives: 10, atk: 4.0, bountyMult: 8.0, radius: 18, color: '#c65bd6', boss: true },
  },

  // ---------------------------------------------------------------------------
  // DAMAGE TYPE vs ARMOR TYPE (WC3-style rock-paper-scissors).
  // The multiplier is applied to every hit in Enemy.takeDamage. Kept within
  // 0.5–1.5 so no matchup is a hard wall. 'chaos' is the neutral type (heroes'
  // whirlwind, Archmage L4, airstrike) — full damage against everything.
  // ---------------------------------------------------------------------------
  ARMOR_TYPES: {
    unarmored: { name: 'Unarmored', short: 'U', color: '#9aa3b2' },
    light:     { name: 'Light',     short: 'L', color: '#f2d24b' },
    medium:    { name: 'Medium',    short: 'M', color: '#aab0bc' },
    heavy:     { name: 'Heavy',     short: 'H', color: '#5b8bd6' },
    fortified: { name: 'Fortified', short: 'F', color: '#d98a4b' },
    boss:      { name: 'Boss',      short: '★', color: '#c65bd6' },
  },
  DAMAGE_TYPES: {
    pierce: { name: 'Pierce', color: '#7fd66b' },
    siege:  { name: 'Siege',  color: '#d98a4b' },
    magic:  { name: 'Magic',  color: '#9a6bd6' },
    poison: { name: 'Poison', color: '#6fc34b' },
    chaos:  { name: 'Chaos',  color: '#e8ecf3' },
  },
  DAMAGE_VS_ARMOR: {
    pierce: { unarmored: 1.25, light: 1.5,  medium: 1.0, heavy: 0.75, fortified: 0.6,  boss: 0.85 },
    siege:  { unarmored: 1.25, light: 0.75, medium: 1.0, heavy: 1.0,  fortified: 1.5,  boss: 0.85 },
    magic:  { unarmored: 1.0,  light: 1.25, medium: 1.0, heavy: 1.5,  fortified: 0.5,  boss: 1.0  },
    poison: { unarmored: 1.0,  light: 1.0,  medium: 1.5, heavy: 0.75, fortified: 1.0,  boss: 1.0  },
    chaos:  { unarmored: 1.0,  light: 1.0,  medium: 1.0, heavy: 1.0,  fortified: 1.0,  boss: 1.0  },
  },
  // UI thresholds: a matchup >= strong shows a green badge, <= weak a red one.
  MATRIX_BADGES: { strong: 1.25, weak: 0.75 },

  // Boss hp multiplier scales from ~18 (wave 10) to ~30 (wave 100).
  BOSS_HP_MULT_MIN: 18,
  BOSS_HP_MULT_MAX: 30,

  // ---------------------------------------------------------------------------
  // TOWERS — the campaign roster (U7): the 5g Wall plus the 8-tower WC3-role
  // set (arrow / cannon / frost / poison / sniper / lightning / support /
  // gold), every one on 5 tiers with a T5 signature or A/B fork. Mazing still
  // wins games — T1 towers are deliberately weak; tiers are where power lives.
  // Defs marked `hidden: true` are the legacy set — kept byte-identical for
  // the classic-board regression sims (autoplay TYPE_CYCLE) and for old v2
  // Endless saves (magic/falcon/cannonL), never shown in the ring.
  //
  // Upgrades are per-tier data (U5/KTD3): a def may declare
  //   tiers: [                       // entry i = the tier entered at level i+2
  //     { costMult, mods?,           // mods reuse the branch-merge keys
  //       forks?: { A: { name, desc, mods }, B: {...} } },  // A/B choice tier
  //   ]
  // Max level = tiers.length + 1; the ring shows a straight upgrade at any
  // tier without forks (single-signature tiers are just mods, no forks). The
  // roster uses the 2.5/5/10/20 costMult curve. Defs WITHOUT `tiers` get a
  // legacy-equivalent table built from UPGRADE below (see tower.js
  // tierTable), so every legacy tower keeps its exact numbers.
  // ---------------------------------------------------------------------------
  MAX_TOWER_LEVEL: 3,
  UPGRADE: {
    dmgMultPerLevel: 2.0,     // applied at L2 and again at L3
    rangeMultPerLevel: 1.08,  // legacy fallback (hidden classic-sim towers only)
    rangeMultPerTier: 1.20,   // roster: EVERY upgrade adds +20% range (user 2026-07-07)
    cooldownMultPerLevel: 0.9,// applied at L2 and again at L3
    costMultL2: 2.0,          // upgrades cost MORE than the tower: L2 = 2x base
    costMultL3: 4.0,          // ...and L3 = 4x base (7x total invested at L3)
    costMultL4: 8.0,          // (legacy towers only; the roster caps at L3)
  },

  TOWERS: {
    // The maze piece (Wintermaul/Gem TD economy): dirt cheap, tough, never
    // attacks, sells back at 100% (WALL_REFUND) so juggling costs nothing.
    wall: {
      name: 'Wall', glyph: '■', color: '#c9b896', cost: 1,
      wall: true,
      damage: 0, range: 0, cooldown: 0, damageType: 'none',
      targetsAir: false, projectileSpeed: 0,
      blurb: 'Cheap maze block. Sells back 100%.',
      branches: {},
    },
    // -- the 8-tower WC3 roster (U7) -------------------------------------------
    arrow: {
      name: 'Arrow', glyph: 'A', color: '#7fd66b', cost: 3,
      damage: 0.5, range: 2.6, cooldown: 0.7, damageType: 'pierce',
      targetsAir: true, projectileSpeed: 12,
      blurb: 'Cheap, fast. Hits land AND air.',
      branches: {},
      tiers: [
        { costMult: 2.5, mods: { damageMult: 2, cooldownMult: 0.9 } },
        { costMult: 5,   mods: { damageMult: 2, cooldownMult: 0.9 } },
        { costMult: 10,  mods: { damageMult: 2, cooldownMult: 0.9 } },
        { costMult: 20,  forks: {
          A: { id: 'deadeye',   name: 'Deadeye',   desc: 'devastating critical shots (+200% dmg)', mods: { damageMult: 3 } },
          B: { id: 'multishot', name: 'Multishot', desc: '3 arrows, 0.8x dmg each (anti-swarm/air)', mods: { multishot: 3, damageMult: 0.8 } },
        } },
      ],
    },
    cannon: {
      name: 'Cannon', glyph: 'C', color: '#d98a4b', cost: 5,
      damage: 0.6, range: 2.2, cooldown: 1.7, damageType: 'siege',
      targetsAir: false, projectileSpeed: 7, splashRadius: 1.0,
      blurb: 'Small splash. Land only.',
      branches: {},
      tiers: [
        { costMult: 2.5, mods: { damageMult: 2, splashRadius: 1.15 } },
        { costMult: 5,   mods: { damageMult: 2, splashRadius: 1.3 } },
        { costMult: 10,  mods: { damageMult: 2, splashRadius: 1.45 } },
        { costMult: 20,  forks: {
          A: { id: 'doomsday', name: 'Doomsday', desc: 'huge blasts (+150% dmg, 2.0 splash)', mods: { damageMult: 2.5, splashRadius: 2.0 } },
          B: { id: 'cluster',  name: 'Cluster',  desc: '3 mini-bombs re-splash every shell',   mods: { damageMult: 1.5, cluster: 3 } },
        } },
      ],
    },
    frost: {
      name: 'Frost', glyph: 'Fr', color: '#5bb8d6', cost: 6,
      damage: 0.3, range: 2.4, cooldown: 1.0, damageType: 'magic',
      targetsAir: true, hitscan: true, slowPct: 0.15, slowDur: 1.5,
      blurb: 'Slows enemies. Hits air.',
      branches: {},
      tiers: [
        { costMult: 2.5, mods: { damageMult: 2, slowPct: 0.4 } },
        { costMult: 5,   mods: { damageMult: 2, slowPct: 0.45, slowDur: 2.0 } },
        { costMult: 10,  mods: { damageMult: 2, slowPct: 0.5 } },
        // T5 single signature: brief freeze on every hit (stun stands in for
        // "freeze chance" — no chance mechanic exists, and U7 adds none).
        { costMult: 20,  mods: { damageMult: 2, slowPct: 0.6, slowDur: 2.5, stunDur: 0.35 } },
      ],
    },
    poison: {
      name: 'Poison', glyph: 'P', color: '#6fc34b', cost: 8,
      damage: 0.4, range: 2.5, cooldown: 1.2, damageType: 'poison',
      targetsAir: false, projectileSpeed: 9, dotDps: 0.8, dotDur: 3,
      blurb: 'Poison DoT. Land only.',
      branches: {},
      tiers: [
        { costMult: 2.5, mods: { damageMult: 2, dotDpsMult: 1.5 } },
        { costMult: 5,   mods: { damageMult: 2, dotDpsMult: 2, dotDur: 4 } },
        { costMult: 10,  mods: { damageMult: 2, dotDpsMult: 1.5 } },
        { costMult: 20,  forks: {
          A: { id: 'contagion', name: 'Contagion', desc: 'poison spreads on kill (DoT x2, 5s)', mods: { dotDpsMult: 2, dotDur: 5, contagion: true } },
          B: { id: 'corrosion', name: 'Corrosion', desc: 'melts armor: hits amplify ALL damage', mods: { damageMult: 2, armorShred: 0.5, armorShredDur: 3 } },
        } },
      ],
    },
    sniper: {
      name: 'Sniper', glyph: 'S', color: '#c9d4e0', cost: 12,
      damage: 2.5, range: 5.0, cooldown: 3.0, damageType: 'pierce',
      targetsAir: true, hitscan: true,
      blurb: 'Huge single hits, long range. Slow.',
      branches: {},
      tiers: [
        { costMult: 2.5, mods: { damageMult: 2 } },
        { costMult: 5,   mods: { damageMult: 2 } },
        { costMult: 10,  mods: { damageMult: 2, cooldownMult: 0.85 } },
        { costMult: 20,  forks: {
          A: { id: 'executioner', name: 'Executioner', desc: 'kills anything left under 20% HP (not bosses)', mods: { damageMult: 2, executePct: 0.2 } },
          B: { id: 'railgun',     name: 'Railgun',     desc: 'shots pierce everything along the line', mods: { damageMult: 2, lineDamage: true, lineWidth: 0.6 } },
        } },
      ],
    },
    lightning: {
      name: 'Lightning', glyph: 'L', color: '#e0c84f', cost: 15,
      damage: 2.2, range: 3.6, cooldown: 1.5, damageType: 'magic',
      targetsAir: true, hitscan: true, chainTargets: 3, chainFalloff: 0.6, chainRange: 1.6,
      blurb: 'Chain lightning. Hits air.',
      branches: {},
      tiers: [
        { costMult: 2.5, mods: { damageMult: 2 } },
        { costMult: 5,   mods: { damageMult: 2, chainTargets: 4 } },
        { costMult: 10,  mods: { damageMult: 2, chainTargets: 5, chainFalloff: 0.8 } },
        // T5 single signature: the storm — 8 chains, zero falloff.
        { costMult: 20,  mods: { damageMult: 2, chainTargets: 8, chainFalloff: 1.0 } },
      ],
    },
    support: {
      name: 'Support', glyph: 'B', color: '#e08ac8', cost: 11,
      aura: true,                    // non-attacking: buffs towers in radius instead
      damage: 0, range: 2.0, cooldown: 0, damageType: 'none',
      targetsAir: false, projectileSpeed: 0,
      // L1..L5 aura strength/radius (tier mods don't scale auras; this table does).
      auraByLevel: [
        { dmg: 0.10, speed: 0.05, range: 2.0 },
        { dmg: 0.15, speed: 0.08, range: 2.4 },
        { dmg: 0.20, speed: 0.10, range: 2.8 },
        { dmg: 0.25, speed: 0.12, range: 3.2 },
        { dmg: 0.30, speed: 0.15, range: 3.6 },
      ],
      blurb: 'Buffs nearby towers. Does not attack.',
      branches: {},
      tiers: [
        { costMult: 2.5 },
        { costMult: 5 },
        { costMult: 10 },
        // Gold-on-kill doesn't exist as a mechanic (and U7 adds none), so the
        // B fork pays flat income per wave instead — same "support that pays
        // for itself" flavor on an existing stats key.
        { costMult: 20,  forks: {
          A: { id: 'banner',   name: 'War Banner', desc: '+45% damage aura', mods: { auraDmg: 0.45 } },
          B: { id: 'treasury', name: 'Treasury',   desc: 'aura + pays 25g every wave', mods: { income: 25 } },
        } },
      ],
    },
    gold: {
      name: 'Gold Mine', glyph: '$', color: '#f2c14b', cost: 9,
      noAttack: true,                // a real tower with no attack: income only
      damage: 0, range: 0, cooldown: 0, damageType: 'none',
      targetsAir: false, projectileSpeed: 0,
      income: 3,                     // gold per wave clear; tiers escalate it
      blurb: 'Pays gold every wave. Never attacks.',
      branches: {},
      tiers: [
        { costMult: 2.5, mods: { income: 8 } },
        { costMult: 5,   mods: { income: 18 } },
        { costMult: 10,  mods: { income: 40 } },
        // T5 single signature: the mint.
        { costMult: 20,  mods: { income: 100 } },
      ],
    },
    // -- legacy pool (hidden; old-save compat + classic sim regression) --------
    // magic/falcon: the retired campaign towers — old v2 Endless saves still
    // load them. cannonL/frostL: byte-identical clones of the pre-U7 cannon
    // and frost defs so autoplay's classic TYPE_CYCLE (t10validate) keeps its
    // exact hero-era numbers while the roster cannon/frost carry tier tables.
    magic: {
      hidden: true,
      name: 'Magic', glyph: 'M', color: '#9a6bd6', cost: 22,
      damage: 3, range: 2.4, cooldown: 1.0, damageType: 'magic',
      targetsAir: true, hitscan: true, slowPct: 0.3, slowDur: 1.2,
      blurb: 'Slows. Hits land AND air.',
      branches: {},
    },
    falcon: {
      hidden: true,
      name: 'Falcon', glyph: 'F', color: '#4fa3d6', cost: 18,
      damage: 5, range: 3.2, cooldown: 0.9, damageType: 'pierce',
      targetsAir: true, airOnly: true, hitscan: true, falcon: true,
      blurb: 'A hunting falcon. AIR only.',
      branches: {},
    },
    cannonL: {
      hidden: true,
      name: 'Cannon', glyph: 'C', color: '#d98a4b', cost: 15,
      damage: 6, range: 2.2, cooldown: 1.7, damageType: 'siege',
      targetsAir: false, projectileSpeed: 7, splashRadius: 1.0,
      blurb: 'Small splash. Land only.',
      branches: {},
    },
    archer: {
      hidden: true,
      name: 'Archer', glyph: 'A', color: '#7fd66b', cost: 35,
      damage: 6, range: 2.6, cooldown: 0.55, damageType: 'pierce',
      targetsAir: true, projectileSpeed: 12,
      blurb: 'Cheap all-rounder. Hits air.',
      branches: {
        A: { id: 'marksman', name: 'Marksman', desc: '+120% dmg, +20% range', mods: { damageMult: 2.2, rangeMult: 1.2 } },
        B: { id: 'volley',   name: 'Volley',   desc: '3 arrows, 0.6x dmg each (anti-swarm/air)', mods: { multishot: 3, damageMult: 0.6 } },
      },
    },
    frostL: {
      hidden: true,
      name: 'Frost', glyph: 'Fr', color: '#5bb8d6', cost: 45,
      damage: 3, range: 2.4, cooldown: 1.0, damageType: 'magic',
      targetsAir: true, hitscan: true, slowPct: 0.35, slowDur: 1.5,
      blurb: 'Slows enemies. Hits air.',
      branches: {
        A: { id: 'glacier', name: 'Glacier', desc: 'slow 60%, 2.5s', mods: { slowPct: 0.6, slowDur: 2.5 } },
        B: { id: 'shatter', name: 'Shatter', desc: 'frozen enemies take +50% from all', mods: { shatter: 0.5 } },
      },
    },
    arcane: {
      hidden: true,
      name: 'Arcane', glyph: 'Ar', color: '#9a6bd6', cost: 70,
      damage: 14, range: 2.9, cooldown: 0.9, damageType: 'magic',
      targetsAir: true, projectileSpeed: 11,
      blurb: 'Bypasses shields. Melts Heavy.',
      branches: {
        A: { id: 'archmage', name: 'Archmage', desc: '+160% dmg, pure chaos damage', mods: { damageMult: 2.6, damageType: 'chaos' } },
        B: { id: 'disrupt',  name: 'Disrupt',  desc: 'removes shields & dispels regen', mods: { disrupt: true } },
      },
    },
    venom: {
      hidden: true,
      name: 'Venom', glyph: 'V', color: '#6fc34b', cost: 60,
      damage: 4, range: 2.5, cooldown: 1.2, damageType: 'poison',
      targetsAir: false, projectileSpeed: 9, dotDps: 8, dotDur: 3,
      blurb: 'Poison DoT. Scales vs high HP.',
      branches: {
        A: { id: 'plague',    name: 'Plague',    desc: 'DoT x3, 5s', mods: { dotDpsMult: 3, dotDur: 5 } },
        B: { id: 'contagion', name: 'Contagion', desc: 'poison spreads on kill', mods: { contagion: true } },
      },
    },
    tesla: {
      hidden: true,
      name: 'Tesla', glyph: 'T', color: '#e0c84f', cost: 100,
      damage: 40, range: 3.6, cooldown: 1.4, damageType: 'magic',
      targetsAir: true, hitscan: true, chainTargets: 3, chainFalloff: 0.6, chainRange: 1.6,
      blurb: 'Chain lightning. Hits air.',
      branches: {
        A: { id: 'overload', name: 'Overload', desc: '+180% dmg', mods: { damageMult: 2.8 } },
        B: { id: 'storm',    name: 'Storm',    desc: '6 chains, no falloff', mods: { chainTargets: 6, chainFalloff: 1.0 } },
      },
    },
    beacon: {
      hidden: true,
      name: 'Beacon', glyph: 'B', color: '#e08ac8', cost: 75,
      aura: true,                    // non-attacking: buffs towers in radius instead
      damage: 0, range: 2.0, cooldown: 0, damageType: 'none',
      targetsAir: false, projectileSpeed: 0,
      // L1..L3 aura strength/radius (the UPGRADE multipliers don't apply here).
      auraByLevel: [
        { dmg: 0.10, speed: 0.05, range: 2.0 },
        { dmg: 0.15, speed: 0.08, range: 2.4 },
        { dmg: 0.20, speed: 0.10, range: 2.8 },
      ],
      blurb: 'Buffs nearby towers. Does not attack.',
      branches: {
        A: { id: 'command', name: 'Command', desc: '+35% damage aura', mods: { auraDmg: 0.35 } },
        B: { id: 'haste',   name: 'Haste',   desc: '+25% attack speed aura', mods: { auraSpeed: 0.25 } },
      },
    },
  },

  DOT_MAX_STACKS: 3,
  TARGET_MODES: ['first', 'last', 'strongest', 'closest'],

  // ---------------------------------------------------------------------------
  // SIEGE MODE — you MAY seal the maze, but cut-off creeps attack your walls.
  // Besieged creeps follow a weighted breach field (open cell = 1, tower cell =
  // towerCellCost) so the whole wave converges on the cheapest wall to chew
  // through. Tower max HP = TOWER_HP.base + invested gold * TOWER_HP.perGold.
  // ---------------------------------------------------------------------------
  SIEGE: {
    towerCellCost: 200,      // Dijkstra penalty per tower cell (>> any open path)
    dpsBase: 5,              // creep wall-damage dps at wave 0...
    dpsPerWave: 0.8,         // ...plus per wave; multiplied by ENEMIES[type].hpMult
    bossDpsMult: 4,          // bosses smash walls much faster
    underAttackFlash: 0.35,  // seconds of red flash on a tower that was just hit
  },
  TOWER_HP: { base: 60, perGold: 0.6, wallBase: 160 },   // walls are the tough ones

  // ---------------------------------------------------------------------------
  // HEROES
  // ---------------------------------------------------------------------------
  HERO_XP_BASE: 50,
  HERO_XP_GROWTH: 1.45,        // xpForLevel(n) = floor(50 * 1.45^(n-1))
  HERO_MAX_LEVEL: 10,
  HERO_RESPAWN_BASE: 8,        // respawn = 8 + level seconds
  HERO_LEVEL_HP_GAIN: 0.12,    // +12% maxHp per level
  HERO_LEVEL_DMG_GAIN: 0.10,   // +10% damage per level
  HERO_SPEED_CELLS: 1,         // movement = def.speed (cells/sec) baseline scale
  HERO_PROJECTILE_SPEED: 14,   // cells/sec for ranged hero shots
  HERO_AGGRO_RANGE: 3.5,       // cells from the guard post: enemies inside draw the hero in
  HERO_LEASH_RANGE: 5.0,       // cells: the hero never chases further than this from its post
  HERO_CONTACT_RADIUS: 0.7,    // cells: enemies this close damage the hero
  HERO_CONTACT_DPS_BASE: 4,    // contact dps per adjacent enemy
  HERO_CONTACT_DPS_PER_WAVE: 0.7,
  HERO_BOSS_CONTACT_MULT: 6,   // bosses hit the hero much harder
  HERO_KILL_XP_BASE: 2,        // xp ~ enemy maxHp * 0.02, min 2; bosses give 60

  HEROES: {
    warrior: {
      name: 'Warrior', color: '#e0773b', glyph: '⚔',
      role: 'Melee bruiser. High HP, holds a chokepoint.',
      maxHp: 320, damage: 26, range: 1.5, cooldown: 0.8,
      attackType: 'chaos', targetsAir: false, speed: 3.2,
      abilities: [
        { id: 'whirlwind', name: 'Whirlwind', desc: 'AoE physical burst around the hero', cooldown: 7, radius: 2.2, dmgMult: 2.4, targetCell: false },
        { id: 'taunt',     name: 'Taunt',     desc: 'Pull nearby enemies in + brief stun', cooldown: 14, radius: 3.0, stun: 1.2, targetCell: false },
      ],
    },
    mage: {
      name: 'Mage', color: '#8a5bd6', glyph: '✨',
      role: 'Ranged AoE. Fragile but huge burst.',
      maxHp: 160, damage: 18, range: 3.2, cooldown: 1.1,
      attackType: 'magic', splashRadius: 1.0, targetsAir: true, speed: 3.0,
      abilities: [
        { id: 'meteor',    name: 'Meteor',     desc: 'Large AoE burst at target cell', cooldown: 9,  radius: 2.4, dmgMult: 6, targetCell: true },
        { id: 'frostnova', name: 'Frost Nova', desc: 'AoE slow + minor damage', cooldown: 12, radius: 3.0, dmgMult: 1.5, slowPct: 0.5, slowDur: 3, targetCell: true },
      ],
    },
    ranger: {
      name: 'Ranger', color: '#5fce7a', glyph: '➳',
      role: 'Ranged single-target DPS. Hits air.',
      maxHp: 190, damage: 16, range: 3.6, cooldown: 0.5,
      attackType: 'magic', targetsAir: true, speed: 3.4,
      abilities: [
        { id: 'volley',  name: 'Volley',   desc: 'Rapid burst of arrows at an area', cooldown: 8,  radius: 2.0, dmgMult: 0.7, shots: 8, targetCell: true },
        { id: 'hawkeye', name: 'Hawk Eye', desc: '+range & +damage buff for a few seconds', cooldown: 14, dur: 6, rangeAdd: 1.5, dmgMult: 1.8, targetCell: false },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // SHOP — hero upgrades (escalating cost tiers) & consumables (wave-scaled)
  // ---------------------------------------------------------------------------
  HERO_UPGRADES: {
    hp:       { name: '+40 Max HP',       stat: 'maxHp',        amount: 40,   baseCost: 60,  costGrowth: 1.6, maxTier: 6 },
    dmg:      { name: '+15% Damage',      stat: 'damageMult',   amount: 0.15, baseCost: 80,  costGrowth: 1.6, maxTier: 6 },
    cooldown: { name: '-10% Abil. CD',    stat: 'abilityCdMult',amount: -0.10,baseCost: 90,  costGrowth: 1.7, maxTier: 5 },
    respawn:  { name: '-1.5s Respawn',    stat: 'respawnAdd',   amount: -1.5, baseCost: 70,  costGrowth: 1.6, maxTier: 4 },
  },

  // Permanent global tower boosts (between waves) — the tower-side counterpart
  // to HERO_UPGRADES. Steep cost growth so they're a long-game gold sink, not an
  // early-game shortcut.
  TOWER_BOOSTS: {
    dmg:   { name: '+10% Tower Damage', amount: 0.10, baseCost: 250, costGrowth: 1.9, maxTier: 5 },
    speed: { name: '+5% Attack Speed',  amount: 0.05, baseCost: 220, costGrowth: 1.9, maxTier: 4 },
    range: { name: '+4% Tower Range',   amount: 0.04, baseCost: 200, costGrowth: 1.9, maxTier: 3 },
  },

  CONSUMABLES: {
    repair:  { name: 'Repair',       desc: '+3 lives',                       baseCost: 60,  perWave: 6,  lives: 3 },
    frenzy:  { name: 'Frenzy',       desc: '+50% tower dmg for 10s',         baseCost: 90,  perWave: 8,  mult: 1.5, dur: 10 },
    freeze:  { name: 'Flash Freeze', desc: 'Freeze non-boss enemies 3s',     baseCost: 110, perWave: 9,  dur: 3 },
    airstrike:{name: 'Airstrike',    desc: 'Big AoE burst at a cell',        baseCost: 120, perWave: 12, radius: 2.6, dmgWaveMult: 4, targetCell: true },
  },

  // ---------------------------------------------------------------------------
  // PALETTE — flat colors so placeholder shapes look intentional
  // ---------------------------------------------------------------------------
  COLORS: {
    bg: '#9fbf72',            // warm meadow green (no-art fallback)
    gridLine: 'rgba(92, 72, 40, 0.16)',   // soft warm hairlines
    border: '#4a3a26',        // warm timber frame
    hoverOk: 'rgba(255, 204, 92, 0.30)',
    hoverBad: 'rgba(226,75,74,0.30)',
    hoverSeal: 'rgba(255,165,0,0.35)',   // legal but seals the path (siege warning)
    obstacle: '#b59f72',      // sun-bleached rock
    obstacleHi: '#d8c49a', bush: '#5e9c4f', bushHi: '#79b865',
    spawn: '#4fd06a',
    goal: '#e24b4a',
    path: 'rgba(255, 246, 222, 0.60)',
    rangeRing: 'rgba(255, 190, 80, 0.70)',
    hpBack: 'rgba(42, 30, 18, 0.55)',
    hpFront: '#5fce7a',
    text: '#e8ecf3',
    textDim: '#9aa3b2',
    gold: '#f2c14b',
    danger: '#e24b4a',
  },

  // Victory star rating: lives >= STARS[0] -> 3 stars, >= STARS[1] -> 2, win -> 1.
  STARS: [18, 10],

  // ---------------------------------------------------------------------------
  // REWARDED ADS (simulated adapter now; AdMob slots in via Capacitor later).
  // FREE_GOLD: top-bar button, grant = base + perWave * wave; the cooldown
  // requires BOTH gates (waves elapsed this run AND wall-clock minutes) so it
  // can't be farmed by restarting or by idling between waves.
  // ---------------------------------------------------------------------------
  ADS: {
    FREE_GOLD: { base: 60, perWave: 12, cooldownWaves: 3, cooldownMinutes: 4 },
    REVIVE: { lives: 5, oncePerRun: true },
    SIM_SECONDS: 5,            // length of the fake 'video' in the simulated provider
  },

  // ---------------------------------------------------------------------------
  // LOOP
  // ---------------------------------------------------------------------------
  TICK_HZ: 60,
  MAX_STEPS_PER_FRAME: 8,      // safety cap so the sim never spirals
  SPEEDS: [1, 2, 3],
};

// Convenience derived values.
export const TICK_DT = 1 / CONFIG.TICK_HZ;            // seconds per sim tick
export const CANVAS_W = CONFIG.GRID_COLS * CONFIG.CELL;
export const CANVAS_H = CONFIG.GRID_ROWS * CONFIG.CELL;

export function normalizeDifficultyMode(mode) {
  return CONFIG.DIFFICULTY_MODES[mode] ? mode : 'expert';
}

export function difficultyModeStats(mode) {
  return CONFIG.DIFFICULTY_MODES[normalizeDifficultyMode(mode)];
}
