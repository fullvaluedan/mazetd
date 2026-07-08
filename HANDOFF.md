# Handoff — Mazecore TD

Read this first if you're picking up this repo cold — as a collaborator, a
future session, or another agent. It's the "what is this, what state is it
in, where do I touch it" doc.

`HANDOFF-NATIVE-REBUILD.md` describes a Google-AI-Studio native-Android
rebuild path — **that plan is shelved.** The user decided (2026-07-06) to
revise this web game in place and ship it to both iOS and Android via
Capacitor 8 instead (Android-only native tooling couldn't hit both stores).
Treat that file as historical only; the live plan is
[`docs/plans/2026-07-06-001-feat-wc3-progression-mobile-plan.md`](docs/plans/2026-07-06-001-feat-wc3-progression-mobile-plan.md).

## What this is

A vertical mobile maze tower-defense game — Wintermaul/Gem-TD/Kingdom-Rush
DNA — built as pure HTML5 Canvas + vanilla JavaScript. **No build step, no
npm dependencies, no framework.**

Core loop: enemies always take the shortest open path from spawn to goal;
your towers *are* the maze walls. A 20-level portrait campaign teaches the
mechanic (checkpoint flags force one maze to be walked 3–5 times), then an
Endless mode (100 procedural waves) tests it. Star economy gates progression
and buys permanent upgrades. (Heroes exist in code but are flag-disabled for
v1 — see U17 below.)

Full mechanics/controls are in [`README.md`](README.md) — this doc won't
repeat them, only the parts a new maintainer needs that the README doesn't
cover.

## Current status (2026-07-08)

Working branch: **`feat/wc3-progression`** (pushed to
`origin/feat/wc3-progression`). This is a from-the-ground-up progression
revision, not a polish pass — see the plan doc linked above for the full
spec (WC3-style economy, pan/zoom camera on bigger boards, 5-tier upgrades,
new 8-tower roster, 20 levels scaling 10→100 waves).

**Side branch `feat/maze-mode`** (off `feat/wc3-progression`): a standalone
**Maze Mode** — wall-only, 1000 gold, one fixed wave of ground mobs, a
survival timer for how long the maze contains the horde, + a local
leaderboard. Nothing kills the mobs (no attack towers), so it's a pure
maze-design + real-time-juggling challenge (build stays open during the run;
selling locks the instant the horde releases). Entry: title-screen
`🧱 MAZE MODE` button → `?level=maze`. Key pieces: `MAZE_MODE_LEVEL` in
`levels.js` (`mazeMode` flag), `state.mazeTimer`, `sellLocked()` in shop.js,
wall-only `buildRingItems`, `services/leaderboard.js` (localStorage;
online board via Worker+D1 is a clean follow-up — same module surface),
`screens.showMazeEnd/showLeaderboard`, a maze-timer wavebar readout, and a
topbar that hides lives/store. Maze Mode is excluded from campaign
save/resume (it's a fresh challenge each launch). Verified headless + live
in-browser (open board ~29s, a serpentine maze ~89s — longer maze = higher
score, as intended).

**Done** (tracked as U1–U21 in the plan doc): test suite promoted into the
repo, economy feel spike, camera core + gestures, render perf for big
boards, 5-tier upgrade machinery, new combat mechanics (income/execute/
shred/line/stun), the new 8-tower roster, the rebuilt 20-level campaign,
per-level economy retune, campaign mid-run save/resume, heroes disabled for
v1, and the multi-select build/sell/upgrade marquee (drag-to-select is now
the default gesture; a plain tap always builds).

**In progress — U10, "balance pass to the new contract."** This is the
current focus and where most recent session time has gone:
- Radial tower-ring bug fixed: upgrade/fork/targeting/sell buttons now sit
  at FIXED role slots (`radial.js`'s `Radial.open()` takes an optional
  `opts.totalSlots` + each item an `it.slot`) instead of evenly re-spacing
  around whatever's currently in the array. Previously, maxing a tower out
  (upgrade item disappearing) shifted every other button into a new
  position — sell would jump into where targeting used to be, etc. Verified
  headless via the project's `fakedom` harness (see `t11economy.mjs`'s
  pattern) across L1→maxed: sell/targeting positions are now pixel-identical
  at every level.
- Roster upgrade costs +100% (`CONFIG.UPGRADE_COST_SCALE = 2`, scoped to
  `def.tiers`-bearing roster towers only — legacy/hidden defs untouched).
- Gold-per-round -35% (`CONFIG.GOLD_PER_ROUND_SCALE = 0.65`, applied to the
  wave-clear bonus in `economy.js` and kill bounties in `wave.js`'s
  `computeStats()` only — interest and income-tower gold are untouched, per
  the user's explicit scoping when asked).
- Early-call wave bonus is now wave-dependent instead of flat: cap(w) =
  `CONFIG.WAVE_CALL_BONUS_BASE (10) + CONFIG.WAVE_CALL_BONUS_PER_WAVE (5) *
  (w-1)` — 10/15/20/.../55 at wave 10 — decaying at the same 1g/sec once the
  build timer starts counting down (`economy.js`'s `earlyStartCap()` +
  `payEarlyStart()`, now takes the upcoming wave number; `wavebar.js`'s live
  preview updated to match). Confirmed linear (no boss-wave bump) with the
  user.
- Tower roster rebalanced 90% weaker / 70% cheaper, walls dropped to 1g, to
  force mazing (previously players could out-DPS the maze entirely).
- Every tower now gains +20% range per upgrade tier uniformly
  (`CONFIG.UPGRADE.rangeMultPerTier`) — fixes cannon (and others) not
  gaining range on upgrade.
- Multi-select chooser gained a batch-upgrade row; positions itself near the
  drag-end point, clamped on-screen.
- **A global enemy-HP scale-up, uncommitted:** `CONFIG.ENEMY_HP_SCALE = 4`
  (+300%) and `CONFIG.BOSS_HP_SCALE = 11` (+1000%) in `src/config.js`, wired
  into `computeStats()` in `src/game/wave.js`. Deliberately a *global*
  lever, not per-level — the user was explicit that HP scale should hit
  "the core game," not each level's `hpMult`.
- **Overlapping/stacked waves, uncommitted:** the next wave can now be
  called while the previous wave's enemies are still on the field, gated by
  a new 10s cooldown (`CONFIG.WAVE_CALL_COOLDOWN`, `state.nextWaveCooldown`)
  instead of the old `state.waveActive` block. `wave.js`'s `startWave()`
  appends the new wave's spawn entries onto the existing queue (time-offset
  onto the shared `spawnElapsed` clock) instead of replacing it when a
  previous wave is still active; each entry keeps its own `wave` tag so
  `computeStats()` scales it correctly even after `state.wave` has moved on.
  `waveComplete()` needed no change — "queue empty + no enemies alive"
  already covers the stacked case correctly. `buildTimer` now ticks
  regardless of `waveActive` (there's no guaranteed empty-field gap between
  calls anymore) so the early-call gold bonus and auto-chain still work;
  auto-chain retries every frame once `buildTimer` hits 0, so it naturally
  waits out the cooldown without extra logic. `ui/wavebar.js` shows
  `WAVE {n} … ({s}s)` during cooldown and re-enables at 0. Verified with a
  headless script (append/offset/wave-tagging math) and live in-browser
  (cooldown correctly blocks a double-click; a forced-clear-cooldown click
  while wave-1 entries were still queued produced a correctly merged,
  sorted, dual-tagged queue). **Open design question, not yet run past the
  user:** when stacked waves finally all die together, only ONE wave-clear
  bonus fires (`payWaveClear(state, state.wave)`, keyed off the *highest*
  wave reached) instead of one bonus per stacked wave — a "combo clear"
  rather than separate payouts. This is an inherent side effect of the
  request, not a compensating fix; flag it to the user and revisit if they
  want per-wave payouts instead.

**⚠ Standing instruction, learned the hard way this session:** an earlier
automated "keep the balance-sim gate green" re-tune (lowering per-level
enemy HP to compensate for the tower nerf) **directly cancelled out** the
difficulty increase the user was deliberately trying to create, and had to
be reverted (`git checkout b8cf5a4 -- src/game/levels.js test/campaign-sim.mjs`,
committed as `d93a30e`). **Do not make compensating/counteracting balance
changes to keep a gate green — ask the user first.** As of this session's
enemy-HP scale-up, `test/campaign-sim.mjs` (all 3 variants), `t10validate.mjs`,
and `t12render.mjs` are *expected to be red* (5/19 suites) — confirmed via an
isolated worktree diff against the last commit that this is caused SOLELY by
`ENEMY_HP_SCALE`/`BOSS_HP_SCALE` (all three harnesses call `startWave()`
strictly sequentially, only after the previous wave fully clears, so the new
stacking code path never even triggers for them). That's intentional pending
the user's own feel-testing, not a bug to quietly fix. Every balance change
made from here should be graded against "did this make mazing more
necessary," not "does the bot still win."

**Known gaps, not yet done:**
- No service worker — needs the dev server running, no full offline play.
- No real-device touch testing — mobile controls verified headless + by code
  audit only.
- `scratch/` (local throwaway scripts) stays gitignored; the *tracked* suite
  moved into `test/` under U1.
- U11 (durable storage adapter), U12 (Capacitor scaffold), U13 (store
  pipelines/submission) haven't started. Apple Developer Program account is
  approved and ready on the user's side; Codemagic is the planned iOS
  build/signing/TestFlight pipeline (no local Mac needed).

## How to run it

```bash
bash start.sh   # or start.bat on Windows — needs a static server, ES modules can't run from file://
```
Open `http://localhost:8000`. Any static file server works if you don't
have python/node.

## How to test it

Testing is **headless Node scripts** in the tracked `test/` directory — each
imports the real game modules directly (no mocks, no DOM unless a fake one is
needed), runs assertions, and prints a single `*_OK` or `*_FAIL` line.

```bash
npm test                      # the whole suite (19 suites; gates last) — see "known gaps" above re: campaign-sim currently red
node test/t10validate.mjs     # classic-map balance gate (6 seeds, all heroes)
node test/campaign-sim.mjs    # campaign balance gate (reference clears 20, careless dies early)
node test/t11levels.mjs       # checkpoint routing, multi-spawn/goal, wave composer
node test/t11economy.mjs      # refund rates, air/ground targeting, upgrade cost curve
node test/t11profile.mjs      # star economy, level-unlock gating, hero persistence
```

`npm test` (via `test/run.mjs`) runs every suite sequentially and fails on
any nonzero exit or `*_FAIL` line. Run it after any change to `src/game/*`
or `src/config.js`. The `scratch/` directory stays gitignored for local
throwaway scripts (old t0-t9 debug scripts still live there).

There's also a headless balance simulator, separate from the test scripts:
```bash
node src/sim/autoplay.js            # competent build, should clear wave 100
node src/sim/autoplay.js careless   # sloppy build, should die ~w22-28
```

## Where things live

```
mazecore-td/
  index.html            page shell: canvas + HTML/CSS HUD overlay
  start.sh / start.bat  dev server launcher
  src/
    main.js              boot, game loop wiring, save/load actions
    config.js            EVERY tunable constant/data table (574 lines) — towers,
                          enemies, armor/damage matrix, heroes, waves, economy, ads
    engine/              loop (fixed 60Hz timestep), grid (dynamic per-level size),
                          pathfinding (BFS distance fields + A*), input, seeded rng
    game/
      state.js            world state, BFS routing, siege/breach fields
      levels.js            20 campaign levels + Endless + tower unlock schedule (398 lines)
      enemy.js             enemy stage machine (checkpoint-chain progression)
      tower.js              targeting/candidates, upgrade cost curve
      hero.js               guard-post auto-engage AI
      wave.js               wave composition (waveInfo vs per-level levelWaveInfo)
      economy.js, shop.js, projectile.js, damage.js, map.js, save.js
    services/
      profile.js            star economy + persistent hero + localStorage (v1 schema)
      ads.js, sfx.js
    ui/                    topbar, screens, sheets, viewport (letterboxing), radial
                            (build rings), hud, render, infocard, herobar, wavebar,
                            hints, sprites, ui.css
    sim/autoplay.js        headless balance simulator (competent vs careless)
  assets/                 generated sprite art (gitignored regenerable except manifest.json)
  tools/gen-assets.mjs    OpenAI image-gen pipeline for the art (see tools/README.md)
  test/                   tracked headless test suites + run.mjs (npm test)
  scratch/                gitignored local throwaway scripts
  handoff/                levels.json + balance.json — portable data exports made
                          for the shelved native rebuild; stale, kept for reference
```

**`src/config.js` is the single source of truth for every number in the
game.** No magic numbers live in gameplay code — if you're changing balance,
this is the only file you should need to touch, and `src/sim/autoplay.js` /
`scratch/t10validate.mjs` / `scratch/campaign-sim.mjs` are how you verify a
change didn't break the win/lose gates.

## Design decisions worth knowing before you change anything

The full log is [`DECISIONS.md`](DECISIONS.md) (232 lines, phase-by-phase).
The ones most likely to bite a new contributor:

- **Pathfinding is BFS distance fields per goal, not per-enemy A\*.** Every
  enemy follows the gradient downhill. This is what makes building/selling a
  tower instantly reroute every enemy on the board — don't "optimize" this
  into per-enemy pathing without understanding why it was chosen (cost:
  BFS field recompute; A\* is still used for the hero's move-to-cell and the
  path overlay only).
- **Checkpoints are the depth engine for small screens.** A level's route is
  a waypoint chain; enemies track a `stage` index and get one BFS field per
  stage. This is how one small maze gets walked 3–5 times without needing a
  bigger board. Sealing a *middle* stage is detected and sieged correctly —
  see the "Sealing a MIDDLE stage" test in `scratch/t11levels.mjs`.
- **Walls sell at 100%, towers at 70%** (`CONFIG.WALL_REFUND` vs
  `CONFIG.SELL_REFUND`). Juggling — closing one wall to force a wave through
  a different kill zone — is a core intended technique, not an exploit. Sieged
  towers pay no refund when destroyed; that asymmetry is deliberate (sealing
  the maze is legal but risky).
- **Damage-type × armor-type is a full matrix**
  (`CONFIG.DAMAGE_VS_ARMOR[damageType][armorType]`, 0.5×–1.5×), not flat
  armor subtraction. Every UI badge derives from this table via
  `game/damage.js`'s `matchup()`/`strongWeak()` — don't hardcode a second
  copy of the matchup logic anywhere.
- **Balance is razor-thin on purpose.** `HP_EXP` (per-wave HP growth) was
  dropped hard during tuning (1.10 → 1.05) because maze damage has a hard
  throughput ceiling — past a certain per-enemy HP, no amount of total DPS
  saves you, because damage only applies while an enemy is in range. If you
  raise enemy HP or reduce maze length assumptions, re-run
  `src/sim/autoplay.js` before assuming it's fine.
- **Sprites are a pure overlay, never a dependency.** `ui/sprites.js` loads
  whatever `assets/manifest.json` lists; every draw call has a shape
  fallback. The game is fully playable with zero generated assets. Don't
  make any code path *require* an image.
- **The reference/careless double-gate is the actual quality bar for
  balance changes.** A change is only "done" when the competent-mazer sim
  still clears the run (floor: mechanic is beatable) AND the careless
  ignore-the-mechanic build still dies partway through (ceiling: skipping
  the mechanic has a real cost). Both sims exist for exactly this check —
  run both after any `config.js` or `levels.js` edit.

## Deferred hardening (from the last code review)

A full multi-agent code review (correctness/maintainability/testing/
performance) ran against the campaign-rebuild commits. Confirmed bugs were
fixed immediately (wave-count desync on campaign levels, a viewport
letterbox bug on Endless load, stale doc comments, a dead import) and three
new test suites were added (`t11profile`, `t11economy`, and an extension to
`t11levels`) to close coverage gaps — all committed. Items that needed
design work rather than a quick fix were deferred; the static-map canvas
cache landed since under U4, so what's left:

- Unify the two wave pipelines (`waveInfo` for classic, `levelWaveInfo` for
  campaign) — currently parallel implementations that happen to agree.
- Lift remaining campaign-specific magic numbers out of gameplay code into
  `config.js`.

## Shipping as a mobile app

This repo *is* the shipping target — see "Current status" above and the
[WC3-progression + Capacitor plan](docs/plans/2026-07-06-001-feat-wc3-progression-mobile-plan.md)
for the full spec (U11 storage adapter, U12 Capacitor scaffold, U13 store
pipelines, none started yet). `HANDOFF-NATIVE-REBUILD.md` documents a
different, now-shelved path (a from-scratch native Kotlin/Compose rebuild
via Google AI Studio, Android-only) — historical context only, don't start
new work from it.
