// Phase M1 checks — WC3 damage-type vs armor-type matchup matrix.
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/engine/rng.js';
import { createState } from '../src/game/state.js';
import { Enemy } from '../src/game/enemy.js';
import { getTowerStats } from '../src/game/tower.js';
import { dealDamage } from '../src/game/projectile.js';
import { matchup, strongWeak } from '../src/game/damage.js';
import { cellCenter } from '../src/engine/grid.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };
const enemyAt = (st, type, cx, cy, hp) => {
  const e = new Enemy(st, type, 'S1', st.routing['S1'], { hp, speed: 1e-6, bounty: 1 });
  const c = cellCenter(cx, cy); e.x = c.x; e.y = c.y; e.cx = cx; e.cy = cy; st.enemies.push(e); return e;
};

console.log('matchup() lookups:');
{
  check('pierce vs fortified 0.6', matchup('pierce', 'fortified') === 0.6);
  check('pierce vs light 1.5', matchup('pierce', 'light') === 1.5);
  check('magic vs heavy 1.5', matchup('magic', 'heavy') === 1.5);
  check('siege vs fortified 1.5', matchup('siege', 'fortified') === 1.5);
  check('chaos neutral', matchup('chaos', 'fortified') === 1 && matchup('chaos', 'boss') === 1);
  check('unknown type neutral', matchup('physical', 'heavy') === 1 && matchup('magic', 'nope') === 1);
}

console.log('takeDamage applies the matrix:');
{
  const st = createState(makeRng(1));
  const tank = enemyAt(st, 'tank', 10, 9, 1000);     // fortified
  check('pierce reduced vs fortified', tank.takeDamage(100, 'pierce') === 60);
  check('siege amped vs fortified', tank.takeDamage(100, 'siege') === 150);
  check('chaos full vs fortified', tank.takeDamage(100, 'chaos') === 100);
  const fast = enemyAt(st, 'fast', 11, 9, 1000);     // light
  check('pierce amped vs light', fast.takeDamage(100, 'pierce') === 150);
}

console.log('shields: matrix first, magic bypasses:');
{
  const st = createState(makeRng(1));
  const w = enemyAt(st, 'shield', 10, 9, 1000);      // heavy, shield = 250
  check('warden shield pool', w.shieldHp === 250);
  const hp0 = w.hp;
  const dealt = w.takeDamage(100, 'pierce');          // 75 post-matrix, all absorbed
  check('pierce absorbed post-matrix', dealt === 0 && w.shieldHp === 175 && w.hp === hp0, `shield ${w.shieldHp}`);
  const dealt2 = w.takeDamage(100, 'magic');          // 150, bypasses shield
  check('magic bypasses shield', dealt2 === 150 && w.shieldHp === 175);
}

console.log('shatter stacks on top of the matrix:');
{
  const st = createState(makeRng(1));
  const tank = enemyAt(st, 'tank', 10, 9, 10000);
  tank.applyShatter(0.5, 5);
  check('pierce * 0.6 * 1.5', Math.abs(tank.takeDamage(100, 'pierce') - 90) < 1e-9);
}

console.log('poison DoT scaled at application:');
{
  const st = createState(makeRng(1));
  const grunt = enemyAt(st, 'normal', 10, 9, 1e6);   // medium: poison 1.5x
  const venom = getTowerStats('venom', 1, null);
  dealDamage(st, grunt, 0, venom);
  check('stack dps = dotDps * 1.5', grunt.poison.length === 1 && Math.abs(grunt.poison[0].dps - venom.dotDps * 1.5) < 1e-9, `${grunt.poison[0] && grunt.poison[0].dps}`);
  const brute = enemyAt(st, 'tank', 11, 9, 1e6);     // fortified: poison 1.0x
  dealDamage(st, brute, 0, venom);
  check('stack dps neutral vs fortified', Math.abs(brute.poison[0].dps - venom.dotDps) < 1e-9);
}

console.log('branch damageType override (Archmage = chaos):');
{
  const s3 = getTowerStats('arcane', 3, null);
  const s4 = getTowerStats('arcane', 4, 'A');
  check('L3 arcane is magic', s3.damageType === 'magic');
  check('L4A archmage is chaos', s4.damageType === 'chaos');
  check('L4B disrupt stays magic', getTowerStats('arcane', 4, 'B').damageType === 'magic');
}

console.log('strongWeak badge data:');
{
  const p = strongWeak('pierce');
  check('pierce strong U+L', p.strong.length === 2 && p.strong.includes('unarmored') && p.strong.includes('light'));
  check('pierce weak H+F', p.weak.length === 2 && p.weak.includes('heavy') && p.weak.includes('fortified'));
  const c = strongWeak('chaos');
  check('chaos no badges', c.strong.length === 0 && c.weak.length === 0);
}

console.log(fails === 0 ? 'MATRIX_OK' : `MATRIX_FAIL (${fails})`);
