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
  // ECONOMY
  // ---------------------------------------------------------------------------
  START_GOLD: 800,             // tuned in Phase 8 (was 260) — fund an early maze
  START_LIVES: 20,
  SELL_REFUND: 0.70,            // 70% of total invested
  INTEREST_RATE: 0.05,         // +5% of current gold on wave clear
  INTEREST_CAP: 40,            // capped at +40 gold
  EARLY_START_BONUS_PER_SEC: 1, // gold per second remaining on the build timer

  // ---------------------------------------------------------------------------
  // WAVES & ENEMY SCALING (waves 1..100)
  // ---------------------------------------------------------------------------
  WIN_WAVE: 100,
  HP_BASE: 10,
  HP_LINEAR: 0.15,
  HP_EXP: 1.05,               // tuned in Phase 8 (was 1.10 — too steep to beat)
  DIFFICULTY: 0.65,           // global hp multiplier; tuned in Phase 8
  DAMAGE_SCALE: 3.0,          // global tower-damage multiplier; tuned in Phase 8

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

  // ---------------------------------------------------------------------------
  // ENEMY TYPES
  // hpMult/speedMult multiply the per-wave base values. `lives` = damageToLives.
  // armorType indexes into DAMAGE_VS_ARMOR below (WC3-style matchup matrix).
  // ---------------------------------------------------------------------------
  ENEMIES: {
    normal: { name: 'Grunt',     hpMult: 1.0,  speedMult: 1.0, armorType: 'medium',    flying: false, lives: 1,  bountyMult: 1.0, radius: 9,  color: '#9aa3b2' },
    fast:   { name: 'Runner',    hpMult: 0.55, speedMult: 1.9, armorType: 'light',     flying: false, lives: 1,  bountyMult: 0.8, radius: 8,  color: '#f2d24b' },
    tank:   { name: 'Brute',     hpMult: 2.6,  speedMult: 0.7, armorType: 'fortified', flying: false, lives: 2,  bountyMult: 1.7, radius: 12, color: '#d98a4b' },
    swarm:  { name: 'Spawnling', hpMult: 0.25, speedMult: 1.2, armorType: 'unarmored', flying: false, lives: 1,  bountyMult: 0.5, radius: 5,  color: '#aab0bc' },
    flyer:  { name: 'Wisp',      hpMult: 0.8,  speedMult: 1.3, armorType: 'light',     flying: true,  lives: 1,  bountyMult: 1.1, radius: 9,  color: '#4fd6e0' },
    healer: { name: 'Mender',    hpMult: 1.4,  speedMult: 0.9, armorType: 'medium',    flying: false, lives: 2,  bountyMult: 1.6, radius: 10, color: '#5fce7a', healPct: 0.03, healRadius: 2.6 },
    shield: { name: 'Warden',    hpMult: 1.6,  speedMult: 0.9, armorType: 'heavy',     flying: false, lives: 2,  bountyMult: 1.6, radius: 10, color: '#5b8bd6', shieldPct: 0.25 },
    boss:   { name: 'Boss',      hpMult: 1.0,  speedMult: 0.6, armorType: 'boss',      flying: false, lives: 10, bountyMult: 8.0, radius: 18, color: '#c65bd6', boss: true },
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
  // TOWERS
  // range is in cells (Euclidean). cooldown in seconds. projectileSpeed in
  // cells/second (hitscan towers ignore it). Branch `mods` are applied on top of
  // the level-3 stats when the player picks a level-4 specialization.
  // ---------------------------------------------------------------------------
  UPGRADE: {
    dmgMultPerLevel: 2.0,     // applied at L2 and again at L3 (tuned Phase 8: 1.6 -> 2.0)
    rangeMultPerLevel: 1.08,  // applied at L2 and again at L3
    cooldownMultPerLevel: 0.9,// applied at L2 and again at L3
    costMultL2: 1.0,          // L2 cost = round(baseCost * 1.0)
    costMultL3: 1.8,
    costMultL4: 3.2,
  },

  TOWERS: {
    archer: {
      name: 'Archer', glyph: 'A', color: '#7fd66b', cost: 70,
      damage: 6, range: 2.6, cooldown: 0.55, damageType: 'pierce',
      targetsAir: true, projectileSpeed: 12,
      blurb: 'Cheap all-rounder. Hits air.',
      branches: {
        A: { id: 'marksman', name: 'Marksman', desc: '+120% dmg, +20% range', mods: { damageMult: 2.2, rangeMult: 1.2 } },
        B: { id: 'volley',   name: 'Volley',   desc: '3 arrows, 0.6x dmg each (anti-swarm/air)', mods: { multishot: 3, damageMult: 0.6 } },
      },
    },
    cannon: {
      name: 'Cannon', glyph: 'C', color: '#d98a4b', cost: 110,
      damage: 18, range: 2.3, cooldown: 1.6, damageType: 'siege',
      targetsAir: false, projectileSpeed: 7, splashRadius: 1.2,
      blurb: 'Splash damage. Great vs swarm.',
      branches: {
        A: { id: 'siege',   name: 'Siege',   desc: '+150% dmg, splash 1.6', mods: { damageMult: 2.5, splashRadius: 1.6 } },
        B: { id: 'cluster', name: 'Cluster', desc: '3 mini-blasts that re-splash', mods: { cluster: 3 } },
      },
    },
    frost: {
      name: 'Frost', glyph: 'F', color: '#5bb8d6', cost: 90,
      damage: 3, range: 2.4, cooldown: 1.0, damageType: 'magic',
      targetsAir: true, hitscan: true, slowPct: 0.35, slowDur: 1.5,
      blurb: 'Slows enemies. Hits air.',
      branches: {
        A: { id: 'glacier', name: 'Glacier', desc: 'slow 60%, 2.5s', mods: { slowPct: 0.6, slowDur: 2.5 } },
        B: { id: 'shatter', name: 'Shatter', desc: 'frozen enemies take +50% from all', mods: { shatter: 0.5 } },
      },
    },
    arcane: {
      name: 'Arcane', glyph: 'M', color: '#9a6bd6', cost: 145,
      damage: 14, range: 2.9, cooldown: 0.9, damageType: 'magic',
      targetsAir: true, projectileSpeed: 11,
      blurb: 'Bypasses shields. Melts Heavy.',
      branches: {
        A: { id: 'archmage', name: 'Archmage', desc: '+160% dmg, pure chaos damage', mods: { damageMult: 2.6, damageType: 'chaos' } },
        B: { id: 'disrupt',  name: 'Disrupt',  desc: 'removes shields & dispels regen', mods: { disrupt: true } },
      },
    },
    venom: {
      name: 'Venom', glyph: 'V', color: '#6fc34b', cost: 120,
      damage: 4, range: 2.5, cooldown: 1.2, damageType: 'poison',
      targetsAir: false, projectileSpeed: 9, dotDps: 8, dotDur: 3,
      blurb: 'Poison DoT. Scales vs high HP.',
      branches: {
        A: { id: 'plague',    name: 'Plague',    desc: 'DoT x3, 5s', mods: { dotDpsMult: 3, dotDur: 5 } },
        B: { id: 'contagion', name: 'Contagion', desc: 'poison spreads on kill', mods: { contagion: true } },
      },
    },
    tesla: {
      name: 'Tesla', glyph: 'T', color: '#e0c84f', cost: 210,
      damage: 40, range: 3.6, cooldown: 1.4, damageType: 'magic',
      targetsAir: true, hitscan: true, chainTargets: 3, chainFalloff: 0.6, chainRange: 1.6,
      blurb: 'Chain lightning. Hits air.',
      branches: {
        A: { id: 'overload', name: 'Overload', desc: '+180% dmg', mods: { damageMult: 2.8 } },
        B: { id: 'storm',    name: 'Storm',    desc: '6 chains, no falloff', mods: { chainTargets: 6, chainFalloff: 1.0 } },
      },
    },
    beacon: {
      name: 'Beacon', glyph: 'B', color: '#e08ac8', cost: 150,
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
  TOWER_HP: { base: 60, perGold: 0.6 },

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
    bg: '#1b1f2a',
    gridLine: '#262b38',
    border: '#11141c',
    hoverOk: 'rgba(0,212,255,0.18)',
    hoverBad: 'rgba(226,75,74,0.30)',
    hoverSeal: 'rgba(255,165,0,0.35)',   // legal but seals the path (siege warning)
    obstacle: '#3a3f4b',
    obstacleHi: '#4a505e',
    spawn: '#4fd06a',
    goal: '#e24b4a',
    path: 'rgba(120,200,255,0.35)',
    rangeRing: 'rgba(0,212,255,0.45)',
    hpBack: '#2a2f3c',
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
