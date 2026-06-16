# Mazecore TD — Native Rebuild Handoff (Google AI Studio / Android)

**Status:** the complete, balanced web game is preserved in this repo at tag
`web-v1.0` (commit `a89fee1`). This document is the brief for rebuilding it as a
**native Android app** in **Google AI Studio** (Kotlin + Jetpack Compose) in a
**new repo**. Nothing here changes the web game — it captures the *design* so the
native build doesn't re-derive a single decision.

---

## Why a rebuild (and not a wrap)

The web game is vanilla-JS HTML5 Canvas. We evaluated Capacitor (wrap the web
app) vs Google AI Studio's native Android builder. **AI Studio's Android feature
generates native Kotlin + Jetpack Compose *only*, from prompts — it has no
WebView and cannot import HTML/JS/CSS or static assets**
([Google docs](https://ai.google.dev/gemini-api/docs/aistudio-android),
[Android Developers Blog, May 2026](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)).
So the existing code cannot be hosted; the game is **re-implemented natively**,
carrying the *design and data* forward rather than the code. AI Studio publishes
to the Play **internal-testing track**; production is managed in Play Console.

**What carries forward:** the design, the balance, the 20 authored levels, the
art direction. **What is rebuilt:** the rendering, the game loop, pathfinding,
UI, persistence, ads — natively.

---

## Source-of-truth map (read these from this repo before prompting AI Studio)

| You want… | Read |
|---|---|
| Player-facing spec (rules, controls, towers, scoring) | `README.md` |
| **Why** every mechanic is the way it is (the design bible) | `DECISIONS.md` |
| Campaign/checkpoint/economy design rationale | `CAMPAIGN_PLAN.md` |
| Build history, phase by phase | `PROGRESS.md` |
| **All tunable numbers + data tables** (towers, enemies, armor matrix, hero, ads) | `src/config.js` → exported to **`handoff/balance.json`** |
| **The 20 levels + Endless** (board sizes, spawns, exits, checkpoints, obstacles, waves, gold, stars) | `src/game/levels.js` → exported to **`handoff/levels.json`** |
| Algorithms (BFS distance fields, checkpoint chains, siege Dijkstra, hero AI) | `src/game/{state,enemy,tower,hero,wave}.js` + `DECISIONS.md` |
| Art prompts + asset inventory | `tools/gen-assets.mjs`, `assets/manifest.json` |

**`handoff/levels.json` and `handoff/balance.json` are the two files to hand
AI Studio as data.** Re-authoring 20 balanced levels and the full stat matrix by
prompt would be error-prone and lossy; drop them in as `assets/` JSON (or
Kotlin data classes) and load them.

---

## The game in one paragraph

A **vertical (portrait) mobile maze tower-defense** in the cozy, lighthearted
isekai spirit of *Campfire Cooking in Another World*. The field is open; enemies
always walk the **shortest path** from a portal to your campfire, and **your
towers are the walls**. You build a long winding maze (plus dirt-cheap Wall
blocks) to force enemies past your few weak towers as long as possible. A
**20-level campaign** (Gem-TD checkpoint flags, growing boards) feeds a
star-rated world map; a persistent fighting **hero** guards the exit; **rewarded
ads** grant gold. Mazing — not tower power — wins.

---

## Core design spec (self-contained)

### The maze-defense twist + checkpoints
- Enemies continuously path to the exit via **shortest route**; towers/walls are
  impassable, so placements reshape the path. (Native: a BFS distance field per
  target over the grid; enemies step "downhill." See `DECISIONS.md` "Pathfinding.")
- **Checkpoint flags (Gem TD):** from level 4, enemies must visit flags in order
  (spawn → CP1 → CP2 → … → exit), shortest path between each — one small maze is
  walked 3–5 times. Flyers honour flags too (straight-line between them).
- **You may seal the maze** — cut-off enemies swarm the cheapest wall and
  **destroy it** (each enemy has an `atk` stat). No refund on rubble. This is the
  "siege" mechanic; it makes walling-off a gamble, and enables juggling.

### Towers — small, weak, cheap (mazing is the weapon)
Exact stats in `handoff/balance.json`. The shipped roster:
| Tower | Cost | Role |
|---|---|---|
| **Wall** | 5g | No attack. Tough (160 HP). **Sells back 100%** → juggling is free. The maze piece. |
| **Cannon** | 15g | Small splash, **land only**. Unlocks L1. |
| **Magic** | 22g | Slows, hits **land + air**. Unlocks L3. |
| **Falcon** | 18g | **Air only**, a summoned falcon circles the perch and swoops on attack. Unlocks L7 (one before the first flyers). |
- **Towers cap at level 3.** Each upgrade costs *more than the tower* (L2 = 2× base, L3 = 4×). A maxed tower is a real investment, so a deeper maze is usually the better buy.
- Six more towers (archer/frost/arcane/venom/tesla/beacon) exist in `balance.json` as a **hidden future-unlock pool** — ignore for v1.

### Enemies + armor matrix
8 types (grunt/runner/brute/spawnling/wisp(flyer)/mender(healer)/warden(shield)/boss) with hp/speed/armor-type/`atk`/bounty in `balance.json`. **WC3-style damage×armor matrix** (pierce/siege/magic/poison/chaos × unarmored/light/medium/heavy/fortified/boss, 0.5–1.5×) — towers are strong/weak vs specific armor classes; shown as badges. Full table in `balance.json.damageVsArmor`.

### Hero (guard-post auto-combat, persistent)
- Anchors to a **guard post** (last commanded spot); auto-engages enemies in
  aggro range — **wall-chewers first** — chases on a leash, returns home. Tap to
  reposition; tap-then-ground to move. Two abilities on cooldowns.
- **Persists across levels** (level/XP carried in the profile); **stars buy
  permanent hero upgrades** (HP/damage/cooldown/respawn). Visible sword-slash on
  melee. Stats + ability defs in `balance.json.hero`.

### Economy & progression
- Per-level starting gold, lives, wave count, star thresholds — all in
  `levels.json`. Kill bounty + wave-clear bonus + interest. Cheap towers + ~40%
  generous gold = many pieces, big mazes.
- **Stars:** 1–3 per level by lives kept (`levels.json[].stars`). A level unlocks
  when the previous has ≥1 star. **Endless** unlocks after level 10.
- **World map:** vertical winding trail of numbered badges over scenic art
  (`assets/misc/worldmap.png`), stars under each, next level pulsing.
- **Profile** (localStorage in web → DataStore/Prefs native): stars per level,
  hero level/XP, star-upgrade tiers, settings.

### Monetization — rewarded ads
- **FREE GOLD** top-bar button: grant = `base + perWave×wave`, dual-gate cooldown
  (3 waves AND 4 minutes). **Revive** once per run on defeat (+5 lives).
  Constants in `balance.json.ads`. Web used a *simulated* provider behind a clean
  `setProvider` seam — **native gets first-class Google AdMob** (a real upgrade;
  see translation table).

### Art direction
Bright, clean **anime / cozy-isekai**: saturated colors, simple flat cel shading,
soft outlines, slightly chibi, golden-hour meadow board, timber frame, **portal**
spawns + **campfire** exits, bush/rock scenery. Full prompt recipes in
`tools/gen-assets.mjs` (the `STYLE` constant + per-asset hints). Inventory in
`assets/manifest.json` (towers, 8 enemies + 4-frame walk sheets, 3 heroes, world
map, title, markers, app icon). These PNGs are reusable as native drawables.

### Balance targets (the contract a correct rebuild must hold)
- A competent mazer clears **all 20 levels**; a no-maze "scatter a few towers"
  player first **loses around level 8**.
- Level 1 is a tiny **7×9** board, one spawn top-left, one exit bottom-right,
  Wall+Cannon only, 8 waves.
- (Web validated this with headless sims — `scratch/campaign-sim.mjs`. Native has
  no equivalent yet; see Risks.)

---

## Web → Native (Kotlin / Jetpack Compose) translation

| Web subsystem | Native approach | Notes / risk |
|---|---|---|
| 60 Hz fixed-timestep loop + `<canvas>` | A game loop driving a **single drawing surface** — Compose `Canvas`/`DrawScope` redrawn each frame, or a `SurfaceView`/custom `View`. **Do NOT** model towers/enemies as recomposing Compose widgets. | A real-time game on a draw surface is *not* AI Studio's sweet spot (it favors form-style Compose). This is the #1 risk — see Risks. |
| BFS distance fields, checkpoint chains, siege Dijkstra | Reimplement on an `IntArray`/`Array` grid; algorithms documented in `DECISIONS.md` + `src/game/{state,enemy}.js`. Pure logic, ports cleanly to Kotlin. | Deterministic; unit-testable in Kotlin. |
| Per-level grid size (live bindings) | A `Level` data class carries `cols/rows`; the renderer reads it. | `levels.json` already has these. |
| `localStorage` profile + save | **DataStore** (Preferences or Proto) or `SharedPreferences`. | Shape mirrors `src/services/profile.js`. |
| Simulated ads (`ads.js` + `setProvider`) | **Google AdMob native SDK** (`com.google.android.gms:play-services-ads`) — real rewarded ads. | A genuine upgrade: native ads are first-class. Use AdMob **test ad unit IDs** until your AdMob account + real unit IDs exist. |
| Sprites + 4-frame walk sheets | Reuse the `assets/` PNGs as drawables / a sprite atlas; index frames the same way `sprites.js` does (alpha-bbox centering optional). | Walk sheets are 2×2 grids. |
| DOM UI (top bar, radial build menu, hero dock, sheets, world map) | **Compose UI overlaid on the game surface** — this part IS AI Studio's strength. | Radial build menu, star world map, stat-pip tower cards. |
| Portrait lock, PWA manifest | `android:screenOrientation="portrait"`, app manifest. | — |
| Procedural WebAudio SFX | Native `SoundPool`/short audio assets, or skip for v1. | Low priority. |

---

## Recommended rebuild sequence (each step = one AI Studio prompt iteration)

Build the game *engine-first*, smallest playable slice growing outward. Feed
`balance.json` + `levels.json` as project assets early so numbers are never
hand-typed.

1. **Scaffold** — portrait app, a full-screen game surface + a Compose overlay shell.
2. **Board** — draw a grid from a `Level` (cols/rows), the cozy meadow/portal/campfire.
3. **One enemy walks a path** — BFS distance field to the exit; enemy steps downhill; leaks cost a life.
4. **Build a wall** — tap a cell → place a Wall → path **re-routes live**. (The core feel; nail this before anything else.)
5. **One tower shoots** — Cannon: acquire nearest in range, projectile, damage, bounty gold.
6. **Waves** — spawn a timed wave from `levels.json`, wave-clear payout, lose at 0 lives.
7. **Import the campaign** — load all 20 levels from `levels.json`; level 1 fully playable.
8. **Checkpoints** — the stage chain (spawn→flags→exit), flyers honour flags.
9. **Roster + economy** — Magic, Falcon (air-only summon), L3 cap, escalating upgrade cost, wall 100% refund, the armor matrix.
10. **Hero** — guard-post auto-engage, abilities, the bottom dock.
11. **Siege** — sealing allowed → enemies chew walls (per-enemy `atk`, tower HP).
12. **Progression** — stars, world-map level select, profile persistence (DataStore), Endless.
13. **Monetization** — AdMob rewarded FREE-GOLD + defeat revive (test ad units).
14. **Polish** — walk-cycle frames, slash/recoil/swoop animations, SFX, splash/icon.

---

## New-repo setup checklist

- [ ] New Google AI Studio Android project (new repo / GitHub export).
- [ ] Package name (e.g. `com.danreola.mazecoretd`), portrait-locked.
- [ ] Drop `handoff/levels.json` + `handoff/balance.json` into `assets/`.
- [ ] Copy the `assets/*.png` art over as drawables (regenerable via `tools/gen-assets.mjs` prompts if you want higher-res).
- [ ] Google Play developer account (one-time $25) for the internal-testing upload AI Studio automates.
- [ ] AdMob account → app ID + rewarded ad-unit IDs (use **test IDs** until then; never ship test IDs to production).
- [ ] Adaptive icon + splash (start from `assets/misc/icon.png`).
- [ ] Privacy policy + Play **Data safety** form (ads collect device/usage data — required).

---

## Risks & honest caveats

1. **AI Studio fit for a real-time game (highest risk).** Its Android builder
   excels at Compose form/CRUD apps generated from prompts; a 60 Hz custom-rendered
   tower-defense with live pathfinding is far outside that shape. Expect to **edit
   code directly** (AI Studio's Code tab) and likely **export to Android Studio**
   for the engine/game-loop work. Treat AI Studio as the scaffolder + UI builder +
   Play-upload convenience, not the author of the simulation.
2. **Balance must be re-validated natively.** The web build's guarantee ("all 20
   clear / careless dies ~L8") came from headless JS sims that don't port. Either
   rebuild a small native headless sim of the maze/wave loop, or hand-test each
   level. The numbers in `balance.json`/`levels.json` are a *strong tuned starting
   point*, not a guarantee under a re-implemented engine.
3. **Publishing ceiling.** AI Studio → internal-testing track only; production
   release is manual in Play Console. iOS/App Store is **out of scope** for the AI
   Studio path entirely (Android only).
4. **Determinism.** Web seeded RNG (mulberry32) drives reproducible maps/waves;
   replicate the exact seed math if you want identical level behavior, or accept
   re-tuned spawns.

---

## Verification (how to know the native rebuild is faithful)

- Level 1 (7×9) is playable corner-to-corner; placing a Wall visibly re-routes the path.
- A checkpoint level shows enemies looping through flags in order (ground **and** air).
- Sealing the maze makes enemies chew and destroy a wall, then resume.
- Cannon ignores flyers; Falcon ignores ground; Magic hits both.
- A maxed (L3) tower costs ~7× its build price in total; walls refund 100%.
- Stars gate levels; hero level persists across two levels; FREE GOLD ad grants gold.
- Difficulty contract holds: a real maze clears the campaign; a few scattered
  towers with no maze stalls out by ~level 8.

---

*Preserved web reference: this repo @ tag `web-v1.0`. Clone/bundle it alongside
the new native repo so `DECISIONS.md`, `config.js`, `levels.js`, and the running
game stay one command away while rebuilding.*
