---
title: "refactor: Tower rebalance (weaker/cheaper/longer-range) + wave-start + marquee UX"
type: refactor
date: 2026-07-06
status: draft
origin: solo (user playtest feedback 2026-07-06)
branch: feat/wc3-progression
---

# Tower Rebalance + Wave-Start + Marquee UX

## Summary

Shift Maze Defenders toward the Wintermaul "mass of cheap towers in a long maze" feel: every roster tower does 50% less damage, costs 30% less, and gains +20% range per upgrade tier. Re-tune the 20-level campaign so the balance gates still pass (the game stays challenging; exact margins are now flexible per the user's call to fine-tune later with heroes/skills). Alongside, two small UX fixes from playtest: the first wave waits for a manual NEXT WAVE tap (auto-chain only kicks in from wave 2), and the already-shipped marquee multi-select gets made discoverable (the user couldn't find its toggle).

---

## Problem Frame

Playtest feedback (2026-07-06): the game wants a different tower economy. Towers should be weaker and cheaper so the player builds *more* of them and leans harder on maze length, and each upgrade should extend range (+20%) so upgrading is about coverage, not just numbers. Three other asks the user raised are already shipped this session — auto-start waves, early-call bonus gold, and the marquee multi-tile build/sell popup — so those are verify-and-surface work, not new features. The marquee specifically has a discoverability gap: it lives behind a small bottom-left "Select" toggle the user never noticed, so it reads as missing. One genuinely new behavior request: the very first wave should be manually launched (the player places an opening defense, then taps NEXT WAVE), with auto-chaining only from wave 2 on.

---

## Requirements

- R1: Every roster attack tower deals 50% less damage than today, at every tier (base halved; tier multipliers unchanged so the whole curve scales down proportionally).
- R2: Every roster tower costs 30% less to build than today (base cost; tier cost multipliers are relative so all tier costs drop proportionally).
- R3: Each upgrade tier adds +20% range, cumulative (T5 ≈ 2.07× the base range).
- R4: The classic-board balance gate (`t10validate`) stays green untouched — the rebalance touches only the roster defs, never the hidden legacy towers that gate uses.
- R5: The campaign gates still pass after the rebalance: reference wins all 20 levels, a no-upgrade build still fails by mid-campaign, careless play still dies early. Exact per-level margin bands are relaxed (fine-tuned later).
- R6: The first wave of a level is not auto-started; the player taps NEXT WAVE to begin wave 1. From wave 2 on, waves auto-chain when the build timer expires (unchanged).
- R7: The marquee multi-select is discoverable: a clearly labeled, prominent toggle plus a first-run hint that points the player at it. The feature itself already works and is verified, not rebuilt.

---

## Key Technical Decisions

- **KTD1: Rebalance the roster defs only; legacy stays frozen.** The 8 roster towers (arrow, cannon, frost, poison, sniper, lightning, support, gold) get the stat changes. The hidden legacy defs (archer, venom, tesla, magic, falcon, cannonL, frostL, beacon, arcane) are the classic-board sim's world and are NOT touched, so `t10validate` and old-save loading stay identical. Same isolation principle U7 used.
- **KTD2: Damage/cost via base values, range via per-tier `rangeMult`.** Halving each roster tower's base `damage` scales every tier down (tiers multiply the base). Cutting base `cost` 30% scales every tier's cost (tier `costMult` is relative). Range is set explicitly per tier in the roster tier tables (`rangeMult` ~1.08-1.1 today) plus support's explicit per-tier `range` values, and via `CONFIG.UPGRADE.rangeMultPerLevel` for the legacy fallback path — all move to +20% (1.20) for roster/fallback; support's explicit per-tier ranges recompute to +20% steps.
- **KTD3: Relax the margin-band gates, keep the pass/fail gates.** Per the user, difficulty is now fine to fine-tune later. The re-tune keeps the three hard gates (reference wins 20/20; no-upgrade first-loss lands somewhere 3-9; careless first-loss 2-10) but drops the tight per-level margin asserts (l10 <=8, l15 <=6, l20 <=4) to a soft "reference wins with fewer than full lives on the late levels" so the re-tune converges fast instead of chasing exact numbers.
- **KTD4: First-wave gate is a wave-index condition, not new state.** `state.wave` is 0 before wave 1 starts and increments as waves begin, so gating auto-start on `state.wave >= 1` makes wave 1 manual and every later wave auto-chain, with no new field, no save-format change, and no effect on the early-start bonus.
- **KTD5: Marquee discoverability, not redesign.** The toggle and gesture work (live-verified this session). The fix is presentation: a clearer label, prominence, and a one-time first-run hint (reuse the `hints.js` pattern). Keeping the toggle preserves drag-to-pan on big boards; making drag-select the default would break panning, so that is explicitly not done.

---

## Implementation Units

### U22. Roster tower rebalance: damage -50%, cost -30%, range +20%/tier

**Goal:** The 8 roster towers are weaker, cheaper, and gain more range per upgrade; legacy towers untouched.
**Requirements:** R1, R2, R3, R4
**Dependencies:** none
**Files:** `src/config.js`, `test/t11economy.mjs`
**Approach:** For each roster def (arrow/cannon/frost/poison/sniper/lightning/support/gold) in `CONFIG.TOWERS`: halve base `damage` (skip the 0-damage support/gold — their damage stays 0); cut base `cost` by 30% (round to a clean integer; wall stays 5g — it is the maze primitive, not an attack tower, and the user said "towers"); set every tier's `rangeMult` to 1.20 and recompute support's explicit per-tier `range` array to +20% steps from its base. Set `CONFIG.UPGRADE.rangeMultPerLevel` to 1.20 for the legacy-fallback path (harmless to legacy towers since their damage/cost are unchanged; only affects any roster tower relying on the fallback). Do NOT touch damageMult/cooldownMult in tiers. Update `t11economy` assertions that pin absolute roster costs/damage (the cannon-cost test asserts the *multiplier* not the base, so it likely survives; the level-1 2-shot floor test only gets stronger with weaker cannons — verify and adjust the comment).
**Patterns to follow:** the roster def block structure from U7; the legacy-isolation approach (never edit `hidden: true` defs).
**Test scenarios:** each roster tower's base damage is exactly half its pre-change value; each roster tower's base cost is 70% (rounded) of its pre-change value; a T2 arrow's range is 1.20× its T1 range and a T3 is 1.20² ×; support's T5 range is 1.20⁴ × its T1; the level-1 grunt still survives 2+ (now more) cannon hits; a legacy tower (archer) is byte-identical in damage/cost/range to before (guards KTD1).
**Verification:** `t11economy` green with updated bands; `t10validate` untouched-green (proves legacy isolation).

### U23. Campaign re-tune to keep the gates green

**Goal:** After the rebalance, the campaign still passes its (relaxed) gate contract.
**Requirements:** R5
**Dependencies:** U22
**Files:** `test/campaign-sim.mjs`, `src/game/levels.js`, `docs/` (tuning note)
**Approach:** The rebalance drops roughly DPS-per-gold (weaker+cheaper nets ~0.7× damage per gold) while raising coverage (longer range, more towers), so expect to REDUCE per-level enemy `hpMult` to compensate — the sim finds the values. First, relax the gate assertions per KTD3: keep "reference wins 20/20", "no-upgrade first-loss 3-9", "careless first-loss 2-10, l1 win", drop the exact l10/l15/l20 margin-band asserts (replace with a soft "late levels win with < full lives"). Then binary-search per-level `hpMult` (and `bountyMult`/`waveclearMult` if income now feels off given cheaper towers) until green. Levels 1-3 stay geometry-locked; adjust their hpMult only if a gate forces it. This is sim-driven iteration; the plan sets the contract, the sim sets the constants.
**Execution note:** sim-first — relax the gate assertions and confirm they fail red on the rebalanced-but-untuned state before tuning, so every iteration is a real signal.
**Test scenarios:** the relaxed gate assertions themselves (reference 20/20; no-upgrade first-loss in 3-9; careless first-loss 2-10 and wins l1 with <=6; late levels win below full lives); classic `t10validate` still untouched-green; income-band spot checks re-derived for the cheaper towers with a comment.
**Verification:** full `npm test` green.

### U24. First wave manual, later waves auto-chain

**Goal:** Wave 1 waits for the player's NEXT WAVE tap; waves 2+ auto-start as today.
**Requirements:** R6
**Dependencies:** none
**Files:** `src/main.js`, `test/t12resume.mjs` (or a small new assertion in an existing suite covering the wave loop)
**Approach:** Gate the auto-start trigger on `state.wave >= 1` so the pre-wave-1 build phase never auto-launches (before wave 1, `state.wave` is 0). Waves 2+ are unaffected (once wave 1 starts, `state.wave` is >= 1 and the build timer auto-chains as before). The early-start bonus still applies to a manual wave-1 launch. Verify the auto-start default is ON (`state.autoStart` true) so this is the only change needed. Confirm the NEXT WAVE button and spawn chevrons are visible/active during the pre-wave-1 phase (they already gate on `canStart`).
**Patterns to follow:** the existing `state.buildTimer <= 0 && state.autoStart` gate in `main.js`.
**Test scenarios:** with autoStart true and `state.wave === 0`, ticking the build timer to 0 does NOT start a wave; after wave 1 is started manually (`state.wave === 1`), ticking the timer to 0 DOES auto-start wave 2; the early-start bonus is paid on a manual wave-1 launch.
**Verification:** headless wave-loop assertion green; live check — boot a level, let the build timer expire, confirm wave 1 has not started until NEXT WAVE is tapped, then wave 2 auto-chains.

### U25. Make the marquee multi-select discoverable

**Goal:** The player can find and use multi-tile build/sell without being told it exists.
**Requirements:** R7
**Dependencies:** none
**Files:** `src/ui/multiselect.js`, `src/ui/ui.css`, `src/ui/hints.js`, `src/main.js` (only if a hint hook is needed)
**Approach:** First, live-verify the toggle actually renders (a browser tab closed mid-check this session; rule out a real render bug before treating it as pure discoverability). Then: relabel the toggle to read what it does (e.g., "▦ Multi-build" or "▦ Select rows"), give it more visual weight (size/contrast consistent with the Clash-direction to come, but no dependency on U19), and add a one-time first-run hint via `hints.js` ("Tap here to build or sell whole rows at once") that points at the toggle and dismisses on first use. Keep the toggle-gated model (drag-to-pan must survive on big boards); do not make drag-select the default gesture. Answer to the user's "can I click and drag": yes — after tapping the toggle, click-drag paints the selection box.
**Patterns to follow:** the `hints.js` first-run banner pattern (dismiss-once via localStorage key); the existing `.mselect-toggle` styling.
**Test scenarios:** the toggle element renders and is within the visible UI box at a 375px viewport; the first-run hint appears once and does not reappear after dismissal (localStorage flag); toggling select mode still enters/exits the marquee gesture (regression); the batch chooser still opens on a drag-release (regression, already covered by `t12batch`).
**Verification:** live check at phone width — the toggle is obvious, the hint fires once, drag-select still builds a row; `t12batch` green (unchanged).

---

## Scope Boundaries

**In scope:** the four units above.

**Already shipped (verify-only, not rebuilt):** auto-start waves (default ON, committed this session), early-call bonus gold (payEarlyStart + NEXT WAVE), the marquee build/sell popup (U21). U24 changes only the first-wave behavior; U25 changes only discoverability.

**Deferred to follow-up:** fine-tuning exact difficulty margins (the user will iterate with heroes/skills later); the Clash-Royale UI restyle (U19) that will re-skin the marquee toggle; wall cost (stays 5g).

**Outside this plan:** the hidden legacy towers and the classic-board sim; the mobile/art tracks.

---

## Risks

- **Re-tune churn (main risk):** a 50%/30%/+20% swing shifts every level. Mitigation: relaxed gates (KTD3) so the sim converges on "passes" not "exact margins"; the U20/U7/U8 re-tune pattern is established; levels 1-3 stay geometry-locked.
- **Range creep at T5:** +20%/tier compounds to ~2× base range, which on small early boards could let one tower cover most of the map. Mitigation: the sim's no-upgrade and careless gates catch a too-easy result; if T5 range trivializes a level, cap via the per-level tuning, not by abandoning +20%.
- **Marquee is a real bug, not just hidden:** if U25's live-verify finds the toggle doesn't render, it becomes a fix not a relabel. Mitigation: U25's first step is the render check.
- **Income feels off with cheaper towers:** 30%-cheaper towers mean the same gold buys more, which can trivialize early economy. Mitigation: U23 re-derives income bands and can trim per-level bounty/waveclear mults.

---

## Sources & Research

- Repo grounding (this session): roster tier tables carry explicit `rangeMult`/`range` per tier; `CONFIG.UPGRADE.rangeMultPerLevel` is the legacy fallback; the auto-start gate is `state.buildTimer <= 0 && state.autoStart` in main.js; the `.mselect-toggle` renders bottom-left at 44px; roster/legacy isolation established in U7 keeps `t10validate` safe.
- User playtest feedback (2026-07-06): the five asks, the difficulty-is-flexible call, the first-wave-manual request, and the marquee-not-found report.
