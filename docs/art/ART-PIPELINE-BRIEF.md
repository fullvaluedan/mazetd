# Maze Defenders — Art Pipeline Brief

User-authored methodology (2026-07-06), recorded verbatim-in-structure. This brief +
`reference/art-guide.png` are the inputs to planning U16 (art constitution + generation
pipeline) and U18 (tile-based map rendering + autotiler). The game's confirmed name is
**Maze Defenders**.

## The constitution principle

The Art Guide (`docs/art/reference/art-guide.png`, v1.0) is the "constitution" of the
game. Every asset generation references it, so that after generating hundreds of assets
over weeks they all look like they belong in the same world. Consistency of references
matters more than the specific prompt wording.

## Three reference images per generation (never just one)

```
Game Art Bible -> Perspective Guide -> Asset Template -> Reference Character (optional) -> Generate
```

1. **Reference 1 — the Art Guide.** "This defines the universe." Never changes.
   Carries: perspective, color palette, lighting, outline thickness, saturation, tile
   size, tower scale, creature proportions, animation rules. Every prompt begins:
   "Follow the attached Maze Defenders Art Guide exactly. Match the color palette,
   perspective, outlines, proportions, lighting direction, and rendering style."
2. **Reference 2 — the Perspective Guide.** The most important one. Contains ONLY:
   top-down 30-degree camera, one ground tile, one tower, one enemy, one tree, one
   building, one wall — with measurements. Never changes. Measurements:
   camera 30 degrees; tile 32x32; tower footprint 1 tile; character height 1 tile;
   building 2-4 tiles; tree 1.5 tiles; light upper-left; shadow lower-right.
   (This image does not exist yet — generating and approving it is an early deliverable.)
3. **Reference 3 — the family asset sheet.** Depends on what is being generated.
   Generating a goblin: attach the existing goblin scout/warrior/archer and say "match
   these exactly." Generating a lightning tower: attach the existing arrow/frost/fire/
   poison towers. New assets automatically join the family.
4. **Optional Reference 4 — real-world inspiration** (shape language only: temple,
   mushroom, crab, lantern, fox, ancient tree). Prompt: "Use these only as inspiration
   for silhouette and theme. Do not copy any existing copyrighted designs."

## Standard prompt template

```
Reference 1: Maze Defenders Art Guide
Reference 2: Perspective Guide
Reference 3: Existing [family] assets

Task: Create [asset].

Requirements:
- Nintendo-Switch-era creature-collecting RPG aesthetic (original, no copyrighted designs)
- Bright colors
- 30-degree top-down perspective
- Fits inside [N] tile(s)
- Thick readable silhouette
- Light from upper left
- Outline thickness identical to references
- [asset-specific theme lines]
- No background / transparent PNG
```

## Pipelines

- **Character:** photo -> 4 original style explorations -> choose one -> front/back/left/
  right -> idle/walk/attack/hurt/celebrate (+death if enemy) -> portrait.
- **Enemy families:** family -> scout -> warrior -> mage -> elite -> boss. Every family
  reuses colors, horns, armor, ears, weapons so players instantly read "that's the elite
  version." Guide families: goblinoids, skeletons, slimes, beasts, machines, elementals.
- **Tower families:** design by family (nature, arrow, frost, fire, arcane, mechanical,
  shadow), sharing foundation, materials, trim, banners, crystals. Upgrades stay cohesive
  (Lv1-Lv5 progression per tower, see the guide's cannon example).
- **Animation:** generate the static concept FIRST, get approval, only then generate
  idle/walk/attack/death sheets. Never both simultaneously (consistency drops).

## Naming convention

```
tower_arrow_lv1.png   tower_arrow_sheet.png
enemy_goblin_scout_sheet.png   boss_tree_guardian_sheet.png
projectile_fireball.png   effect_poison.png
```

## Technical constants (from the guide)

Tile 32x32 px; tower footprint 1x1 tile (acts as wall); sprite outline 2px; light
top-left; animation 4-8 fps; PNG RGBA; transparent backgrounds.

## The Art Bible (to be written as the multi-page source of truth)

1. Vision & art pillars (bright/friendly/adventurous, clean silhouettes at small sizes,
   consistent perspective, functional first, readable effects)
2. Camera & perspective (30-degree top-down, tile grid, footprints, height/scale rules)
3. Color & lighting (master palette, material colors, shadow intensity, highlights)
4. Environment (terrain, cliffs, props, buildings)
5. Creatures (shape language, archetypes, animation standards, evolution hierarchy)
6. Towers (families, upgrade progression, materials, silhouette rules)
7. Effects (projectiles, explosions, status effects, spells)
8. UI (icons, panels, typography, HUD)
9. Sprite sheets (layout templates, frame counts, naming, export settings)

Once complete, generating the next 500 assets becomes almost mechanical.

## Engineering context for the planner

- Generator to upgrade: `tools/gen-assets.mjs` (no-dependency Node, reads OPENAI_API_KEY
  from gitignored `.env` — key present and verified). v2 must switch to the images-edit
  endpoint with the 3 reference images attached per call, use the template above, write
  the naming convention, and update `assets/manifest.json`.
- The game loads sprites via `assets/manifest.json` + `src/ui/sprites.js` with shape
  fallbacks; assets will be committed (not gitignored) once generated (store builds
  clone the repo — see U7 in the main plan).
- U18 (mapping): boards render from the guide's tile set (grass/dirt/stone-path/sand/
  water/cliffs/bridge/exit + variants + decorations). Connection sets (paths, water,
  cliffs) REQUIRE an autotiler, never raw stamps. The static tile layer folds into the
  offscreen map cache being built in U4 of the main plan.
- Cost discipline: paid API. Dial in style on 1-2 test images per family before any
  batch. NO batch generation without Dan's explicit go in that session.
- Current in-game roster the art must eventually cover: 8 towers (arrow, cannon, frost,
  poison, sniper, lightning, support, gold) + wall, 8 enemy types reskinned into guide
  families, bosses, projectiles/effects, tiles, UI icons. Tower/enemy data lands in
  U5-U8 of the main plan (`docs/plans/2026-07-06-001-feat-wc3-progression-mobile-plan.md`).
