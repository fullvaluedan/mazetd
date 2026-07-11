// Test runner: executes every suite sequentially, fails the run if any suite
// exits nonzero OR prints a *_FAIL line. Usage: npm test
// Fast unit suites first; the two long balance gates (t10validate, campaign-sim) last.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Each entry is a file name, or [file, ...args] for suites run in several modes.
const SUITES = [
  't10matrix.mjs',
  't10aura.mjs',
  't10siege.mjs',
  't10save.mjs',
  't10ads.mjs',
  't10sfx.mjs',
  't10viewport.mjs',
  't11economy.mjs',
  't11levels.mjs',
  't11profile.mjs',
  't11hero.mjs',
  't12batch.mjs',
  't12render.mjs',
  't12mechanics.mjs',
  't12resume.mjs',
  't13assets.mjs',
  't14asset-files.mjs',
  't15ui-contract.mjs',
  't16sprite-layout.mjs',
  't17campaign-leaderboard.mjs',
  't18footprints.mjs',
  't19-production-assets.mjs',
  't19-map-kit.mjs',
  't10validate.mjs',                 // balance gate: classic board, 6 seeds + all heroes
  'campaign-sim.mjs',                // balance gate: reference wins all 20 + margin bands
  ['campaign-sim.mjs', '--careless'],  // balance gate: naive play first dies in 2..10
  ['campaign-sim.mjs', '--noupgrade'], // balance gate: unupgraded build first dies in 3..7
];

let failed = 0;
for (const suite of SUITES) {
  const [file, ...suiteArgs] = Array.isArray(suite) ? suite : [suite];
  const label = [file, ...suiteArgs].join(' ');
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(here, file), ...suiteArgs], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const bad = r.status !== 0 || /_FAIL/.test(out);
  console.log(`${bad ? 'FAIL' : 'pass'}  ${label}  (${secs}s)`);
  if (bad) {
    failed++;
    console.log(out.split('\n').filter((l) => /FAIL|Error/.test(l)).join('\n') || out.slice(-2000));
  }
}

console.log(failed === 0 ? `\nALL_SUITES_OK (${SUITES.length})` : `\nSUITES_FAILED (${failed}/${SUITES.length})`);
process.exit(failed === 0 ? 0 : 1);
