// Production art contract: the active manifest must declare the grid-owned
// map kit with exact logical dimensions and source-cell footprints.
import { buildManifest } from '../tools/gen-assets.mjs';

let fails = 0;
const check = (name, condition) => {
  console.log(condition ? '  ok  ' : '  FAIL', name);
  if (!condition) fails++;
};
const byId = new Map(buildManifest().map((entry) => [entry.id, entry]));

const expectAsset = (id, kind, logical, footprint) => {
  const item = byId.get(id);
  check(`${id} exists`, !!item);
  check(`${id} has ${kind} metadata`, item?.meta?.kind === kind);
  check(`${id} has ${logical[0]}x${logical[1]} logical bounds`,
    item?.meta?.logical?.[0] === logical[0] && item?.meta?.logical?.[1] === logical[1]);
  check(`${id} has ${footprint[0]}x${footprint[1]} grid footprint`,
    item?.meta?.footprint?.[0] === footprint[0] && item?.meta?.footprint?.[1] === footprint[1]);
};
const expectEnemy = (id, kind, logical) => {
  const item = byId.get(id);
  check(`${id} exists`, !!item);
  check(`${id} has ${kind} metadata`, item?.meta?.kind === kind);
  check(`${id} has ${logical[0]}x${logical[1]} logical bounds`,
    item?.meta?.logical?.[0] === logical[0] && item?.meta?.logical?.[1] === logical[1]);
};

console.log('Production map asset manifest contract:');
expectAsset('tile-floor-dirt', 'tile', [32, 32], [1, 1]);
expectAsset('tile-stone-pad', 'tile', [32, 32], [1, 1]);
expectAsset('objective-portal', 'sprite', [96, 96], [3, 3]);
expectAsset('objective-crystal', 'sprite', [96, 128], [3, 4]);
expectAsset('tower-wall-redbrick', 'sprite', [32, 32], [1, 1]);
expectAsset('tower-arrow-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-arrow-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-arrow-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-arrow-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-arrow-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('sheet-tower-arrow-attack', 'sheet', [64, 64], [2, 2]);
expectAsset('tower-cannon-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-cannon-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-cannon-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-cannon-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-cannon-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-frost-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-frost-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-frost-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-frost-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-frost-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-poison-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-poison-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-poison-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-poison-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-poison-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('sheet-tower-poison-attack', 'sheet', [64, 64], [2, 2]);
expectAsset('tower-sniper-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-sniper-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-sniper-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-sniper-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-sniper-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('sheet-tower-sniper-attack', 'sheet', [64, 64], [2, 2]);
expectAsset('tower-lightning-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-lightning-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-lightning-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-lightning-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-lightning-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('sheet-tower-lightning-attack', 'sheet', [64, 64], [2, 2]);
expectAsset('tower-support-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-support-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-support-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-support-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-support-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('sheet-tower-support-aura', 'sheet', [64, 64], [2, 2]);
expectAsset('tower-gold-lv1', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-gold-lv2', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-gold-lv3', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-gold-lv4', 'sprite', [64, 64], [2, 2]);
expectAsset('tower-gold-lv5', 'sprite', [64, 64], [2, 2]);
expectAsset('sheet-tower-gold-income', 'sheet', [64, 64], [2, 2]);
expectEnemy('enemy-normal', 'sprite', [32, 32]);
expectEnemy('sheet-enemy-normal-walk', 'sheet', [32, 32]);
expectEnemy('sheet-enemy-normal-defeat', 'sheet', [32, 32]);
expectEnemy('enemy-fast', 'sprite', [32, 32]);
expectEnemy('sheet-enemy-fast-walk', 'sheet', [32, 32]);
expectEnemy('sheet-enemy-fast-defeat', 'sheet', [32, 32]);
expectEnemy('enemy-tank', 'sprite', [48, 48]);
expectEnemy('sheet-enemy-tank-walk', 'sheet', [48, 48]);
expectEnemy('sheet-enemy-tank-defeat', 'sheet', [48, 48]);
expectEnemy('enemy-swarm', 'sprite', [24, 24]);
expectEnemy('sheet-enemy-swarm-walk', 'sheet', [24, 24]);
expectEnemy('sheet-enemy-swarm-defeat', 'sheet', [24, 24]);
expectEnemy('enemy-flyer', 'sprite', [32, 32]);
expectEnemy('sheet-enemy-flyer-walk', 'sheet', [32, 32]);
expectEnemy('sheet-enemy-flyer-defeat', 'sheet', [32, 32]);

console.log(fails === 0 ? 'PRODUCTION_ASSETS_OK' : `PRODUCTION_ASSETS_FAIL (${fails})`);
if (fails) process.exitCode = 1;
