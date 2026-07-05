// U7 checks — sfx service is headless-safe; event queue pushes + caps.
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { createState, pushEvent } from '../src/game/state.js';
import { startWave } from '../src/game/wave.js';
import { Enemy } from '../src/game/enemy.js';
import { addTower } from '../src/game/tower.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

console.log('sfx is a no-op without AudioContext / DOM:');
{
  const store = new Map();
  global.localStorage = { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const sfx = await import('../src/services/sfx.js');
  let threw = false;
  try { sfx.initAudio(); sfx.play('build'); sfx.play('nope'); } catch { threw = true; }
  check('initAudio/play never throw headless', !threw);
  check('not muted by default', sfx.isMuted() === false);
  sfx.setMuted(true);
  check('mute persists to storage', store.get('mazecore_sfx_muted_v1') === '1' && sfx.isMuted());
  check('toggle returns new state', sfx.toggleMuted() === false && !store.has('mazecore_sfx_muted_v1'));
}

console.log('event queue: pushes from sim systems, capped at 64:');
{
  const st = createState(makeRng(1));
  check('starts empty', Array.isArray(st.events) && st.events.length === 0);

  startWave(st, 1);
  check('startWave pushes horn', st.events.some((e) => e.t === 'horn'));

  addTower(st, 'archer', 5, 5);
  const e = new Enemy(st, 'normal', 'S1', st.routing['S1'], { hp: 1e6, speed: 1e-6, bounty: 1 });
  st.enemies.push(e);
  // park the enemy in archer range and force a shot
  const t = st.towers[0];
  e.x = t.px + 16; e.y = t.py; e.cx = t.cx; e.cy = t.cy;
  t.cooldownLeft = 0;
  t.update(1 / 60, st);
  check('tower fire pushes shot event', st.events.some((ev) => ev.t === 'shot' && ev.d === 'pierce'));

  for (let i = 0; i < 200; i++) pushEvent(st, 'death');
  check('queue caps at 64', st.events.length === 64);
}

console.log(fails === 0 ? 'SFX_OK' : `SFX_FAIL (${fails})`);
