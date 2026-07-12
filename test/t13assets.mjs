// Asset contract checks — the generator now emits tower level variants plus
// family attack-sheet ids, and the manifest shape stays stable.
import { buildManifest } from '../tools/gen-assets.mjs';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };
const find = (items, id) => items.find((m) => m.id === id);

const manifest = buildManifest();

console.log('Tower asset manifest: live roster gains level variants and attack sheets:');
{
  const cannonLv1 = find(manifest, 'tower-cannon-lv1');
  const cannonLv5 = find(manifest, 'tower-cannon-lv5');
  const cannonAtk = find(manifest, 'sheet-tower-cannon-attack');
  const goldLv5 = find(manifest, 'tower-gold-lv5');
  const uiIcons = find(manifest, 'ui-icons');
  const wall = find(manifest, 'tower-wall');
  const arrowLv5 = find(manifest, 'tower-arrow-lv5');
  const enemyBoss = find(manifest, 'enemy-boss');
  const enemySheet = find(manifest, 'sheet-enemy-normal');
  check('cannon lv1 manifest entry exists', !!cannonLv1 && cannonLv1.out === 'towers/cannon-lv1-v2.png');
  check('cannon lv5 manifest entry exists', !!cannonLv5 && cannonLv5.out === 'towers/cannon-lv5-v2.png');
  check('cannon attack sheet entry exists', !!cannonAtk && cannonAtk.out === 'sheets/tower-cannon-attack.png' && cannonAtk.frames === 4);
  check('gold level variants are listed', !!goldLv5 && goldLv5.out === 'towers/gold-lv5-v2.png');
  check('obsolete repeated border-tile family is not generated', !find(manifest, 'tile-border'));
  check('obsolete path-tile family is not generated', !find(manifest, 'tile-path'));
  check('UI icon metadata is versioned', !!uiIcons && uiIcons.static === true && uiIcons.meta?.version === 1 && uiIcons.meta?.kind === 'svg-symbol-sheet');
  check('wall sprite metadata declares its logical footprint', wall?.meta?.kind === 'sprite' && wall.meta.logical?.[0] === 32 && wall.meta.pivot?.[0] === 0.5);
  check('tower levels inherit sprite metadata', arrowLv5?.meta?.kind === 'sprite' && arrowLv5.meta.logical?.[0] === 64);
  check('enemy sprites declare a grounded pivot', enemyBoss?.meta?.kind === 'sprite' && enemyBoss.meta.pivot?.[1] === 0.62);
  check('animated enemy sheets retain slicing metadata', enemySheet?.meta?.kind === 'sheet' && enemySheet.frames === 4 && enemySheet.grid?.[0] === 2);
  check('wall stays base-only', !find(manifest, 'tower-wall-lv1'));
  check('legacy hidden towers stay base-only', !find(manifest, 'tower-magic-lv1') && !find(manifest, 'tower-falcon-lv1'));
}

console.log(fails === 0 ? 'ASSET_OK' : `ASSET_FAIL (${fails})`);
