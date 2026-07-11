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

console.log('Production map asset manifest contract:');
expectAsset('tile-floor-dirt', 'tile', [32, 32], [1, 1]);
expectAsset('tile-stone-pad', 'tile', [32, 32], [1, 1]);
expectAsset('objective-portal', 'sprite', [96, 96], [3, 3]);
expectAsset('objective-crystal', 'sprite', [96, 128], [3, 4]);
expectAsset('tower-wall-redbrick', 'sprite', [32, 32], [1, 1]);

console.log(fails === 0 ? 'PRODUCTION_ASSETS_OK' : `PRODUCTION_ASSETS_FAIL (${fails})`);
if (fails) process.exitCode = 1;
