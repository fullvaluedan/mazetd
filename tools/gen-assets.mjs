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
//   node tools/gen-assets.mjs --concurrency=4    # run up to 4 image requests at once
//
// Cost note: this calls a PAID API. The full set now includes tower upgrade
// variants and family attack sheets — generate a few first (e.g.
// `node tools/gen-assets.mjs tower-cannon`) to dial in the style.
// =============================================================================

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  arrow: 'a cozy wooden watchtower with a cute mounted crossbow, rope and timber details',
  archer: 'a cozy wooden watchtower with a cute mounted crossbow, rope and timber details',
  cannon: 'a squat round cannon turret with a friendly chunky barrel, riveted plates',
  frost: 'a sparkly tower of pale-blue ice crystals with gentle snowflake glints',
  arcane: 'a violet wizard spire with a floating glowing rune orb and tiny stars',
  poison: 'a quirky mushroom-like spitter tower dripping bubbly green goo',
  venom: 'a quirky mushroom-like spitter tower dripping bubbly green goo',
  lightning: 'a copper storm tower with a crackling lightning coil and little sparks',
  tesla: 'a copper storm tower with a crackling lightning coil and little sparks',
  support: 'a white-and-gold shrine tower radiating a soft circular blessing aura, floating runic halo',
  beacon: 'a white-and-gold shrine tower radiating a soft circular blessing aura, floating runic halo',
  sniper: 'a tall elegant marksman tower with a long barrel, scoped lens, and crisp precision silhouette',
  gold: 'a compact treasury or gold mine tower with coin sparkle accents and a strong value-read silhouette',
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

const TILE_STYLE =
  'Clean modern anime game art in a lighthearted isekai-fantasy style: ' +
  'bright cheerful saturated colors, simple flat cel shading with soft dark outlines, ' +
  'soft ambient lighting, 30-degree top-down battlefield tile art, 32x32 footprint, ' +
  'seamless edges, readable at phone scale, no text, no letters, no watermark, no UI, ' +
  'fully transparent background.';

// 4-frame walk cycles as one 2x2 sheet (sliced + auto-centered at load by
// src/ui/sprites.js; a sheet that comes out misaligned is simply dropped).
const SHEET_TYPES = ['normal', 'fast', 'tank', 'swarm', 'healer', 'shield', 'boss'];
const STANDARD_TOWER_LEVELS = 5;
const TOWER_LEVEL_DESCRIPTIONS = {
  1: 'baseline silhouette, clean and readable',
  2: 'first upgrade, slightly more ornamented and confident',
  3: 'second upgrade, clearly stronger with a new visual cue',
  4: 'advanced upgrade, premium trim and a stronger crown shape',
  5: 'signature endgame upgrade, dramatic but still the same family',
};
const TOWER_FAMILY_LEVEL_NOTES = {
  cannon: {
    1: 'Keep this as a compact bronze mortar with a short stubby barrel, round drum base, and simple side shield.',
    2: 'Make it visibly taller and sturdier with a longer barrel, thicker collar, and broader cheek plates.',
    3: 'Shift the chassis into a heavier siege frame with recoil braces, side pistons, and a more angular housing.',
    4: 'Push the silhouette into command-artillery territory with a flared muzzle, armored side fins, and a wider layered base.',
    5: 'Go dramatic and unmistakable: oversized barrel, reinforced recoil system, ornate wing-like stabilizers, and the largest base in the family.',
  },
};
const TOWER_FAMILY_ATTACK_NOTES = {
  cannon: 'This family should feel like a true artillery weapon: clear wind-up, muzzle flash, recoil, smoke, and settle. Let the barrel and support frame visibly change between frames so the cycle reads at a glance.',
  lightning: 'This family should feel like a crackling storm tower: charge, strike, discharge, and settle. Keep the coil and sparks readable in every frame.',
  support: 'This family should feel like a blessing aura: pulse, glow, peak, and settle. Keep the shrine readable while the halo breathes around it.',
  gold: 'This family should feel like an income pulse: shimmer, coin ping, glow, and settle. Keep the mine/treasury readable while the sparkles loop.',
};

function towerLevelPrompt(id, t, level) {
  const base = TOWER_HINT[id] || 'a defensive tower';
  const tierNote = TOWER_LEVEL_DESCRIPTIONS[level] || 'upgrade state';
  const familyNote = TOWER_FAMILY_LEVEL_NOTES[id]?.[level];
  return `Top-down game icon of the "${t.name}" defense tower, level ${level}: ${base}. ` +
    `This is the same family at a different upgrade level, so keep the footprint 1x1 and the silhouette coherent. ` +
    `Level note: ${tierNote}. ` +
    (familyNote ? `Family-specific silhouette note: ${familyNote} The cannon family should read as a real tier jump rather than just extra rivets. ` : '') +
    `Primary colour ${t.color}. ${STYLE}`;
}

const TOWER_META = { version: 1, kind: 'sprite', logical: [32, 32], pivot: [0.5, 0.56], scaleMode: 'contain' };
const TOWER_2X2_META = { version: 2, kind: 'sprite', logical: [64, 64], footprint: [2, 2], pivot: [0.5, 0.5], scaleMode: 'contain' };
const ENEMY_META = { version: 1, kind: 'sprite', logical: [32, 32], pivot: [0.5, 0.62], scaleMode: 'contain' };
const SHEET_META = { version: 1, kind: 'sheet', logical: [32, 32], pivot: [0.5, 0.62], scaleMode: 'contain' };
const BRUTE_ENEMY_META = { version: 2, kind: 'sprite', logical: [48, 48], pivot: [0.5, 0.62], scaleMode: 'contain' };
const BRUTE_SHEET_META = { version: 2, kind: 'sheet', logical: [48, 48], pivot: [0.5, 0.62], scaleMode: 'contain' };
const TOWER_2X2_SHEET_META = { version: 2, kind: 'sheet', logical: [64, 64], footprint: [2, 2], pivot: [0.5, 0.5], scaleMode: 'contain' };
const TILE_META = { version: 1, kind: 'tile', logical: [32, 32], footprint: [1, 1], pivot: [0.5, 0.5], scaleMode: 'tile' };
const PORTAL_META = { version: 1, kind: 'sprite', logical: [96, 96], footprint: [3, 3], pivot: [0.5, 0.5], scaleMode: 'contain' };
const CRYSTAL_META = { version: 1, kind: 'sprite', logical: [96, 128], footprint: [3, 4], pivot: [0.5, 0.5], scaleMode: 'contain' };
const WALL_META = { version: 1, kind: 'sprite', logical: [32, 32], footprint: [1, 1], pivot: [0.5, 0.5], scaleMode: 'tile' };

function towerAttackSheetPrompt(id, t) {
  const base = TOWER_HINT[id] || 'a defensive tower';
  const familyNote = TOWER_FAMILY_ATTACK_NOTES[id];
  return 'Sprite sheet, EXACTLY 4 frames arranged in a 2x2 grid on one image: ' +
    `the SAME tower family — "${t.name}" — drawn in 4 sequential attack poses ` +
    `(wind-up, fire, recoil, settle). Keep the tower on a 1x1 footprint, preserve the family silhouette, ` +
    `and show a readable attack motion rather than changing the tower into a different object. ` +
    (familyNote ? `${familyNote} ` : '') +
    `Tower base design: ${base}. Primary colour ${t.color}. ` +
    'Each frame centered in its quadrant, same camera angle and lighting throughout, equal spacing, ' +
    'no frame borders or grid lines. ' + STYLE;
}

function towerLoopSheetPrompt(id, t, kind) {
  const base = TOWER_HINT[id] || 'a defensive tower';
  const note = TOWER_FAMILY_ATTACK_NOTES[id];
  const action = kind === 'aura' ? 'aura pulse poses' : 'income pulse poses';
  return 'Sprite sheet, EXACTLY 4 frames arranged in a 2x2 grid on one image: ' +
    `the SAME tower family — "${t.name}" — drawn in 4 sequential ${action}. ` +
    `Keep the tower on a 2x2 footprint, preserve the family silhouette, and show a readable loop rather than turning the tower into a different object. ` +
    (note ? `${note} ` : '') +
    `Tower base design: ${base}. Primary colour ${t.color}. ` +
    'Each frame centered in its quadrant, same camera angle and lighting throughout, equal spacing, ' +
    'no frame borders or grid lines. ' + STYLE;
}

function tilePrompt(title, brief) {
  return `Top-down battlefield tile art for a fantasy tower-defense game: ${brief} ` +
    `This is a single ${title}, painted as a readable 32x32 tile with a strong silhouette, ` +
    `upper-left lighting, soft lower-right shadow, and transparent background. ${TILE_STYLE}`;
}

function shouldGenerateTowerLevels(t) {
  return !!t.tiers && !t.hidden && !t.wall;
}

function shouldGenerateTowerAttack(t) {
  return !!t.tiers && !t.hidden && !t.wall && !t.aura && !t.noAttack && t.damage > 0;
}
function shouldGenerateTowerLoop(t) {
  return !!t.tiers && !t.hidden && (t.aura || t.noAttack);
}
function sheetPrompt(hint) {
  return 'Sprite sheet, EXACTLY 4 frames arranged in a 2x2 grid on one image: ' +
    `the SAME character — ${hint} — drawn in 4 sequential walk-cycle poses ` +
    '(contact, down, passing, up). Identical character design and scale in every frame, ' +
    'each frame centered in its quadrant, same camera angle and lighting throughout, equal spacing, ' +
    'no frame borders or grid lines. ' + STYLE;
}

export function buildManifest() {
  const items = [];
  items.push({
    id: 'ui-icons', out: 'ui/icons.svg', static: true,
    meta: { version: 1, kind: 'svg-symbol-sheet', intrinsic: [24, 24], scaleMode: 'contain' },
  });
  // Grid-owned map kit: source pixels are 64 per cell while logical bounds
  // remain tied to the engine's 32px cell. These files are normalized outputs,
  // never flattened map art or staging sources.
  items.push(
    { id: 'tile-floor-dirt', out: 'tiles/floor-dirt-v1.png', static: true, meta: TILE_META },
    { id: 'tile-stone-pad', out: 'tiles/stone-pad-v1.png', static: true, meta: TILE_META },
    { id: 'objective-portal', out: 'objectives/portal-v1.png', static: true, meta: PORTAL_META },
    { id: 'objective-crystal', out: 'objectives/crystal-v1.png', static: true, meta: CRYSTAL_META },
    { id: 'tower-wall-redbrick', out: 'towers/wall-redbrick-v1.png', static: true, meta: WALL_META },
  );
  for (const [id, t] of Object.entries(CONFIG.TOWERS)) {
    items.push({ id: `tower-${id}`, out: `towers/${id}.png`, size: '1024x1024',
      meta: id === 'wall' ? { ...TOWER_META, pivot: [0.5, 0.5] } : TOWER_META,
      prompt: `Top-down game icon of a "${t.name}" defense tower: ${TOWER_HINT[id] || 'a defensive turret'}. Primary colour ${t.color}. ${STYLE}` });
    if (shouldGenerateTowerLevels(t)) {
      const maxLevel = Math.min(STANDARD_TOWER_LEVELS, (t.tiers?.length || 0) + 1);
      for (let level = 1; level <= maxLevel; level++) {
        const approvedArrowTier = id === 'arrow' && level <= 5;
        const approvedCannonTier = id === 'cannon' && level <= 5;
        const approvedFrostTier = id === 'frost' && level <= 5;
        const approvedPoisonTier = id === 'poison' && level <= 5;
        const approvedSniperTier = id === 'sniper' && level <= 5;
        const approvedLightningTier = id === 'lightning' && level <= 5;
        const approvedSupportTier = id === 'support' && level <= 5;
        const approvedGoldTier = id === 'gold' && level <= 5;
        const versionedTower = approvedArrowTier || approvedCannonTier || approvedFrostTier || approvedPoisonTier || approvedSniperTier || approvedLightningTier;
        items.push({
          id: `tower-${id}-lv${level}`,
          out: approvedArrowTier ? `towers/${id}-lv${level}-v2.png`
            : approvedCannonTier ? `towers/cannon-lv${level}-v${level === 2 ? 3 : level === 4 ? 3 : 2}.png`
              : approvedFrostTier ? `towers/frost-lv${level}-v2.png`
              : approvedPoisonTier ? `towers/poison-lv${level}-v3.png`
              : approvedSniperTier ? `towers/sniper-lv${level}-v4.png`
              : approvedLightningTier ? `towers/lightning-lv${level}-v2.png`
              : approvedSupportTier ? `towers/support-lv${level}-v2.png`
                : approvedGoldTier ? `towers/gold-lv${level}-v2.png`
              : `towers/${id}-lv${level}.png`,
          size: '1024x1024',
          meta: versionedTower || approvedSupportTier || approvedGoldTier ? TOWER_2X2_META : TOWER_META,
          prompt: towerLevelPrompt(id, t, level),
        });
      }
    }
    if (shouldGenerateTowerAttack(t)) {
      const approvedArrowSheet = id === 'arrow';
      const approvedPoisonSheet = id === 'poison';
      const approvedSniperSheet = id === 'sniper';
      items.push({
        id: `sheet-tower-${id}-attack`,
        out: approvedArrowSheet ? `sheets/tower-${id}-attack-v2.png`
          : approvedPoisonSheet ? `sheets/tower-poison-attack-v3.png`
          : approvedSniperSheet ? `sheets/tower-sniper-attack-v3.png`
          : id === 'lightning' ? `sheets/tower-lightning-attack-v2.png`
          : id === 'frost' ? `sheets/tower-frost-attack-v2.png`
          : `sheets/tower-${id}-attack.png`,
        size: '1024x1024',
        frames: 4,
        grid: [2, 2],
        meta: approvedArrowSheet || approvedPoisonSheet || approvedSniperSheet || id === 'lightning' || id === 'frost'
          ? TOWER_2X2_SHEET_META
          : { ...SHEET_META, pivot: TOWER_META.pivot },
        prompt: towerAttackSheetPrompt(id, t),
      });
    }
    if (shouldGenerateTowerLoop(t)) {
      items.push({
        id: `sheet-tower-${id}-${t.aura ? 'aura' : 'income'}`,
        out: id === 'support' ? `sheets/tower-support-aura-v1.png` : `sheets/tower-gold-income-v1.png`,
        size: '1024x1024',
        frames: 4,
        grid: [2, 2],
        meta: TOWER_2X2_SHEET_META,
        prompt: towerLoopSheetPrompt(id, t, t.aura ? 'aura' : 'income'),
      });
    }
  }
  for (const [id, e] of Object.entries(CONFIG.ENEMIES)) {
    items.push({ id: `enemy-${id}`, out: ['normal', 'fast', 'tank', 'swarm', 'flyer', 'healer', 'shield', 'boss'].includes(id) ? `enemies/${id}-v2.png` : `enemies/${id}.png`, size: '1024x1024',
      meta: id === 'tank' ? BRUTE_ENEMY_META : id === 'swarm' ? { ...ENEMY_META, logical: [24, 24] } : ENEMY_META,
      prompt: `Game sprite of a "${e.name}" enemy for a tower-defense game: ${ENEMY_HINT[id] || 'a creature'}. Primary colour ${e.color}. ${STYLE}` });
    if (['normal', 'fast', 'tank', 'swarm', 'flyer', 'healer', 'shield', 'boss'].includes(id)) {
      for (const state of ['walk', 'defeat']) items.push({
        id: `sheet-enemy-${id}-${state}`,
        out: `sheets/enemy-${id}-${state}-v2.png`, size: '1024x1024',
        meta: id === 'tank' ? BRUTE_SHEET_META : id === 'swarm' ? { ...SHEET_META, logical: [24, 24] } : SHEET_META, frames: 4, grid: [2, 2],
        prompt: sheetPrompt(`the ${e.name} enemy ${state} cycle`),
      });
    }
  }
  for (const [id, h] of Object.entries(CONFIG.HEROES)) {
    items.push({ id: `hero-${id}`, out: `heroes/${id}.png`, size: '1024x1024',
      prompt: `Heroic character sprite of "${h.name}" — ${h.role}. Primary colour ${h.color}. ${STYLE}` });
  }
  for (const id of SHEET_TYPES) {
    items.push({ id: `sheet-enemy-${id}`, out: `sheets/enemy-${id}.png`, size: '1024x1024',
      meta: SHEET_META,
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
  items.push({ id: 'misc-spawn', out: 'misc/spawn.png', size: '1024x1024',
    prompt: 'Game map marker seen from above: a small swirling dark-purple portal mouth in the grass, gentle magic wisps curling out, ominous but cute. ' + STYLE });
  items.push({ id: 'misc-camp', out: 'misc/camp.png', size: '1024x1024',
    prompt: 'Game map marker seen from above: a small crystal-and-stone objective marker, like a tiny castle relic or crystal spire on a stone dais, cool blue glow with a gold ring base, readable at a glance, inviting and warm. ' + STYLE });
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
    map[it.id] = (it.meta || it.frames)
      ? { src: 'assets/' + it.out, ...(it.frames ? { frames: it.frames, grid: it.grid } : {}), ...(it.meta || {}) }
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
    console.log('  --concurrency=N      run up to N requests at once (default 4)');
    console.log('  id-filter            substring of asset id, e.g. "tower", "enemy-boss"');
    return;
  }
  const force = args.includes('--force');
  const listOnly = args.includes('--list') || args.includes('--dry-run');
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
  const concurrency = Math.max(1, Number((concurrencyArg && concurrencyArg.split('=')[1]) || process.env.ASSET_CONCURRENCY || 4) || 4);
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
    for (const m of selected) console.log(`  ${m.static ? 'validate' : 'generate'} ${m.id.padEnd(18)} -> assets/${m.out}  (${m.size || 'static'})`);
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
  const queue = selected.filter((item) => !item.static);
  skip += selected.length - queue.length;
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      try {
        const r = await generateOne(item, { apiKey, model, quality, force });
        r === 'ok' ? ok++ : skip++;
      } catch (e) {
        fail++;
        console.error(`  FAILED         ${item.id}: ${e.message}`);
      }
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) workers.push(worker());
  await Promise.all(workers);
  await writeManifest(manifest);
  console.log(`\nDone: ${ok} generated, ${skip} skipped, ${fail} failed. Files in assets/.`);
  if (fail) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
