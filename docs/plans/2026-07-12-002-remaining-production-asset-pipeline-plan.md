---
title: Complete Remaining Production Asset Pipeline
date: 2026-07-12
artifact_readiness: implementation-ready
---

# Complete Remaining Production Asset Pipeline

## Scope

Finish the approved modular 2x2 tower pipeline and enemy production pipeline
without weakening the deferred campaign-simulation balance gate. All runtime
art must remain strict orthographic top-down, square to the grid, and promoted
only after explicit approval plus source and map-scale QC.

## Requirements

- Preserve the modular Level 1 asset system and exact grid footprints.
- Continue autonomously between art approval boundaries.
- Batch each future tower's L1 design variations for a single user style choice;
  only then create that family and its state sheet.
- Keep static/source alpha checks, manifest dimensions, focused tests, and
  mobile/desktop composition evidence as promotion requirements.
- Never change, skip, or weaken `campaign-sim.mjs`; balance repair is a later
  dedicated implementation unit.

## Implementation Units

### U1: Finish approved Lightning static promotion evidence

Update `docs/art/asset-qc-report.md` with accepted Lightning L1-L5 staging
and map-proof evidence. Add a focused static source test if it adds coverage
beyond the production contract. Verify `tools/asset-qc.mjs --all`,
`test/t19-production-assets.mjs`, and `test/t12render.mjs`.

### U2: Complete remaining approved tower animation sheets

Produce Cannon, Frost, and Lightning state-sheet candidates from their
approved static designs. Generate only staging sheets first, normalize to four
128px frames in a 256px atlas, hash every frame, and request approval before
adding versioned runtime references. Extend manifest, generator, QC, and tests
only after approval.

### U3: Establish Support and Gold Mine visual directions

Generate a single reviewed design board containing strict 2x2 L1 candidates
for Support and Gold Mine. After a style decision per role, generate its L2-L5
family in one source batch, then its aura or income state sheet. Follow the
existing Arrow/Poison/Sniper promotion pattern.

### U4: Produce enemy families after tower completion

For each enemy role, create a static fallback, four-frame movement sheet, and
four-frame defeat sheet. Keep all visuals orthographic at gameplay scale;
Wisp uses hover motion. Extend state selection only after each sheet's source
QC, map composition proof, focused tests, and approval.

### U5: Browser composition and final verification

Run composition checks at mobile and desktop after every promoted family.
Run the full suite at the end. Preserve the known campaign simulation failure
as a reported deferred balance gate rather than modifying the gate.

### U6: Later balance repair

Make actual 2x2-aware level and balance changes until the campaign gate passes.
Do not begin this unit as part of asset promotion work.

## Risks And Decisions

- Generated checkerboard previews are cropped to the measured foundation before
  normalization; no preview background enters runtime assets.
- Entire tower art must cover the exact 2x2 source canvas to support flush
  adjacent placement.
- Art approval is the only blocking user decision. QC, documentation, tests,
  manifest wiring, and subsequent non-art preparation continue autonomously.

## Verification

- Per promoted family: `node tools/asset-qc.mjs --all`,
  `node test/t19-production-assets.mjs`, family-focused source test, and
  `node test/t12render.mjs`.
- Final: `npm test`, reporting the preserved campaign-simulation status
  separately until U6 is executed.
