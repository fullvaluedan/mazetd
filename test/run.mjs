// Test runner: executes every suite sequentially, fails the run if any suite
// exits nonzero OR prints a *_FAIL line. Usage: npm test
// Fast unit suites first; the two long balance gates (t10validate, campaign-sim) last.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

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
  't10validate.mjs',   // balance gate: classic board, 6 seeds + all heroes
  'campaign-sim.mjs',  // balance gate: reference clears all 20 campaign levels
];

let failed = 0;
for (const suite of SUITES) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(here, suite)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const bad = r.status !== 0 || /_FAIL/.test(out);
  console.log(`${bad ? 'FAIL' : 'pass'}  ${suite}  (${secs}s)`);
  if (bad) {
    failed++;
    console.log(out.split('\n').filter((l) => /FAIL|Error/.test(l)).join('\n') || out.slice(-2000));
  }
}

console.log(failed === 0 ? `\nALL_SUITES_OK (${SUITES.length})` : `\nSUITES_FAILED (${failed}/${SUITES.length})`);
process.exit(failed === 0 ? 0 : 1);
