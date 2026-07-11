# Maze TD UI Redesign Checklist

Use this checklist for the current polish pass. It is meant to keep the redesign
focused, consistent with the earlier UI reference, and easy to review one item at
a time.

Reference stack:

- `docs/art/reference/art-guide.png`
- The Clash Royale-inspired UI reference shared earlier in the review thread
- The current in-game HUD, stage select, and info card screenshots

## 1. Info Card Simplification

- Remove the grey "behind the button" feel.
- Keep the card visually separate from the tower ring and other controls.
- Reduce the amount of text shown by default.
- Prioritize the most important stat, action, and warning only.
- Hide secondary details unless the user explicitly opens them.
- Make the card read like one clean panel, not stacked UI fragments.

## 2. Logo / Identity Swap

- Replace the current campfire logo treatment.
- Try a crystal or castle emblem instead.
- Keep the shape simple enough to read at small sizes.
- Make the logo feel like part of the same fantasy UI set.
- Avoid a logo that looks like a standalone sticker.

## 3. Frame Redesign

- Remove the decorative tile pieces around the outside edge.
- Use a single polished frame instead of a framed border made of tiles.
- Keep the frame premium, carved, and game-like.
- Make the frame work on both the title screen and stage select.
- Check that the frame does not crowd the main content.

## 4. Screen Harmony

- Make the home page and stage select feel like one UI family.
- Match the color temperature to the battle HUD.
- Keep the buttons, headers, and labels on the same visual language.
- Avoid any area that feels like placeholder web UI.

## 5. Readability Checks

- Verify text has enough contrast against its panel.
- Verify selected states do not shift position.
- Verify empty-space controls remain centered.
- Verify the info card never blocks essential controls.
- Verify the redesign still works at the current browser size.

## 6. Asset Review Order

Review assets in this order:

1. Info card
2. Logo / identity emblem
3. Frame
4. Home screen polish
5. Stage select polish
6. Final browser check

## 7. Acceptance Rules

- The redesign should feel simplified, not emptier.
- The UI should feel more intentional, not more decorative.
- The new look should still fit the Clash Royale-inspired direction.
- If a change makes the UI harder to read, reject it.
- If a change does not improve clarity or polish, do not keep it.

