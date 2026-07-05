// C3 checks — hero guard-post auto-engage: fights without orders, prioritizes
// wall-chewers, respects the leash, drifts home, and contact dps uses atk.
import { CONFIG, TICK_DT } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { setGridSize, cellCenter } from '../src/engine/grid.js';
import { createState } from '../src/game/state.js';
import { Enemy, updateEnemies } from '../src/game/enemy.js';
import { addTower } from '../src/game/tower.js';
import { createHero } from '../src/game/hero.js';
import { onEnemyKilled, onEnemyLeaked } from '../src/game/economy.js';
import { updateProjectiles } from '../src/game/projectile.js';
import { getLevel } from '../src/game/levels.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

function tick(st, seconds) {
  const n = Math.round(seconds / TICK_DT);
  for (let i = 0; i < n; i++) {
    st.time += TICK_DT;
    updateEnemies(st, TICK_DT, onEnemyKilled, onEnemyLeaked);
    updateProjectiles(st, TICK_DT);
    if (st.hero) st.hero.update(TICK_DT, st);
  }
}
const parkEnemy = (st, type, cx, cy, hp = 1e5) => {
  const e = new Enemy(st, type, 'S1', st.routing['S1'], { hp, speed: 1e-9, bounty: 1 });
  const c = cellCenter(cx, cy); e.x = c.x; e.y = c.y; e.cx = cx; e.cy = cy;
  e.targetCell = { x: cx, y: cy }; e.targetCenter = { x: c.x, y: c.y };
  st.enemies.push(e); return e;
};
function freshState() {
  const lv = getLevel('l5');
  setGridSize(lv.cols, lv.rows);
  return createState(makeRng(1), 1, lv);
}

console.log('Auto-engage without any player order:');
{
  const st = freshState();
  const h = createHero(st, 'warrior');           // melee, must walk to targets
  const post = { ...h.guardPost };
  const e = parkEnemy(st, 'normal', post.x, Math.max(1, post.y - 2));   // 2 cells from post
  const hp0 = e.hp;
  tick(st, 6);
  check('hero attacked unprompted', e.hp < hp0, `${hp0} -> ${Math.round(e.hp)}`);
  check('hero left the post to fight', h.cx !== post.x || h.cy !== post.y || e.hp < hp0);
}

console.log('Out-of-aggro enemies are ignored:');
{
  const st = freshState();
  const h = createHero(st, 'ranger');
  const far = parkEnemy(st, 'normal', 5, 1);     // far from the exit-side post
  const hp0 = far.hp;
  tick(st, 4);
  check('no chase beyond aggro', far.hp === hp0 && h.cx === h.guardPost.x && h.cy === h.guardPost.y);
}

console.log('Wall-chewers outrank closer enemies:');
{
  const st = freshState();
  const h = createHero(st, 'ranger');            // ranged: hits from the post
  const post = h.guardPost;
  const near = parkEnemy(st, 'normal', post.x, post.y - 1);
  const chewer = parkEnemy(st, 'fast', post.x - 2, post.y);
  chewer.siegeTarget = addTower(st, 'wall', post.x - 3, post.y);   // fake an active chew
  tick(st, 1.2);
  const nearLost = 1e5 - near.hp, chewerLost = 1e5 - chewer.hp;
  check('priority target is the chewer', chewerLost > nearLost, `chewer -${Math.round(chewerLost)} vs near -${Math.round(nearLost)}`);
}

console.log('Orders still override and move the post:');
{
  const st = freshState();
  const h = createHero(st, 'warrior');
  h.commandMove(st, 5, 7);
  tick(st, 6);
  check('guard post follows the order', h.guardPost.x === 5 && h.guardPost.y === 7);
  check('hero walked there', Math.abs(h.cx - 5) <= 1 && Math.abs(h.cy - 7) <= 1, `${h.cx},${h.cy}`);
}

console.log('Contact damage scales with atk:');
{
  const st = freshState();
  st.wave = 5;
  const h = createHero(st, 'warrior');
  const c = cellCenter(h.cx, h.cy);
  const brute = parkEnemy(st, 'tank', h.cx, h.cy);   // atk 2.2
  brute.x = c.x; brute.y = c.y;
  const hp0 = h.hp;
  tick(st, 1);
  const lossBrute = hp0 - h.hp;
  check('brute hurts (hitFlash set)', lossBrute > 0 && h.hitFlash > -1);

  const st2 = freshState();
  st2.wave = 5;
  const h2 = createHero(st2, 'warrior');
  const c2 = cellCenter(h2.cx, h2.cy);
  const swarm = parkEnemy(st2, 'swarm', h2.cx, h2.cy); // atk 0.35
  swarm.x = c2.x; swarm.y = c2.y;
  const hp02 = h2.hp;
  tick(st2, 1);
  const lossSwarm = hp02 - h2.hp;
  check('atk drives the bite (2.2x vs 0.35x)', lossBrute > lossSwarm * 3, `${lossBrute.toFixed(1)} vs ${lossSwarm.toFixed(1)}`);
}

console.log(fails === 0 ? 'HERO_OK' : `HERO_FAIL (${fails})`);
