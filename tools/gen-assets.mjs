// =============================================================================
// gen-assets.mjs — generate image assets for Mazecore TD via the OpenAI image API.
//
// Self-contained: no npm dependencies (uses Node's built-in fetch) and a tiny
// .env loader. Reads OPENAI_API_KEY from .env (gitignored) and writes PNGs into
// assets/. Prompts are derived from the game's own src/config.js so the art
// matches the in-game names and colours.
//
//   node tools/gen-assets.mjs --list            # show what would be generated
//   node tools/gen-assets.mjs                    # generate everything (skips existing)
//   node tools/gen-assets.mjs tower-archer enemy # generate matching ids only
//   node tools/gen-assets.mjs --force            # regenerate even if a file exists
//
// Cost note: this calls a PAID API. The full set is ~17 images — generate a few
// first (e.g. `node tools/gen-assets.mjs tower-archer`) to dial in the style.
// =============================================================================

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_DIR = path.join(ROOT, 'assets');

// --- tiny .env loader (no dependency) ---------------------------------------
async function loadEnv() {
  try {
    const txt = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch { /* no .env yet — that's fine for --list */ }
}

// --- per-type art hints (kept short; the shared style does the heavy lifting) -
const TOWER_HINT = {
  wall: 'a simple sturdy block of stacked stone bricks with a flat top, a maze wall segment',
  magic: 'a violet crystal-topped mage tower swirling with gentle frost-blue magic wisps',
  falcon: 'a tall wooden falconry perch tower with a rope-wrapped post and an empty bird perch at its crown',
  archer: 'a cozy wooden watchtower with a cute mounted crossbow, rope and timber details',
  cannon: 'a squat round cannon turret with a friendly chunky barrel, riveted plates',
  frost: 'a sparkly tower of pale-blue ice crystals with gentle snowflake glints',
  arcane: 'a violet wizard spire with a floating glowing rune orb and tiny stars',
  venom: 'a quirky mushroom-like spitter tower dripping bubbly green goo',
  tesla: 'a copper storm tower with a crackling lightning coil and little sparks',
  beacon: 'a white-and-gold shrine tower radiating a soft circular blessing aura, floating runic halo',
};
const ENEMY_HINT = {
  normal: 'a stocky goblin grunt warrior with simple leather armor and a small axe',
  fast: 'a lean speedy imp sprinting low to the ground, big grin',
  tank: 'a big round armored ogre with chunky pauldrons, slow and sturdy',
  swarm: 'a tiny cute skittering spiderling, one of a hatchling swarm',
  flyer: 'a glowing friendly wisp spirit with little light wings',
  healer: 'a hooded acolyte in green robes, hands glowing with warm healing light',
  shield: 'a knight wrapped in a shimmering blue bubble barrier',
  boss: 'a huge horned demon-king boss, imposing but stylish, heavy ornate armor',
};

// Anime / lighthearted-isekai art direction (describes the look — image models
// don't reliably know show titles): bright, simple, cel-shaded, friendly.
const STYLE =
  'Clean modern anime game art in a lighthearted isekai-fantasy style: ' +
  'bright cheerful saturated colors, simple flat cel shading with soft dark outlines, ' +
  'slightly chibi proportions, friendly readable silhouette, minimal clean detail, ' +
  'soft ambient lighting, slight 3/4 top-down view, centered single subject. ' +
  'No text, no letters, no watermark, no UI, no frame or border. Fully transparent background.';

// 4-frame walk cycles as one 2x2 sheet (sliced + auto-centered at load by
// src/ui/sprites.js; a sheet that comes out misaligned is simply dropped).
const SHEET_TYPES = ['normal', 'fast', 'tank', 'swarm', 'healer', 'shield', 'boss'];
function sheetPrompt(hint) {
  return 'Sprite sheet, EXACTLY 4 frames arranged in a 2x2 grid on one image: ' +
    `the SAME character — ${hint} — drawn in 4 sequential walk-cycle poses ` +
    '(contact, down, passing, up). Identical character design and scale in every frame, ' +
    'each frame centered in its quadrant, same camera angle and lighting throughout, equal spacing, ' +
    'no frame borders or grid lines. ' + STYLE;
}

function buildManifest() {
  const items = [];
  for (const [id, t] of Object.entries(CONFIG.TOWERS)) {
    items.push({ id: `tower-${id}`, out: `towers/${id}.png`, size: '1024x1024',
      prompt: `Top-down game icon of a "${t.name}" defense tower: ${TOWER_HINT[id] || 'a defensive turret'}. Primary colour ${t.color}. ${STYLE}` });
  }
  for (const [id, e] of Object.entries(CONFIG.ENEMIES)) {
    items.push({ id: `enemy-${id}`, out: `enemies/${id}.png`, size: '1024x1024',
      prompt: `Game sprite of a "${e.name}" enemy for a tower-defense game: ${ENEMY_HINT[id] || 'a creature'}. Primary colour ${e.color}. ${STYLE}` });
  }
  for (const [id, h] of Object.entries(CONFIG.HEROES)) {
    items.push({ id: `hero-${id}`, out: `heroes/${id}.png`, size: '1024x1024',
      prompt: `Heroic character sprite of "${h.name}" — ${h.role}. Primary colour ${h.color}. ${STYLE}` });
  }
  for (const id of SHEET_TYPES) {
    items.push({ id: `sheet-enemy-${id}`, out: `sheets/enemy-${id}.png`, size: '1024x1024',
      frames: 4, grid: [2, 2],
      prompt: sheetPrompt(ENEMY_HINT[id] || 'a creature') });
  }
  for (const [id, h] of Object.entries(CONFIG.HEROES)) {
    items.push({ id: `sheet-hero-${id}`, out: `sheets/hero-${id}.png`, size: '1024x1024',
      frames: 4, grid: [2, 2],
      prompt: sheetPrompt(`the hero "${h.name}" (${h.role.toLowerCase()})`) });
  }
  items.push({ id: 'misc-icon', out: 'misc/icon.png', size: '1024x1024', transparent: false,
    prompt: 'Square mobile game app icon for a colorful anime maze tower-defense game: one cute crystal tower emblem with a winding path swirling around its base, bright cheerful isekai-anime style, simple bold cel-shaded shapes, fills the frame edge to edge, no text, no border.' });
  items.push({ id: 'misc-background', out: 'misc/background.png', size: '1536x1024', transparent: false,
    prompt: 'Top-down fantasy meadow battlefield terrain for a cheerful anime tower-defense map: soft green grass with scattered light stone tiles, tiny flowers and pebbles, bright friendly colors with simple flat shading, evenly lit, LOW CONTRAST and slightly muted so game pieces stay readable on top, no characters, no buildings, no text, no UI, no grid lines.' });
  items.push({ id: 'misc-falcon', out: 'misc/falcon.png', size: '1024x1024',
    prompt: 'Game sprite of a small hunting falcon in flight, wings spread mid-glide, seen slightly from above, fierce but cute. ' + STYLE });
  items.push({ id: 'misc-worldmap', out: 'misc/worldmap.png', size: '1024x1536', transparent: false,
    prompt: 'TALL vertical world map for a cheerful anime tower-defense game: a winding dirt trail climbing from sunny meadows at the bottom through forest, river crossings and rocky foothills to a snowy demon castle peak at the top, bright cel-shaded colors, gentle top-down angle, the trail clearly visible weaving left and right up the whole image, no text, no icons, no UI, no characters.' });
  items.push({ id: 'misc-title', out: 'misc/title.png', size: '1536x1024', transparent: false,
    prompt: 'Wide key art for a colorful anime tower-defense game: a cheerful fantasy valley with a winding stone maze path, one cute crystal tower at its heart, playful monster silhouettes marching in from the far left, rolling green hills and a bright warm sky, clean modern anime style with simple cel shading, calm uncluttered sky at the top center reserved for a logo, no text, no letters, no UI, no watermark.' });
  return items;
}

// --- request shaping (handles gpt-image-1 and the dall-e-3 fallback) ---------
function buildRequest(model, item, quality) {
  if (model.startsWith('gpt-image')) {
    return {
      model, prompt: item.prompt, n: 1,
      size: item.size || '1024x1024',
      quality: quality,
      output_format: 'png',
      background: item.transparent === false ? 'opaque' : 'transparent',
    };
  }
  // dall-e-3: no transparency, different size set + quality vocabulary
  const size = (item.size && item.size.includes('1536')) ? '1792x1024' : '1024x1024';
  return { model, prompt: item.prompt, n: 1, size, response_format: 'b64_json', quality: quality === 'high' || quality === 'hd' ? 'hd' : 'standard' };
}

async function generateOne(item, ctx) {
  const outPath = path.join(ASSET_DIR, item.out);
  if (!ctx.force && existsSync(outPath)) { console.log(`  skip (exists)  ${item.out}`); return 'skip'; }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequest(ctx.model, item, ctx.quality)),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status} for ${item.id}: ${body.slice(0, 400)}`);
  }
  const json = await res.json();
  const b64 = json.data && json.data[0] && json.data[0].b64_json;
  if (!b64) throw new Error(`No image data for ${item.id}`);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(b64, 'base64'));
  console.log(`  wrote          ${item.out}`);
  return 'ok';
}

async function writeManifest(items) {
  await mkdir(ASSET_DIR, { recursive: true });
  const map = {};
  for (const it of items) {
    // sprite sheets carry slicing metadata; plain assets stay simple strings
    map[it.id] = it.frames
      ? { src: 'assets/' + it.out, frames: it.frames, grid: it.grid }
      : 'assets/' + it.out;
  }
  await writeFile(path.join(ASSET_DIR, 'manifest.json'), JSON.stringify(map, null, 2));
  console.log(`  manifest       assets/manifest.json (${items.length} entries)`);
}

async function main() {
  await loadEnv();
  const model = process.env.ASSET_MODEL || 'gpt-image-1';
  const quality = process.env.ASSET_QUALITY || 'medium';
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node tools/gen-assets.mjs [--list] [--force] [id-filter ...]');
    console.log('  --list / --dry-run   list assets (no API calls), write manifest.json');
    console.log('  --force              regenerate even if the file already exists');
    console.log('  id-filter            substring of asset id, e.g. "tower", "enemy-boss"');
    return;
  }
  const force = args.includes('--force');
  const listOnly = args.includes('--list') || args.includes('--dry-run');
  const filters = args.filter((a) => !a.startsWith('--'));

  const manifest = buildManifest();
  const selected = filters.length
    ? manifest.filter((m) => filters.some((f) => m.id === f || m.id.includes(f)))
    : manifest;

  if (selected.length === 0) {
    console.log('No assets matched your filter. IDs:');
    for (const m of manifest) console.log('  ' + m.id);
    return;
  }

  if (listOnly) {
    console.log(`Would generate ${selected.length} asset(s)  [model=${model}, quality=${quality}]:`);
    for (const m of selected) console.log(`  ${m.id.padEnd(18)} -> assets/${m.out}  (${m.size || '1024x1024'})`);
    await writeManifest(manifest);
    console.log('\n(dry run — no API calls made, no key required)');
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your-key-here')) {
    console.error('✗ Missing OPENAI_API_KEY. Copy .env.example to .env and add your real key.');
    process.exitCode = 1;
    return;
  }

  console.log(`Generating ${selected.length} asset(s)  [model=${model}, quality=${quality}]:`);
  let ok = 0, skip = 0, fail = 0;
  for (const item of selected) {
    try { const r = await generateOne(item, { apiKey, model, quality, force }); r === 'ok' ? ok++ : skip++; }
    catch (e) { fail++; console.error(`  FAILED         ${item.id}: ${e.message}`); }
  }
  await writeManifest(manifest);
  console.log(`\nDone: ${ok} generated, ${skip} skipped, ${fail} failed. Files in assets/.`);
  if (fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
