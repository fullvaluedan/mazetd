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
  archer: 'a wooden elven guard tower with a mounted ballista, rope and timber details',
  cannon: 'a squat dwarven cannon emplacement, riveted iron and stone, smoking barrel',
  frost: 'a tower of jagged blue ice crystals on a frozen stone base, cold mist swirling',
  arcane: 'an ornate violet arcane spire with a levitating glowing rune orb and floating stones',
  venom: 'a twisted organic spitter tower of fungal green flesh, dripping toxic ooze',
  tesla: 'a brass-and-copper storm tower with a crackling lightning coil at its crown',
};
const ENEMY_HINT = {
  normal: 'a stocky orc-like grunt warrior with crude leather armor and an axe',
  fast: 'a lean feral ghoul sprinting low to the ground, claws out',
  tank: 'a hulking armored ogre brute with massive pauldrons and a tower shield back',
  swarm: 'a tiny skittering spiderling creature, one of a hatchling swarm',
  flyer: 'a glowing ethereal wisp spirit trailing faint blue wings of light',
  healer: 'a hooded acolyte mender robed in green, hands glowing with healing light',
  shield: 'a stern warden knight wrapped in a shimmering blue energy barrier',
  boss: 'a colossal demonic pit-lord boss with horns, burning eyes and heavy armor',
};

const STYLE =
  'Hand-painted fantasy game art in the style of early-2000s RTS classics (Warcraft III: The Frozen Throne era): ' +
  'painterly brushwork, rich saturated colors, chunky exaggerated proportions, dramatic rim lighting, ' +
  'gritty heroic dark-fantasy mood, slight 3/4 top-down perspective, strong readable silhouette, centered single subject. ' +
  'No text, no letters, no watermark, no UI, no frame or border. Fully transparent background.';

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
  items.push({ id: 'misc-icon', out: 'misc/icon.png', size: '1024x1024', transparent: false,
    prompt: 'Square mobile game app icon for a dark-fantasy maze tower-defense game: a single bold ice-crystal tower emblem on a dark slate rune-ring background, hand-painted Warcraft III Frozen Throne style, rich color, dramatic lighting, fills the frame edge to edge, no text, no border.' });
  items.push({ id: 'misc-background', out: 'misc/background.png', size: '1536x1024', transparent: false,
    prompt: 'Top-down hand-painted dark fantasy battlefield terrain for a tower-defense map: weathered dark slate stone ground with subtle cracks, moss and snow patches, muted cool tones around #1b1f2a, painterly Warcraft III Frozen Throne style, evenly lit, low contrast so game pieces stay readable on top, no characters, no buildings, no text, no UI, no grid lines.' });
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
  for (const it of items) map[it.id] = 'assets/' + it.out;
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
