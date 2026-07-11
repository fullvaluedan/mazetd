# Asset generation (optional)

Mazecore TD ships fully playable with **zero asset files** (everything is drawn
from canvas shapes). This folder is an *optional* tool to generate PNG sprites
with the OpenAI image API if you want richer art.

It has **no npm dependencies** — it uses Node's built-in `fetch`. You need the
local Node (already on this machine at `C:\Program Files\nodejs\node.exe`).

## 1. Add your key (kept out of git)

```bash
cp .env.example .env        # then edit .env and paste your OpenAI key
```

`.env` is gitignored, so your key is never committed. Don't paste it into chat or
anywhere public. Get a key at https://platform.openai.com/api-keys.

## 2. See what will be generated (free, no key needed)

```bash
node tools/gen-assets.mjs --list
```

Lists every asset family and writes `assets/manifest.json` (an id → path map
for later wiring). Tower families now include upgrade variants and attack-sheet
ids so the game can prefer level art when it exists.

## 3. Generate

```bash
node tools/gen-assets.mjs tower-cannon   # one family, to dial in the style first
node tools/gen-assets.mjs tower          # all tower families + variants
node tools/gen-assets.mjs tower --concurrency=4
node tools/gen-assets.mjs                 # everything (skips files that exist)
node tools/gen-assets.mjs --force         # regenerate everything
```

Output lands in `assets/towers/`, `assets/tiles/`, `assets/enemies/`,
`assets/heroes/`, `assets/sheets/`, `assets/misc/` (tracked in git as of U7 —
store builds clone the repo, so the art must ship with it).

## U7 roster sprites (art track TODO)

The campaign roster (U7) needs one 1024px PNG per tower under `assets/towers/`
for the base art plus upgrade variants:

- `arrow.png`, `arrow-lv1.png` .. `arrow-lv5.png`, `tower-arrow-attack.png`
- `cannon.png`, `cannon-lv1.png` .. `cannon-lv5.png`, `tower-cannon-attack.png`
- `frost.png`, `frost-lv1.png` .. `frost-lv5.png`, `tower-frost-attack.png`
- `poison.png`, `poison-lv1.png` .. `poison-lv5.png`, `tower-poison-attack.png`
- `sniper.png`, `sniper-lv1.png` .. `sniper-lv5.png`, `tower-sniper-attack.png`
- `lightning.png`, `lightning-lv1.png` .. `lightning-lv5.png`, `tower-lightning-attack.png`
- `support.png`, `support-lv1.png` .. `support-lv5.png`
- `gold.png`, `gold-lv1.png` .. `gold-lv5.png`

Until the upgrade files exist, the manifest can alias `lv1` to the older base
art where available so the game still renders something readable:
`arrow→archer.png`, `poison→venom.png`, `lightning→tesla.png`,
`support→beacon.png`, with cannon/frost keeping their own files.
`sniper` and `gold` still fall back to their glyph/color canvas shapes.

The first battlefield tile pass starts with `assets/tiles/border.png` and
`assets/tiles/path.png`; the renderer can pick up more specific tile variants
later without changing the code again.

⚠️ This calls a **paid** API (~31 images for the full set incl. walk-cycle sheets). Generate a few first.

## Config

Prompts are derived from `src/config.js` (names + colours), so the art matches
the game. Override the model/quality in `.env`:

- `ASSET_MODEL` — `gpt-image-1` (default, supports transparent backgrounds) or
  `dall-e-3` (fallback if your account lacks gpt-image-1 access; no transparency).
- `ASSET_QUALITY` — `low` | `medium` | `high` (gpt-image-1).

## Using the assets in the game

The generator only *creates* the files; the game now loads them when present and
falls back to the original shapes if an id is missing. The sprite layer lives
in `src/ui/sprites.js` and `src/ui/render.js`.
