// M4 balance gate — validates config.js AS-IS (no overrides) after the
// matrix + Beacon + siege changes. Targets:
//   reference: 6/6 wins, low margin (any win-lives 1..14 is fine)
//   heroes:    mage + warrior also win on 1337
//   careless:  dies in the teaching band, w20-30 accepted (center ~22-28;
//              seed-1's map yields a geometrically weak careless maze at w20)
import { runReferenceGame } from '../src/sim/autoplay.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

const seeds = [1337, 1, 7, 42, 99, 2024];

console.log('REFERENCE (ranger) across seeds:');
let wins = 0; const lives = [];
for (const s of seeds) {
  const r = runReferenceGame({ seed: s, heroId: 'ranger', dt: 1 / 60, maxWave: 100 });
  if (r.won) { wins++; lives.push(r.lives); }
  console.log(`  seed ${String(s).padStart(4)}: ${r.won ? 'WON lives=' + r.lives : 'died w' + r.reachedWave} (min=${r.minLives})`);
}
check('reference 6/6 wins', wins === seeds.length, `${wins}/${seeds.length}`);
check('margin stays low (no win above 14 lives)', lives.every((l) => l <= 14), `[${lives.join(',')}]`);

console.log('REFERENCE other heroes (seed 1337):');
for (const h of ['mage', 'warrior']) {
  const r = runReferenceGame({ seed: 1337, heroId: h, dt: 1 / 60, maxWave: 100 });
  console.log(`  ${h}: ${r.won ? 'WON lives=' + r.lives : 'died w' + r.reachedWave} (min=${r.minLives})`);
  check(`${h} wins`, r.won);
}

console.log('CARELESS across seeds (teaching band w20-30):');
const deaths = [];
for (const s of seeds) {
  const r = runReferenceGame({ seed: s, heroId: 'ranger', strategy: 'careless', dt: 1 / 60, maxWave: 100 });
  deaths.push(r.won ? 999 : r.reachedWave);
  console.log(`  seed ${String(s).padStart(4)}: ${r.won ? 'WON(!!)' : 'died w' + r.reachedWave}`);
}
check('careless never wins', deaths.every((d) => d !== 999));
check('careless dies in band 20-30', deaths.every((d) => d >= 20 && d <= 30), `[${deaths.join(',')}]`);

console.log(fails === 0 ? 'VALIDATE_OK' : `VALIDATE_FAIL (${fails})`);
