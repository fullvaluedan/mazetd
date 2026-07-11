# Mazecore TD Art Bible

This bible is the production contract for the game's art. It translates the
visual direction into asset families, file targets, and approval rules so we
can review one family at a time without drifting away from the look.

The target feel is Clash Royale-inspired in spirit only: premium, toy-like,
bright, readable, and a little regal. Do not copy Supercell's logo, card
frames, or exact UI compositions.

## Crystal Kingdom Identity

Mazecore's own visual signature is **Crystal Kingdom Maze Defense**: a cyan
crystal crest, royal navy and warm-gold game chrome, cream lettering, bright
top-down meadow and dirt, red-brick maze walls, and compact anime-influenced
units with chunky toy-fantasy silhouettes. The maze and moving route are the
composition's subject; decoration supports them instead of competing with them.

Originality is judged at the motif and composition level, not just by changing
colors. Do not reproduce another game's crown, logo, card silhouette, arena
layout, chest, character, font, icon, button shape, or exact palette placement.
We borrow standards of craft: immediate hierarchy, tactile response, readable
silhouettes, celebratory pacing, and friendly competitive energy.

Every reusable asset family requires three approval views before promotion:

1. A source-resolution contact sheet showing the whole family together.
2. A transparent-export inspection that proves clean alpha, crop, and padding.
3. A live game-scale proof at the actual 32px cell size, shown at fit-all and
   2.5x zoom beside neighboring assets and relevant selection/HUD states.

An attractive source image is not approval to wire it. User approval applies
to the exact family and evidence bundle shown at that checkpoint.

## North Star

- Bright fantasy battler energy
- Chunky, dimensional UI chrome
- Scenic battlefield first, chrome second
- Strong silhouettes that read on a phone
- High contrast and clear feedback at a glance
- Playful motion, not noisy realism

## Current Focus

- Enemies
- Towers, especially the Wall tower
- Battlefield tileset and environment props
- Heroes are low priority for now and should be treated as a future addition

## Hard Rules

| Rule | Target |
|---|---|
| Camera | 30-degree top-down for battlefield and tiles |
| Tile size | 32x32 px |
| Tower footprint | 1x1 tile |
| Outline | 2px readable silhouette |
| Light direction | Upper-left |
| Finish | Polished toy / painted game art |
| Animation | 4-8 fps, readable loops |
| File format | PNG RGBA |
| Backgrounds | Full-bleed art when needed; transparent PNGs for units, icons, and effects |

## Color System

Use the battlefield greens and warm stone already in the game, but push the UI
and reward surfaces toward royal blue, navy, gold, cream, and jewel accents.

| Color family | Use |
|---|---|
| Royal blue / navy | Premium UI chrome, menus, frames |
| Gold / cream | Rewards, buttons, victory, value |
| Meadow green / warm stone | Battlefield, walls, terrain, natural props |
| Cyan | Frost, lightning, magic highlights |
| Purple | Arcane, boss, rare effects |
| Red | Danger, siege, defeat, warnings |

Rules:

- Gold means value, victory, or premium action.
- Red means danger, siege, or failure.
- Purple is an accent, not a default background.
- The board must stay brighter than the UI shell.

## Production Order

| Order | Family | Files / pieces | Status | Notes |
|---|---|---|---|---|
| 1 | Identity and shell | `assets/misc/icon.png`, `assets/misc/title.png`, `assets/misc/background.png`, `assets/misc/spawn.png`, `assets/misc/camp.png`, `assets/misc/worldmap.png`, `assets/misc/falcon.png` | Mostly present | Establishes the game's brand tone |
| 2 | Live tower roster | `assets/towers/wall.png`, `assets/towers/archer.png`, `assets/towers/cannon.png`, `assets/towers/frost.png`, `assets/towers/venom.png`, `assets/towers/tesla.png`, `assets/towers/beacon.png`, `assets/towers/arcane.png`, `assets/towers/magic.png`, `assets/towers/falcon.png` | Present | Main battle readability |
| 3 | Missing tower art | `assets/towers/sniper.png`, `assets/towers/gold.png` | Missing | First open approvals |
| 4 | Enemy roster | `assets/enemies/normal.png`, `assets/enemies/fast.png`, `assets/enemies/tank.png`, `assets/enemies/swarm.png`, `assets/enemies/flyer.png`, `assets/enemies/healer.png`, `assets/enemies/shield.png`, `assets/enemies/boss.png` | Present | Enemy family must read instantly |
| 5 | Enemy sheets | `assets/sheets/enemy-normal.png`, `assets/sheets/enemy-fast.png`, `assets/sheets/enemy-tank.png`, `assets/sheets/enemy-swarm.png`, `assets/sheets/enemy-healer.png`, `assets/sheets/enemy-shield.png`, `assets/sheets/enemy-boss.png` | Present | 4-frame, 2x2 grid sheets |
| 6 | Battlefield tile set | Grass, dirt, stone path, sand, water, cliff top, cliff side/front, cliff corner, bridge, exit tile, detail variants | High | Needed to make the maze world feel deliberate |
| 7 | UI icon pack | Coin, heart, wave, pause, play, speed, gear, store, ad, star, crown, map, lock, build, sell, upgrade, range, armor, damage, status icons | Medium | Can be vector, PNG, or CSS-driven, but must share one style |
| 8 | Combat VFX pack | Projectiles, impact bursts, aura rings, status effects, telegraphs | Medium | Some can stay procedural; sprite them only if needed |
| 9 | Hero roster | `assets/heroes/warrior.png`, `assets/heroes/mage.png`, `assets/heroes/ranger.png` | Low | Future addition; keep the style notes, but do not block current art on it |
| 10 | Hero sheets | `assets/sheets/hero-warrior.png`, `assets/sheets/hero-mage.png`, `assets/sheets/hero-ranger.png` | Low | Future addition; 4-frame, 2x2 grid sheets |

## Reference Stack

For every generation, use the same three-reference stack:

1. Constitution image: `docs/art/reference/art-guide.png`
2. Perspective / family reference for the asset currently being made
3. Current family asset sheet or closest sibling asset

Optional fourth reference:

- A real-world inspiration image for silhouette only, never for direct copying

## Family Rules

### 1. Identity And Shell

Files:

- `assets/misc/icon.png`
- `assets/misc/title.png`
- `assets/misc/background.png`
- `assets/misc/spawn.png`
- `assets/misc/camp.png`
- `assets/misc/worldmap.png`
- `assets/misc/falcon.png`

What these assets must do:

- `icon.png` must read at very small sizes and feel like a royal game badge.
- `title.png` must feel like a crest, banner, or key art splash, not plain text.
- `background.png` must support the battlefield without fighting the maze.
- `spawn.png` must feel like a magical portal mouth or hostile breach.
- `camp.png` must feel like a cozy goal or safe outpost.
- `worldmap.png` must feel like an arena climb with reward energy.
- `falcon.png` must feel like a companion or emblem, not a random bird sticker.

Style notes:

- Keep the mood bright and adventurous.
- Use painterly depth, but avoid realism.
- Give each asset one dominant shape.
- Keep backgrounds scenic and slightly softer than units or UI.

### 2. Battlefield Tile Set

This family is not fully in the asset folder yet, but it is part of the target
look.

Needed tiles:

- Grass base
- Dirt
- Stone path
- Sand
- Water
- Cliff top
- Cliff side / front
- Cliff corner
- Bridge
- Exit tile
- Decoration variants: flowers, rocks, bushes, tufts, ruins, posts, roots

Rules:

- The connected tile sets must be autotiled.
- Do not stamp raw path segments by hand.
- Keep tile edges clean enough to read at 32x32.
- Make path tiles warmer and slightly lighter than the surrounding grass.
- Use cliff height and shadow to create depth, not hard black outlines.

### 3. Tower Family

This is the most important family after the title and shell art. The towers are
the maze, the defense, and the main visual language of the game.

Core rules:

- Every tower must work as a 1x1 footprint.
- The base silhouette must stay readable when the tower is surrounded by walls.
- Upgrades should add trim, glow, crystals, barrels, or attachments, but should
  not erase the original identity.
- Use gold for value, cyan for electricity/frost, green for poison/arrow, and
  purple for arcane/rare magic.

| Game role | File | Status | Visual brief |
|---|---|---|---|
| Wall | `assets/towers/wall.png` | Present | A clean cube/block wall piece; the maze's brick. Keep it the simplest silhouette in the roster |
| Arrow tower | `assets/towers/archer.png` | Present | Lean bow tower with green accents and a clear bow shape |
| Cannon tower | `assets/towers/cannon.png` | Present | Squat bronze artillery piece with a big barrel |
| Frost tower | `assets/towers/frost.png` | Present | Ice crystal / snowcap tower with blue-white glow |
| Poison tower | `assets/towers/venom.png` | Present | Toxic green alchemy tower, vial/spore silhouette |
| Lightning tower | `assets/towers/tesla.png` | Present | Coil / rune emitter with electric crown and gold-cyan energy |
| Support tower | `assets/towers/beacon.png` | Present | Aura pylon or lantern with pink-gold energy |
| Arcane tower | `assets/towers/arcane.png` | Present | Violet magical amplifier, jewel core, rare feel |
| Magic tower | `assets/towers/magic.png` | Present | Legacy magic variant; keep it coherent with arcane family |
| Falcon tower | `assets/towers/falcon.png` | Present | Bird perch or hunt tower, strong air-themed silhouette |
| Sniper tower | `assets/towers/sniper.png` | Missing | Tall, elegant, precise; scope, lens, or long barrel silhouette |
| Gold tower | `assets/towers/gold.png` | Missing | Mine / treasury / mint feel; coin or shaft motif, value sparkle |

Notes:

- The missing tower art is `sniper.png` and `gold.png`. Those should be the
  first tower approvals after the shell art.
- The Wall tower should feel like a clean cube block, close in spirit to the
  cube shape from the concept image, but plainer and more maze-like.
- If a tower has a legacy or compatibility variant, it must stay family-cohesive
  with the live roster, not look like a different game.
- Special effects on towers should never make the footprint harder to read.

### 4. Enemy Family

The enemies need to read at a glance, even during stack-heavy waves.

Core rules:

- Keep each family visually distinct by silhouette first, palette second.
- Make the regular enemy readable at tiny sizes.
- Use accessories, armor, horns, staff, shield, glow, or wings to show role.
- The boss should feel like the same universe scaled up, not a separate style.

| Enemy role | File | Status | Visual brief |
|---|---|---|---|
| Grunt | `assets/enemies/normal.png` | Present | Balanced baseline enemy, clear and simple |
| Runner | `assets/enemies/fast.png` | Present | Lean, forward-tilted, speed-revealing silhouette |
| Brute | `assets/enemies/tank.png` | Present | Broad shoulders, heavier armor, slow menace |
| Spawnling | `assets/enemies/swarm.png` | Present | Tiny, noisy, mass-friendly shape |
| Wisp | `assets/enemies/flyer.png` | Present | Airborne, translucent, slightly magical |
| Mender | `assets/enemies/healer.png` | Present | Staff, charm, or aura language; green healer cues |
| Warden | `assets/enemies/shield.png` | Present | Barrier / shield / plated shape, defensive silhouette |
| Boss | `assets/enemies/boss.png` | Present | Crowned, oversized, layered, and unmistakable |

Sheet rules:

- `assets/sheets/enemy-normal.png`
- `assets/sheets/enemy-fast.png`
- `assets/sheets/enemy-tank.png`
- `assets/sheets/enemy-swarm.png`
- `assets/sheets/enemy-healer.png`
- `assets/sheets/enemy-shield.png`
- `assets/sheets/enemy-boss.png`

Notes:

- Enemy sheets are 4-frame sheets in a 2x2 grid.
- Pivots, scale, and feet placement must stay consistent across all frames.
- If a sheet is misaligned, reject it and regenerate instead of trying to patch
  it in code.

### 5. Hero Family

The heroes are the "named characters" of the run. They need to feel like real
fantasy leads, not generic unit icons.

This family is lower priority for now and should not block enemies, towers, or
the tileset.

Core rules:

- Portrait art and battlefield art must share the same face, costume, and color
  language.
- The battlefield sprite can be smaller and simpler, but it must still feel like
  the same character.
- Make each hero role obvious through pose and silhouette.

| Hero role | File | Status | Visual brief |
|---|---|---|---|
| Warrior | `assets/heroes/warrior.png` | Present | Melee bruiser with strong armor and a heroic stance |
| Mage | `assets/heroes/mage.png` | Present | Ranged spellcaster with glow, robes, and burst energy |
| Ranger | `assets/heroes/ranger.png` | Present | Agile archer with clear bow / movement silhouette |

Sheet rules:

- `assets/sheets/hero-warrior.png`
- `assets/sheets/hero-mage.png`
- `assets/sheets/hero-ranger.png`

Notes:

- Hero sheets are also 4-frame, 2x2 grid sheets.
- Portraits should work inside a card or dock at small size.
- The battlefield sprite should keep the same identity after downscaling.

### 6. UI Chrome And Icon Pack

The current app uses a lot of CSS and text-based controls. The approved look
should still follow one icon language if we turn any of these into art assets.

Needed icon concepts:

- Coin / gold
- Heart / lives
- Wave / incoming wave
- Pause / play
- Speed / multiplier
- Gear / settings
- Store / cart
- Ad / reward
- Star rating
- Crown / victory
- Map / level select
- Lock / gated content
- Build / sell / upgrade
- Range / targeting
- Armor / damage type badges
- Status icons: slow, poison, shield, burn, stun, aura

Style notes:

- Thick, readable, and embossed.
- Cream or gold surfaces with navy or royal-blue framing.
- Use small highlights and bevels, not micro-detail.
- Icons must remain readable at 18-24 px.

### 7. Combat VFX

Some of these are already procedural in code, but the art bible should still
define the family so future sprite or icon passes stay coherent.

Needed effect concepts:

- Arrow streak
- Cannon impact / splash
- Frost shard / freeze pulse
- Poison dart / cloud
- Lightning arc / chain spark
- Arcane bolt / burst
- Aura ring / buff pulse
- Heal pulse
- Shield ring
- Stun flash
- Burn / explosion burst
- Boss telegraph
- Siege warning flash
- Slash crescent

Style notes:

- Effects should be bright and short-lived.
- Do not let effects hide the maze path.
- Use a dominant color and a simple shape for each effect.
- Prefer glow, ring, streak, and spark over noisy particles.

## Approval Order

Use this order when reviewing or generating assets:

1. Title logo and shell art
2. Tower family icons and upgrade visuals
3. Enemy family icons and boss treatment
4. Battlefield tileset and environment props
5. Battle board background and frame
6. Top bar, wave button, and general button kit
7. Modal card kit for store, settings, and end screens
8. UI icons, effects, badges, and status icons
9. Hero portraits and hero dock treatment
10. Polish pass for consistency across all screens

## Rejection Criteria

Reject any asset that:

- Reads poorly at mobile size
- Breaks the established palette or finish
- Looks too realistic, too gritty, or too flat
- Feels copied from Clash Royale instead of inspired by it
- Uses a weak silhouette
- Loses the 1x1 tower footprint
- Makes the maze harder to read
- Has inconsistent outline thickness or lighting
- Fights the other family members instead of belonging with them

## Current Backlog

The asset backlog is intentionally small right now:

- `assets/towers/sniper.png`
- `assets/towers/gold.png`
- Optional flyer sheet if we ever want animated flyers instead of the current
  static or procedural treatment
- Hero roster and sheets, only when we decide to move them out of low priority

## Working Rule

Approve one asset or one asset family at a time. If a family fails the
checklist, revise it before moving on.

## Production Contracts

- Production UI uses the local `assets/ui/icons.svg` family; operating-system emoji are not primary controls.
- Battlefield ground stays flat and low-frequency. Route information is a sparse moving dash, never a second path-tile layer.
- The board frame is one fitted stone structure with an opaque seam-safe base, not repeated diagonal edge tiles.
- Red-brick walls share world-aligned mortar courses, outline only exposed edges, never scale during placement, and never show a level dot.
- Towers and enemies declare a 32px logical footprint and normalized pivot metadata in `assets/manifest.json`.
