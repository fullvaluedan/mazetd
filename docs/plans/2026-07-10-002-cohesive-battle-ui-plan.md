---
title: "Cohesive Battle UI and Onboarding Plan"
date: 2026-07-10
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

# Cohesive Battle UI and Onboarding Plan

## Goal

Make the game feel like one authored fantasy product by simplifying first-run choice, removing disruptive build feedback, preserving the timed early-wave incentive, adding deterministic stage scoring and a player leaderboard, and rebuilding battle UI around a compact framed-command language inspired by the supplied reference without copying its assets or layout.

## Product Decisions

- First launch is a vertical choice of only `EXPERT`, `NORMAL`, and `EASY`. No title art, summary copy, card decorations, or back action competes with the choice.
- A single-tower placement is silent except for its in-world build effect. Batch build may retain a compact result only when partial completion or failure needs explanation; ordinary “Built N/N” notifications are removed.
- Early-wave bonus begins at the configured cap when the build phase opens and decreases once per elapsed second until zero. The Start Wave control must show the current bonus directly, without a separate toast being required to understand it.
- Battle UI follows the reference at the level of hierarchy: compact top resource blocks, one dedicated wave-status panel, a narrow information rail, and a bottom command dock. Mazecore retains its own navy, gold, cyan, red-brick, crystal, and anime asset identity.
- The board remains visually primary. UI never overlays spawn, goal, path, selected cell, or tower radial actions.
- Stage score is awarded only on victory: remaining gold and remaining lives each contribute visible bonus points. The final score, its breakdown, level, difficulty, and player name are stored with the entry.
- The first leaderboard is device-local, following the existing Maze Mode storage model. A shared online leaderboard is explicitly a follow-up because it requires identity, backend persistence, validation, and anti-cheat policy.

## Scope

Included: difficulty entry, build feedback, early-wave reward presentation, campaign stage scoring, local player leaderboard, battle HUD, command deck, information rail, tower store/build selection, wave status, panel/button/icon states, responsive layouts, and browser evidence.

Excluded: gameplay balance values, new combat art families, level layouts, hero systems, or any imitation of the reference’s art, logos, or specific card designs.

## Implementation Units

### U1. Simplify difficulty entry

Files: `src/ui/screens.js`, `src/ui/styles/screens.css`, `test/t15ui-contract.mjs`, `test/ui-harness.html`.

- Replace the current difficulty composition with a centered vertical stack of three full-width buttons: Expert, Normal, Easy.
- Keep selection immediate and persist existing difficulty behavior unchanged.
- Use internal color/keyline emphasis only; outer button geometry must remain fixed across hover, press, focus, and selected state.

Verification: browser-check all three at desktop and 390x844; confirm each routes to the map and no button moves.

### U2. Remove disruptive build-result popups

Files: `src/main.js`, `src/ui/multiselect.js`, `test/t12batch.mjs`, `test/t15ui-contract.mjs`.

- Remove normal successful batch-build banners and any single-tower “built” notification.
- Keep warnings only for partial completion, insufficient gold, illegal placement, or a maze-seal consequence.
- Preserve build sound, cell effect, economy, and batch mechanics.

Verification: build one tower, batch-build fully affordable cells, and batch-build an unaffordable selection; only the exceptional case may produce explanatory feedback.

### U3. Make early-wave reward legible and time-based

Files: `src/game/economy.js`, `src/game/wave.js`, `src/ui/wavebar.js`, `src/ui/styles/battle.css`, `test/t11economy.mjs`, `test/t12mechanics.mjs`.

- Characterize the existing cap/decay behavior before changing presentation.
- Make the current reward visible on the primary Start Wave control as `+Ng`, decreasing smoothly in whole-gold steps during the build phase.
- When the reward reaches zero, keep Start Wave prominent but remove bonus emphasis.
- Keep award calculation and difficulty multiplier deterministic.

Verification: assert cap at build-phase start, monotonic decay, zero floor, correct awarded amount at multiple elapsed times, and unchanged wave-start behavior.

### U4. Recompose battle HUD into one hierarchy

Files: `index.html`, `src/ui/topbar.js`, `src/ui/wavebar.js`, `src/ui/hud.js`, `src/ui/infocard.js`, `src/ui/styles/battle.css`, `test/t10viewport.mjs`, `test/t15ui-contract.mjs`.

- Consolidate top chrome into resource blocks and a central wave-status block; utility controls become a compact group.
- Introduce a persistent wave-information rail with current wave, enemy counts/types, next-wave preview, and boss warning when data is available.
- Rebuild the bottom command deck as distinct build/action tiles plus a dominant Start Wave block, using existing local icons and Mazecore colors.
- Reserve panel regions rather than layering over the board. The radial remains world-anchored and Info remains in the command region.

Verification: desktop, portrait, and compact-landscape screenshots; no overlap with spawn/goal; controls retain 44px targets and fixed bounds through press/focus.

### U5. Add stage score and player leaderboard

Files: `src/services/campaign-leaderboard.js`, `src/services/leaderboard.js`, `src/ui/screens.js`, `src/ui/styles/sheets.css`, new `test/t17campaign-leaderboard.mjs`, `test/t15ui-contract.mjs`.

- Add a pure stage-score calculator with explicit constants for gold-left points and lives-left points; the formula must be shown on Victory before saving a result.
- Extend the existing leaderboard service with a versioned campaign-stage board that stores player name, level id/name, difficulty, score, remaining gold, remaining lives, and date.
- On victory, show the score breakdown, a prefilled name field, Save score, and a Leaderboard action. Do not create entries on defeat, restart, resume prompt, or Maze Mode completion.
- Sort by score descending, then use a deterministic tie-breaker. Highlight the newly saved entry and support empty-board state.
- Keep the existing Maze Mode time leaderboard separate because its metric is survival time, not campaign stage score.

Verification: unit-test score calculation and tie ordering; complete a stage with controlled gold/lives; save once; confirm the displayed breakdown matches storage and the highlighted leaderboard row; confirm no entry after defeat.

### U6. Normalize UI finish and remove visual debt

Files: `src/ui/styles/tokens.css`, `src/ui/styles/primitives.css`, `src/ui/styles/battle.css`, `src/ui/styles/screens.css`, `src/ui/styles/sheets.css`, `assets/ui/icons.svg`, `test/t15ui-contract.mjs`.

- Define one frame recipe: dark navy interior, warm stone/gold outer edge, restrained leaf/wood accents, cream typography, cyan build focus, gold primary action, and red danger.
- Apply one corner radius, bevel, shadow, divider, and pressed-face behavior across HUD, sheets, difficulty, results, and store.
- Audit mismatched generated assets at actual play scale; adjust crop, palette wash, or panel treatment before regenerating any approved family.
- Remove duplicated legacy selectors that fight the component layers.

Verification: component gallery/harness states, reduced-motion state, contrast checks, and source scan for competing bare-button/card rules.

### U7. Integration proof and cleanup

Files: `docs/art/redesign-verification.md`, `test/run.mjs`, relevant files above.

- Run the full new-player flow from difficulty choice through wave start, tower build, victory score save, and leaderboard.
- Capture before/after evidence for difficulty simplicity, silent normal build, decaying early bonus, HUD hierarchy, and stage-score breakdown.
- Run the full test suite and update verification documentation with only observed results.

## Risks and Guards

- The reference has a richer prebuilt tower-card economy than Mazecore. Reuse its hierarchy, not its interaction model; keep the radial maze-building flow.
- A wave-info rail requires available wave data. Use existing `waveInfoFor` output and show a concise fallback when data is absent.
- New chrome must not change `Viewport` measurement ownership. The board slot remains the only world-geometry authority.
- Do not change early-bonus numbers until characterization tests prove a defect; this request is primarily clarity and incentive presentation.
- Local score boards are not anti-cheat resistant. Do not label them global or competitive until a server-backed submission design exists.

## Definition of Done

- The start choice contains only a vertical Expert/Normal/Easy stack.
- Normal tower construction produces no summary popup.
- Early Start Wave visibly awards a bonus that decreases over build time and is correct when claimed.
- Victory awards and displays deterministic gold-left and lives-left bonus points; the player can save and view a local stage-score leaderboard.
- The battle UI has a unified framed visual language, clear hierarchy, dedicated board space, and no landmark occlusion.
- Required responsive, input, economy, render, UI-contract, and full-suite tests pass.

## Execution Log

- 2026-07-10: U1 complete in code. The entry screen is the fixed-geometry vertical `EXPERT` / `NORMAL` / `EASY` choice.
- 2026-07-10: U2 complete in code. Fully successful batch builds are silent; partial batches retain an explanatory warning only.
- 2026-07-10: U3 complete in code and focused tests. The command action reads `CALL EARLY` with its live reward, and `t11economy` asserts the configured cap and decay calculations.
- 2026-07-10: U5 complete in code, focused tests, and browser proof. Campaign scores use a separate versioned local store from Maze Mode, save gold/lives breakdown plus stage/difficulty metadata, and show the saved row and rank after submission.
- 2026-07-10: U4 has its first verified slice: desktop status chrome includes a reserved deterministic next-wave rail, while compact screens retain the simpler wave chip. The remaining command-deck and information-rail consolidation is open.
- 2026-07-10: U6 and U7 remain open. They require the broad component/palette audit and full new-player-flow proof; they are not yet claimed as verified.
