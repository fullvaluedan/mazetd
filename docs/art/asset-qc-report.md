# Production Asset QC Report

## Level 1 Map Kit, 2026-07-11

| Asset | Active path | Pixel bounds | Footprint | Pixel QC | Runtime scene |
| --- | --- | --- | --- | --- | --- |
| Dirt floor | `assets/tiles/floor-dirt-v1.png` | 64x64 | 1x1 | opaque edge pixels | verified repeated on Level 1 |
| Stone pad/frame | `assets/tiles/stone-pad-v1.png` | 64x64 | 1x1 | opaque edge pixels | verified as frame and objective pad |
| Portal | `assets/objectives/portal-v1.png` | 192x192 | 3x3 | alpha inside canvas | clipped to upper-left entry pad |
| Crystal | `assets/objectives/crystal-v1.png` | 192x256 | 3x4 | alpha inside canvas | clipped to lower-right objective pad |
| Red brick wall | `assets/towers/wall-redbrick-v1.png` | 64x64 | 1x1 | opaque edge pixels | visually distinct from dirt and stone |

## Evidence

- `node tools/asset-qc.mjs --all`: `ASSET_QC_OK`
- `node test/t19-production-assets.mjs`: `PRODUCTION_ASSETS_OK`
- `node test/t19-map-kit.mjs`: `MAP_KIT_QC_OK`
- Focused Level 1 browser smoke: no console errors; portal remains within 3x3, crystal remains within 3x4, tile source is not vertically stretched.

## Outstanding Gate

- Full-suite result is recorded after the current Level 1 corner-route rebalance check. Tower and enemy production assets must not be promoted until this map gate is approved.

## Arrow 2x2 Family, Staging, 2026-07-11

Arrow L1-L5 and the attack atlas are explicitly approved and promoted as
versioned runtime assets.

| Artifact | Staging path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Active static tiers L1-L5 | `assets/towers/arrow-lv1-v2.png` through `assets/towers/arrow-lv5-v2.png` | 128x128 each | RGBA, full 2x2 edge coverage for flush placement |
| Active attack atlas | `assets/sheets/tower-arrow-attack-v2.png` | 256x256, 2x2 frames | four full-edge, non-identical 128x128 frames |
| Family contact sheet | `docs/art/contact-sheets/towers/arrow-family-staging-v2.png` | 640x384 | accepted staging review artifact |
| Map-scale proof | `assets/staging/tower-family/arrow/arrow-family-map-proof-v2.png` | 768x1024 | L1-L5 placed on distinct grid-valid 2x2 slots |

## Arrow Evidence

- `node test/t19-arrow-staging.mjs`: `ARROW_STAGING_QC_OK`.
- Every static tier and action frame now has alpha coverage from `0..127` in
  both axes. The renderer draws the exact occupied 2x2 rectangle with no
  inset, so adjacent towers meet flush without a dirt seam. See
  `assets/staging/tower-family/arrow/arrow-adjacency-proof-v2.png`.
- `node tools/asset-qc.mjs --all`, map-asset, footprint, and render tests pass.
- Browser smoke at `390x844` and `1440x900`: active modular Level 1 map kit
  has continuous framing, square floor tiles, and contained objectives with no
  console warnings. The Arrow staging family is intentionally not loaded by
  this smoke until promotion.
- Two L2 whole-tower sources were rejected because they rendered a 4x4 stone
  base. They are preserved under `assets/staging/tower-family/arrow/rejected/`.

## Arrow Completion

- Arrow L1-L5 and its attack atlas are active runtime art. The family has passed
  explicit approval, alpha/dimension QC, focused tests, map-scale proof, and
  mobile/desktop composition review.

## Cannon Family, 2026-07-11

| Artifact | Staging path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Cannon L1 | `assets/staging/tower-family/cannon/cannon-lv1-2x2-grid-v2.png` | 128x128 | RGBA, full 2x2 edge coverage |
| Map-scale proof | `assets/staging/tower-family/cannon/cannon-lv1-map-proof-v1.png` | 768x1024 | grid-aligned 2x2 placement beside Arrow, walls, and objectives |

The source is an orthographic top-down bronze mortar with exactly four square
foundation slabs. Cannon L1-L5 are approved and active as full-footprint
runtime assets. Its firing feedback remains renderer-owned: glow, shake, and
smoke augment the approved static art rather than replacing it with an
unapproved sheet.

## Frost Family, 2026-07-11

Frost L1 was approved individually; the matching L2-L5 contact-sheet batch was
then explicitly approved and promoted.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static tiers L1-L5 | `assets/towers/frost-lv1-v2.png` through `assets/towers/frost-lv5-v2.png` | 128x128 each | RGBA, full 2x2 edge coverage, centered pivot |
| Upgrade contact sheet | `assets/staging/tower-family/frost/frost-family-staging-v2.png` | staging review artifact | L2-L5 accepted as a coherent family |

## Frost Evidence

- `node tools/asset-qc.mjs --all`: `ASSET_QC_OK`, including Frost L1-L5.
- `node test/t19-production-assets.mjs`: `PRODUCTION_ASSETS_OK` with 64x64
  logical bounds and 2x2 footprints for every tier.
- `node test/t12render.mjs` and `node test/t12mechanics.mjs` both pass.
- Full-edge alpha bounds and the exact 2x2 renderer rectangle preserve the
  approved flush-placement contract established by Arrow.

## Frost Attack Atlas, 2026-07-12

The approved Frost attack candidate is now promoted as the runtime `v2` atlas.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Attack atlas | `assets/sheets/tower-frost-attack-v2.png` | 256x256, 2x2 frames | four full-edge, non-identical 128x128 frames |

- `node test/t19-frost-staging.mjs`: `FROST_STAGING_QC_OK`.
- `node tools/asset-qc.mjs --all`, `node test/t19-production-assets.mjs`,
  `node test/t12render.mjs`, and `node test/t12mechanics.mjs` pass after
  promotion.

## Poison Family, 2026-07-11

Poison L1 was approved as a purple-liquid beaker with a readable white skull;
the matching L2-L5 single-source batch was explicitly approved and promoted.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static tiers L1-L5 | `assets/towers/poison-lv1-v3.png` through `assets/towers/poison-lv5-v3.png` | 128x128 each | RGBA, full 2x2 edge coverage, centered pivot |
| Active attack atlas | `assets/sheets/tower-poison-attack-v3.png` | 256x256, 2x2 frames | charge, upward spit, recoil, settle; four full-edge distinct frames |
| Family contact sheet | `assets/staging/tower-family/poison/poison-family-staging-v3.png` | staging review artifact | L1-L5 accepted as a coherent upgrade family |
| Map-scale proof | `assets/staging/tower-family/poison/poison-family-map-proof-v3.png` | 768x1024 | five grid-valid 2x2 placements accepted in context |

## Poison Evidence

- Every static tier has alpha coverage from `0..127` in both axes; no source
  is inset from its occupied 2x2 rectangle.
- `node tools/asset-qc.mjs --all` and
  `node test/t19-production-assets.mjs` validate the promoted files and their
  64x64 logical/2x2 manifest metadata.
- `node test/t19-poison-staging.mjs` validates all five static sources plus
  the approved attack atlas's frame geometry and distinct pixel content.

## Sniper Family, 2026-07-11

The first Sniper L1 candidate was rejected because its dark, narrow silhouette
did not read as a rifle at map scale. The brighter oak-and-gold L1 revision
with a large emerald scope was approved, followed by its L2-L5 batch.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static tiers L1-L5 | `assets/towers/sniper-lv1-v4.png` through `assets/towers/sniper-lv5-v4.png` | 128x128 each | RGBA, full 2x2 edge coverage, centered pivot |
| Active attack atlas | `assets/sheets/tower-sniper-attack-v3.png` | 256x256, 2x2 frames | scope charge, vertical muzzle flash, smoke recoil, settle |
| Family contact sheet | `assets/staging/tower-family/sniper/sniper-family-staging-v4.png` | staging review artifact | L1-L5 accepted after user-directed tier rotation |
| Map-scale proof | `assets/staging/tower-family/sniper/sniper-family-map-proof-v4.png` | 768x1024 | corrected five-tier order accepted in context |

## Sniper Evidence

- Every static tier has alpha coverage from `0..127` in both axes and uses the
  exact 64x64 logical/2x2 manifest contract.
- Static tier labels were rotated after review: prior L2 -> L1, L3 -> L2,
  L4 -> L3, L5 -> L4, and the larger prior L1 -> L5.
- `node tools/asset-qc.mjs --all`, `node test/t19-production-assets.mjs`,
  `node test/t12render.mjs`, and `node test/t12mechanics.mjs` pass after
  promotion.
- `node test/t19-sniper-staging.mjs` validates the rotated static source order
  plus the approved atlas's full-edge frame geometry and distinct frame hashes.

## Lightning Family, 2026-07-12

Lightning L1-L5 were already approved; the attack atlas was normalized into a
versioned 2x2 runtime sheet and promoted.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static tiers L1-L5 | `assets/towers/lightning-lv1-v2.png` through `assets/towers/lightning-lv5-v2.png` | 128x128 each | RGBA, full 2x2 edge coverage, centered pivot |
| Active attack atlas | `assets/sheets/tower-lightning-attack-v2.png` | 256x256, 2x2 frames | four full-edge, non-identical 128x128 frames |
| Family contact sheet | `assets/staging/tower-family/lightning/lightning-family-staging-v2.png` | staging review artifact | approved static direction retained |
| Map-scale proof | `assets/staging/tower-family/lightning/lightning-family-map-proof-v2.png` | 768x1024 | five grid-valid 2x2 placements accepted in context |

## Lightning Evidence

- `node tools/asset-qc.mjs --all`: `ASSET_QC_OK`, including the promoted
  Lightning attack atlas.
- `node test/t19-production-assets.mjs`: `PRODUCTION_ASSETS_OK` with the
  versioned Lightning sheet contract.
- `node test/t19-lightning-staging.mjs`: `LIGHTNING_STAGING_QC_OK`.

## Support Family, 2026-07-12

Support L1-L5 were normalized from the approved staging art and promoted with a
new aura loop sheet.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static tiers L1-L5 | `assets/towers/support-lv1-v2.png` through `assets/towers/support-lv5-v2.png` | 128x128 each | RGBA, full 2x2 edge coverage, centered pivot |
| Active aura atlas | `assets/sheets/tower-support-aura-v1.png` | 256x256, 2x2 frames | four full-edge, non-identical 128x128 frames |
| Family contact sheet | `assets/staging/tower-family/support/support-family-staging-v2.png` | staging review artifact | L1-L5 accepted as a coherent family |
| Map-scale proof | `assets/staging/tower-family/support/support-family-map-proof-v2.png` | 768x1024 | five grid-valid 2x2 placements accepted in context |

## Support Evidence

- `node tools/asset-qc.mjs --all`: `ASSET_QC_OK`, including the promoted
  Support aura sheet.
- `node test/t19-production-assets.mjs`: `PRODUCTION_ASSETS_OK` with the
  versioned Support static and aura contracts.
- `node test/t19-support-staging.mjs`: `SUPPORT_STAGING_QC_OK`.

## Gold Mine Family, 2026-07-12

Gold Mine L1-L5 were normalized from the approved staging art and promoted
with a new income loop sheet.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static tiers L1-L5 | `assets/towers/gold-lv1-v2.png` through `assets/towers/gold-lv5-v2.png` | 128x128 each | RGBA, full 2x2 edge coverage, centered pivot |
| Active income atlas | `assets/sheets/tower-gold-income-v1.png` | 256x256, 2x2 frames | four full-edge, non-identical 128x128 frames |
| Family contact sheet | `assets/staging/tower-family/gold/gold-family-staging-v2.png` | staging review artifact | L1-L5 accepted as a coherent family |
| Map-scale proof | `assets/staging/tower-family/gold/gold-family-map-proof-v2.png` | 768x1024 | five grid-valid 2x2 placements accepted in context |

## Gold Evidence

- `node tools/asset-qc.mjs --all`: `ASSET_QC_OK`, including the promoted Gold
  Mine income sheet.
- `node test/t19-production-assets.mjs`: `PRODUCTION_ASSETS_OK` with the
  versioned Gold Mine static and income contracts.
- `node test/t19-gold-staging.mjs`: `GOLD_STAGING_QC_OK`.

## Frost Attack Candidate, 2026-07-12

Frost attack atlas has been normalized into a staging candidate and is ready
for user approval before promotion.

| Artifact | Staging path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Approved static tiers L1-L5 | `assets/staging/tower-family/frost/frost-lv1-2x2-grid-v2.png` through `assets/staging/tower-family/frost/frost-lv5-2x2-grid-v2.png` | 128x128 each | RGBA, full 2x2 edge coverage |
| Attack atlas candidate | `assets/staging/tower-family/frost/frost-attack-2x2-grid-v2.png` | 256x256, 2x2 frames | four full-edge, non-identical 128x128 frames |

## Frost Evidence

- `node test/t19-frost-staging.mjs`: `FROST_STAGING_QC_OK`.
- Attack atlas candidate frame bounds fill the full 2x2 quadrants and remain
  distinct by pixel hash.

## Grunt Enemy Family, 2026-07-12

Grunt is the first approved enemy family. Its raw identity board preserves the
rejected perspective source; the normalized static, walk, and defeat sources
are promoted as versioned runtime art.

| Artifact | Staging path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/normal-v2.png` | 64x64 | RGBA, safe transparent padding |
| Walk atlas | `assets/sheets/enemy-normal-walk-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-normal-defeat-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/grunt/grunt-map-proof-v1.png` | 768x1024 | two 64px placements on a strict 12x16 grid |

## Grunt Evidence

- `node test/t19-grunt-staging.mjs`: `GRUNT_STAGING_QC_OK`.
- The first generated identity board was rejected for a slight 3/4 camera read
  and remains preserved under `assets/staging/enemy-family/grunt/rejected/`.
- The selected v2 source is strict overhead with no ground shadow. The
  renderer selects its walk sheet while moving and renders defeat frames from
  a cosmetic queue without delaying logical death, bounty, or wave cleanup.

## Runner Enemy Family, 2026-07-12

Runner is the second approved enemy family, using a smaller charcoal silhouette
with a bright yellow motion accent to remain readable beside Grunt at map scale.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/fast-v2.png` | 64x64 | RGBA, safe transparent padding |
| Run atlas | `assets/sheets/enemy-fast-walk-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-fast-defeat-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/runner/runner-map-proof-v1.png` | 768x1024 | two 64px placements on a strict 12x16 grid |

## Runner Evidence

- `node test/t19-runner-staging.mjs`: `RUNNER_STAGING_QC_OK`.
- The source provided three explicit defeat poses; the fourth is a deterministic
  half-alpha fade of the approved final dissipate pose, preserving the source
  art while completing the required four-frame sequence.
- `node tools/asset-qc.mjs --all`, `node test/t19-production-assets.mjs`,
  `node test/t12render.mjs`, `node test/t12mechanics.mjs`, and
  `git diff --check` pass after promotion.

## Brute Enemy Family, 2026-07-12

Brute is the approved large fortified enemy family. Its source cells remain
larger than standard enemies so its armored silhouette stays readable at scale.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/tank-v2.png` | 96x96 | RGBA, safe transparent padding |
| Heavy-walk atlas | `assets/sheets/enemy-tank-walk-v2.png` | 192x192, 2x2 frames | four distinct 96x96 frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-tank-defeat-v2.png` | 192x192, 2x2 frames | four distinct 96x96 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/brute/brute-map-proof-v1.png` | 768x1024 | two 96px placements on a strict 12x16 grid |

## Brute Evidence

- `node test/t19-brute-staging.mjs`: `BRUTE_STAGING_QC_OK`.
- Brute declares a separate `48x48` logical/`96px` source contract in both the
  generator and manifest; it is not forced into the standard enemy geometry.
- `node tools/asset-qc.mjs --all`, `node test/t19-production-assets.mjs`,
  `node test/t12render.mjs`, `node test/t12mechanics.mjs`, and
  `git diff --check` pass after promotion.

## Spawnling Enemy Family, 2026-07-12

Spawnling is the small swarm hatchling family. Its sources stay intentionally
smaller than standard enemies so a packed swarm remains readable.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/swarm-v2.png` | 48x48 | RGBA, safe transparent padding |
| Walk atlas | `assets/sheets/enemy-swarm-walk-v2.png` | 96x96, 2x2 frames | four distinct 48x48 frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-swarm-defeat-v2.png` | 96x96, 2x2 frames | four distinct 48x48 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/spawnling/spawnling-map-proof-v1.png` | 768x1024 | placements on a strict 12x16 grid |

## Spawnling Evidence

- `node test/t19-spawnling-staging.mjs`: `SPAWNLING_STAGING_QC_OK`.
- Spawnling declares a separate `24x24` logical/`48px` source contract in both
  the generator and manifest.
- `node tools/asset-qc.mjs --all` and `node test/t19-production-assets.mjs`
  validate the promoted files against that contract.

## Wisp Enemy Family, 2026-07-12

Wisp is the flying family. It uses hover motion instead of a walk cycle, and
the renderer draws no ground contact shadow for flying units — the sprite
silhouette carries the read.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/flyer-v2.png` | 64x64 | RGBA, safe transparent padding |
| Hover atlas | `assets/sheets/enemy-flyer-walk-v2.png` | 128x128, 2x2 frames | four distinct 64x64 hover frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-flyer-defeat-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/wisp/wisp-map-proof-v1.png` | 768x1024 | two 64px placements on a strict 12x16 grid |

## Wisp Evidence

- `node test/t19-wisp-staging.mjs`: `WISP_STAGING_QC_OK`.
- The renderer's flying branch adds a hover bob and skips the ground shadow
  ellipse entirely (`src/ui/render.js` drawEnemies); verified in browser
  composition checks at `390x844` and `1440x900`.
- `node tools/asset-qc.mjs --all` and `node test/t19-production-assets.mjs`
  validate the promoted files and their `32x32` logical metadata.

## Mender Enemy Family, 2026-07-12

Mender is the healer family: a green-robed acolyte with a warm lantern accent,
strict overhead with no baked ground shadow.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/healer-v2.png` | 64x64 | RGBA, safe transparent padding |
| Walk atlas | `assets/sheets/enemy-healer-walk-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-healer-defeat-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/mender/mender-map-proof-v1.png` | 768x1024 | two 64px placements on a strict 12x16 grid |

## Mender Evidence

- `node test/t19-mender-staging.mjs`: `MENDER_STAGING_QC_OK`.
- Standard `32x32` logical/`64px` source enemy contract in generator and
  manifest; the heal aura remains a renderer-owned pulse ring, not baked art.
- `node tools/asset-qc.mjs --all` and `node test/t19-production-assets.mjs`
  validate the promoted static, walk, and defeat files.

## Warden Enemy Family, 2026-07-12

Warden is the shield family: an armored knight inside a blue barrier orb,
strict overhead with no baked ground shadow.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/shield-v2.png` | 64x64 | RGBA, safe transparent padding |
| Walk atlas | `assets/sheets/enemy-shield-walk-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-shield-defeat-v2.png` | 128x128, 2x2 frames | four distinct 64x64 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/warden/warden-map-proof-v1.png` | 768x1024 | two 64px placements on a strict 12x16 grid |

## Warden Evidence

- `node test/t19-warden-staging.mjs`: `WARDEN_STAGING_QC_OK`.
- Standard `32x32` logical/`64px` source enemy contract in generator and
  manifest; the active shield ring remains renderer-owned so it can track
  live shield hit points.
- `node tools/asset-qc.mjs --all` and `node test/t19-production-assets.mjs`
  validate the promoted static, walk, and defeat files.

## Boss Enemy Family, 2026-07-12

Boss is the horned demon-king family. Like Brute it declares its own large
source contract so the silhouette dominates at map scale: `64x64` logical from
a `128px` static source and `256px` state sheets with `128px` frames.

| Artifact | Active path | Pixel bounds | Result |
| --- | --- | --- | --- |
| Static fallback | `assets/enemies/boss-v2.png` | 128x128 | RGBA, safe transparent padding |
| Walk atlas | `assets/sheets/enemy-boss-walk-v2.png` | 256x256, 2x2 frames | four distinct 128x128 frames with safe padding |
| Defeat atlas | `assets/sheets/enemy-boss-defeat-v2.png` | 256x256, 2x2 frames | four distinct 128x128 frames with safe padding |
| Map-scale proof | `assets/staging/enemy-family/boss/boss-map-proof-v1.png` | 768x1024 | two 128px (2-cell) placements on a strict 12x16 grid |

## Boss Evidence

- `node test/t19-boss-staging.mjs`: `BOSS_STAGING_QC_OK`.
- `tools/gen-assets.mjs` now declares dedicated `BOSS_ENEMY_META` and
  `BOSS_SHEET_META` (`64x64` logical) instead of silently inheriting the
  standard 32px enemy metadata, and the regenerated manifest carries the same
  contract. `tools/asset-qc.mjs` checks the 128px static and 256px sheet
  sources with 128px frame bounds.
- Manifest `version` fields are now derived from each promoted file's `-vN`
  suffix inside `buildManifest`, so regenerating the manifest can never roll
  an approved asset's version back.
- `node tools/asset-qc.mjs --all` and `node test/t19-production-assets.mjs`
  (with new Mender, Warden, and Boss assertions) pass.
