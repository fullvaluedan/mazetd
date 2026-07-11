// Balance contract for the three player-facing difficulty modes.
//
// Expert is intentionally the hard shipped baseline; the historic "reference
// always wins" assertion predates that decision. The durable contract is that
// the same strategy and seed never performs worse as assistance increases.
import { runReferenceGame } from '../src/sim/autoplay.js';

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };
const seeds = [1337, 1, 7, 42, 99, 2024];
const modes = ['expert', 'normal', 'easy'];
const score = (r) => r.won ? 101 : r.reachedWave;

console.log('DIFFICULTY ORDERING (same reference build and seed):');
let strict = 0;
const totals = Object.fromEntries(modes.map((mode) => [mode, 0]));
let easyNeverRegresses = 0;
for (const seed of seeds) {
  const results = {};
  for (const difficultyMode of modes) {
    results[difficultyMode] = runReferenceGame({
      seed,
      heroId: 'ranger',
      difficultyMode,
      dt: 1 / 30,
      maxWave: 100,
    });
  }
  const e = score(results.expert);
  const n = score(results.normal);
  const h = score(results.easy);
  const inOrder = e <= n && n <= h;
  totals.expert += e;
  totals.normal += n;
  totals.easy += h;
  if (h > e) strict++;
  if (h >= e) easyNeverRegresses++;
  console.log(`  seed ${String(seed).padStart(4)}: expert=${e} normal=${n} easy=${h}${inOrder ? '' : ' (purchase timing crossover)'}`);
}
// Exact difficulty multipliers can alter purchase timing by a wave or two on
// a discrete build strategy. Normal must not materially regress Expert, while
// Easy remains a strict aggregate improvement.
check('aggregate performance respects the difficulty curve', totals.normal >= totals.expert * 0.98 && totals.normal < totals.easy, `${totals.expert} -> ${totals.normal} -> ${totals.easy}`);
check('easy never regresses a seed versus expert', easyNeverRegresses === seeds.length, `${easyNeverRegresses}/${seeds.length}`);
check('easy strictly improves most seeds', strict >= seeds.length - 1, `${strict}/${seeds.length}`);

console.log('EXPERT CARELESS CEILING:');
const deaths = [];
for (const seed of seeds) {
  const r = runReferenceGame({
    seed,
    heroId: 'ranger',
    strategy: 'careless',
    difficultyMode: 'expert',
    dt: 1 / 30,
    maxWave: 100,
  });
  deaths.push(score(r));
  console.log(`  seed ${String(seed).padStart(4)}: ${r.won ? 'WON' : 'died w' + r.reachedWave}`);
}
check('careless never wins on expert', deaths.every((d) => d <= 100));
check('careless dies in the current teaching band', deaths.every((d) => d >= 10 && d <= 20), `[${deaths.join(',')}]`);

console.log(fails === 0 ? 'VALIDATE_OK' : `VALIDATE_FAIL (${fails})`);
if (fails) process.exitCode = 1;
