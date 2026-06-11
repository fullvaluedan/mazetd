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

Lists every asset (6 towers, 8 enemies, 3 heroes, 1 background) and writes
`assets/manifest.json` (an id → path map for later wiring).

## 3. Generate

```bash
node tools/gen-assets.mjs tower-archer   # one asset, to dial in the style first
node tools/gen-assets.mjs tower          # all towers
node tools/gen-assets.mjs                 # everything (skips files that exist)
node tools/gen-assets.mjs --force         # regenerate everything
```

Output lands in `assets/towers/`, `assets/enemies/`, `assets/heroes/`,
`assets/misc/` (all gitignored — they're regenerable).

⚠️ This calls a **paid** API (~31 images for the full set incl. walk-cycle sheets). Generate a few first.

## Config

Prompts are derived from `src/config.js` (names + colours), so the art matches
the game. Override the model/quality in `.env`:

- `ASSET_MODEL` — `gpt-image-1` (default, supports transparent backgrounds) or
  `dall-e-3` (fallback if your account lacks gpt-image-1 access; no transparency).
- `ASSET_QUALITY` — `low` | `medium` | `high` (gpt-image-1).

## Using the assets in the game

The generator only *creates* the files; the game doesn't load them yet (it still
draws shapes). Wiring an optional sprite layer into `src/ui/render.js` — load
`assets/manifest.json`, draw the PNG when present, fall back to the shape — is a
small follow-up. Ask and it can be added.
