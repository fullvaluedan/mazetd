// U8 checks — rewarded-ads service: grant scaling, dual-gate cooldown,
// once-per-run revive, snapshot round-trip. Headless: provider not ready.
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { createState } from '../src/game/state.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

const store = new Map();
global.localStorage = { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const ads = await import('../src/services/ads.js');

console.log('headless: provider not ready, nothing grants:');
{
  const st = createState(makeRng(1));
  check('providerReady false (no DOM)', ads.providerReady() === false);
  check('isReady false', ads.isReady('FREE_GOLD', st) === false);
  const r = await ads.show('FREE_GOLD', st);
  check('show grants nothing', r.granted === false);
}

console.log('grant scaling + gates (provider faked ready):');
{
  ads.setProvider({ ready: () => true, show: async () => ({ completed: true }) });
  const st = createState(makeRng(1));
  st.wave = 10;
  check('grant = base + perWave*wave', ads.grantAmount('FREE_GOLD', st) === CONFIG.ADS.FREE_GOLD.base + CONFIG.ADS.FREE_GOLD.perWave * 10);
  check('fresh run: ready', ads.isReady('FREE_GOLD', st) === true);

  const r = await ads.show('FREE_GOLD', st);
  check('completed ad grants + stamps gates', r.granted === true && st.adFreeGoldWave === 10);
  check('immediately after: wave gate blocks', ads.isReady('FREE_GOLD', st) === false);
  check('cooldown text names the wave gate', /wave/.test(ads.cooldownText('FREE_GOLD', st)));

  st.wave = 13;                       // wave gate satisfied (3 waves)...
  check('wall-clock gate still blocks', ads.isReady('FREE_GOLD', st) === false);
  check('cooldown text shows m:ss', /^\d+:\d\d$/.test(ads.cooldownText('FREE_GOLD', st)));

  // age the wall-clock stamp past the cooldown
  const ls = JSON.parse(store.get('mazecore_ads_v1'));
  ls.freeGoldAt = Date.now() - (CONFIG.ADS.FREE_GOLD.cooldownMinutes * 60000 + 1000);
  store.set('mazecore_ads_v1', JSON.stringify(ls));
  check('both gates passed: ready again', ads.isReady('FREE_GOLD', st) === true);

  // an abandoned/failed ad must not grant or stamp
  ads.setProvider({ ready: () => true, show: async () => ({ completed: false }) });
  const r2 = await ads.show('FREE_GOLD', st);
  check('incomplete ad: no grant, no stamp', r2.granted === false && st.adFreeGoldWave === 10);
  ads.setProvider({ ready: () => true, show: async () => ({ completed: true }) });
}

console.log('revive: once per run:');
{
  const st = createState(makeRng(1));
  check('fresh: revive ready', ads.isReady('REVIVE', st) === true);
  st.reviveUsed = true;
  check('used: revive blocked', ads.isReady('REVIVE', st) === false);
}

console.log('snapshot carries the ad fields:');
{
  const st = createState(makeRng(CONFIG.SEED), CONFIG.SEED);
  st.adFreeGoldWave = 7;
  st.reviveUsed = true;
  const { buildSnapshot, applySnapshot } = await import('../src/game/save.js');
  const st2 = applySnapshot(buildSnapshot(st));
  check('adFreeGoldWave + reviveUsed round-trip', st2.adFreeGoldWave === 7 && st2.reviveUsed === true);
}

console.log(fails === 0 ? 'ADS_OK' : `ADS_FAIL (${fails})`);
