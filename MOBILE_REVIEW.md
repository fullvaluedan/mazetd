# Mobile & Gameplay Review

Audit of Mazecore TD as a mobile game: UI/UX, progression hooks, the store, the
hero system, and app structure. **Fixed** = done in this pass; **Next** =
recommended follow-ups.

## 1. Mobile UI / controls

Blockers found and fixed:

| Issue | Status |
|---|---|
| Hero movement was right-click only — impossible on touch | **Fixed:** tap the hero (or the hero panel's *Move* button / `M`) → tap a destination; pulsing ring shows move mode |
| Side-by-side layout assumed a wide screen | **Fixed:** portrait/narrow screens stack the HUD under the canvas; safe-area inset respected |
| Buttons too small for fingers | **Fixed:** 40px+ targets and bigger tower buttons on coarse pointers; keyboard-hint chips hidden on touch |
| Canvas gestures scrolled/zoomed the page | **Fixed:** `touch-action: none` on the canvas, no tap highlight, `user-scalable=no` |
| No home-screen install story | **Fixed:** PWA manifest (`manifest.webmanifest`, landscape, themed) + generated app icon |
| Tooltips are hover-only | Degrades fine (info also lives in the tower card); **Next:** long-press tooltip |

Next (not yet done):
- **Service worker** for full offline play (currently needs the dev server).
- **DPR-aware canvas scaling** so the playfield is retina-crisp on phones (game
  renders at 896×576 and CSS-scales; looks acceptable, not pixel-perfect).
- Real-device testing (this pass was verified headless + by code audit; touch
  flows follow standard patterns but haven't been finger-tested).

## 2. Progression & "addictiveness"

Hooks already in place: exponential wave threat with a visible next-wave
preview, early-start risk/reward gold, interest on savings, tower upgrade forks
(permanent choices), hero XP→10 with full-heal level-ups, boss spectacle every
10 waves, save/continue, persistent best-wave high score, teaching-zone deaths
(~w22–28 for careless play) that invite "one more run".

Added this pass: **permanent tower-boost tiers** (gold sink that makes every
between-wave moment a meaningful spend decision) and **first-run hints** so the
core loop lands in the first 60 seconds.

Next, in impact order:
1. **Meta-progression between runs** (e.g. small permanent unlocks per best
   wave) — the strongest mobile retention lever; currently every run starts flat.
2. **Daily seed run** — the map gen is already seeded; one-line variety + a
   reason to return daily.
3. **Achievements/badges** (first boss kill, no-leak streaks, L4 tower built).
4. Difficulty selector (the `DIFFICULTY` knob already exists in config).

## 3. In-game store

Existing: 6 towers with L1→L4 upgrade forks + sell; hero stat upgrades
(+HP/+dmg/−CD/−respawn, escalating tiers); 4 consumables (Repair / Frenzy /
Flash Freeze / Airstrike) with wave-scaled prices.

Added: **Tower Boosts** — permanent, global, between-wave purchases:
+10% damage ×5 tiers, +5% attack speed ×4, +4% range ×3, with steep (×1.9) cost
growth so they're a late-game sink, not an early shortcut. Applied at the combat
layer (same path as Frenzy), shown on the selected tower's range ring, persisted
in saves. Verified by unit tests; the balance sim (which buys none) still clears
wave 100 / careless still dies on schedule, so they only make runs *easier*.

## 4. Hero system (Frozen Throne style)

Already present from the original build (modeled on WC3/Kingdom Rush): three
heroes (Warrior/Mage/Ranger) picked at run start, command-move with pathfinding,
auto-attack, contact damage, death + timed respawn, XP to level 10, two
abilities each on cooldowns (Whirlwind/Taunt, Meteor/Frost Nova, Volley/Hawk
Eye), plus shop stat upgrades. This pass made it mobile-operable (tap-to-move)
and gave heroes painted WC3-style portraits in the picker, HUD panel and on the
battlefield. Next: hero items/inventory drops would deepen the WC3 fantasy.

## 5. App structure & performance

- Pure static ES modules, no build step — ideal for wrapping later (Capacitor)
  if app-store distribution is wanted; the PWA route works today.
- **Asset weight:** generated PNGs are ~33 MB at 1024px — fine locally, heavy for
  mobile web. Mitigated at runtime (sprites are downscaled once to 128px
  offscreen canvases at load, slashing GPU memory and draw cost). **Next:**
  pre-downscale the files themselves (or regenerate with `ASSET_QUALITY=low`)
  before shipping anywhere.
- Sim/game logic layers are DOM-free and run headless (CI-able); fixed-timestep
  loop already clamps background-tab catch-up.
- The game remains fully playable with zero assets (shapes fallback + Art toggle).
