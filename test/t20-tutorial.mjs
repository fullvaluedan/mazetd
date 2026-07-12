// U5 checks, the skippable scripted Level 1 tutorial: the activation gate
// (fresh boot only: l1, no save, flag unset, DOM present), skip/finish
// teardown, the wall-vs-tower step-1 discrimination (off-script play must
// never break the machine), the victory/defeat force-end interruption, and
// the headless-safe contract (no DOM at all must never throw or activate).
// See docs/plans/2026-07-12-003-feat-clash-ui-and-2x2-polish-plan.md unit U5.

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };

function fakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
}
function fakeState(overrides = {}) {
  return { level: { id: 'l1' }, towers: [], waveActive: false, status: 'playing', ...overrides };
}
const wallTower = (level = 1) => ({ def: { wall: true }, level });
const towerTower = (level = 1) => ({ def: { wall: false }, level });

console.log('Headless contract: no document at all never throws, never activates:');
{
  check('document is not defined in this process yet', typeof document === 'undefined');
  const { createTutorial } = await import('../src/ui/tutorial.js');
  let threw = false;
  let t;
  try {
    t = createTutorial({});                       // fully default deps, no storage/hasSave/onPause given
    t.maybeStart(fakeState());
    t.refresh(fakeState({ status: 'lost' }));
    t.skip();
    t.next();
    t.begin && t.begin();
  } catch { threw = true; }
  check('headless construct + drive never throws', !threw);
  check('headless never activates', !!t && t.active === false);
}

// Every scenario below needs a DOM (the intro card mounts into #modal, the
// step chips mount into document.body), bring in the shared Node DOM shim.
const { installFakeDom } = await import('./fakedom.mjs');
installFakeDom();
const { createTutorial, FLAG_KEY } = await import('../src/ui/tutorial.js');

console.log('Activates on clean l1 boot conditions:');
{
  const t = createTutorial({ storage: fakeStorage(), hasSave: () => false });
  const started = t.maybeStart(fakeState());
  check('maybeStart reports true', started === true);
  check('module reports active', t.active === true);
  check('starts paused on step 0 (the intro card)', t.step === 0);
}

console.log('Does not activate when the flag is already set:');
{
  const t = createTutorial({ storage: fakeStorage({ [FLAG_KEY]: '1' }), hasSave: () => false });
  check('maybeStart reports false', t.maybeStart(fakeState()) === false);
  check('module stays inactive', t.active === false);
}

console.log('Does not activate when a campaign save exists for l1:');
{
  const t = createTutorial({ storage: fakeStorage(), hasSave: () => true });   // hasSave stub: resume prompt wins
  check('maybeStart reports false', t.maybeStart(fakeState()) === false);
  check('module stays inactive', t.active === false);
}

console.log('Does not activate off Level 1:');
{
  const t = createTutorial({ storage: fakeStorage(), hasSave: () => false });
  check('maybeStart reports false on l2', t.maybeStart(fakeState({ level: { id: 'l2' } })) === false);
}

console.log('Skip at the intro sets the flag, releases pause, and tears down:');
{
  const storage = fakeStorage();
  let paused = null;
  const t = createTutorial({ storage, hasSave: () => false, onPause: (v) => { paused = v; } });
  t.maybeStart(fakeState());
  check('the intro card pauses the game', paused === true);
  t.skip();
  check('flag set after skip', storage.getItem(FLAG_KEY) === '1');
  check('module reports inactive after skip', t.active === false);
  check('pause released after skip', paused === false);
  const modal = document.getElementById('modal');
  check('modal surface released (hidden again)', modal.classList.contains('hidden'));
  check('modal ui-state cleared', modal.dataset.uiState === undefined);
  const t2 = createTutorial({ storage, hasSave: () => false });
  check('a fresh instance also refuses once the flag is set', t2.maybeStart(fakeState()) === false);
}

console.log('Wall-built advances step 1 but tower-built does not:');
{
  const t = createTutorial({ storage: fakeStorage(), hasSave: () => false, onPause: () => {} });
  t.maybeStart(fakeState());
  t.begin();   // simulates tapping START on the intro card
  check('now on step 1 (build walls)', t.step === 1);
  t.refresh(fakeState({ towers: [towerTower()] }));
  check('a tower alone does not advance step 1', t.step === 1);
  t.refresh(fakeState({ towers: [towerTower(), wallTower()] }));
  check('a wall advances step 1 to step 2', t.step === 2);
  t.skip();   // clean up before the next block reuses the shared fake #modal
}

console.log('Full happy path: tower -> wave -> upgrade completes and sets the flag:');
{
  const storage = fakeStorage();
  const t = createTutorial({ storage, hasSave: () => false, onPause: () => {} });
  t.maybeStart(fakeState());
  t.begin();
  t.refresh(fakeState({ towers: [wallTower()] }));
  check('step 1 -> 2 on wall build', t.step === 2);
  t.refresh(fakeState({ towers: [wallTower(), towerTower()] }));
  check('step 2 -> 3 on tower build', t.step === 3);
  t.refresh(fakeState({ towers: [wallTower(), towerTower()], waveActive: true }));
  check('step 3 -> 4 on wave start', t.step === 4);
  check('flag not yet set mid-step-4', storage.getItem(FLAG_KEY) === null);
  t.refresh(fakeState({ towers: [wallTower(), towerTower(2)], waveActive: true }));   // tower upgraded to L2
  check('upgrade sets the flag immediately', storage.getItem(FLAG_KEY) === '1');
  check('module still active (DONE face shown, not yet dismissed)', t.active === true);
}

console.log('The final step also completes via its own Next/Done button:');
{
  const storage = fakeStorage();
  const t = createTutorial({ storage, hasSave: () => false, onPause: () => {} });
  t.maybeStart(fakeState());
  t.begin();
  t.refresh(fakeState({ towers: [wallTower()] }));
  t.refresh(fakeState({ towers: [wallTower(), towerTower()] }));
  t.refresh(fakeState({ towers: [wallTower(), towerTower()], waveActive: true }));
  check('reached step 4 without upgrading', t.step === 4);
  t.next();   // no upgrade happened, the Next/Done button alone finishes it
  check('flag set via the Next button', storage.getItem(FLAG_KEY) === '1');
  check('module inactive after Next', t.active === false);
}

console.log('Victory force-ends the tutorial and sets the flag:');
{
  const storage = fakeStorage();
  let paused = null;
  const t = createTutorial({ storage, hasSave: () => false, onPause: (v) => { paused = v; } });
  t.maybeStart(fakeState());
  t.begin();   // mid-tutorial, chips showing, game unpaused
  check('unpaused once chips begin', paused === false);
  t.refresh(fakeState({ status: 'won', towers: [wallTower()] }));
  check('force-ended on victory', t.active === false);
  check('flag set on victory force-end', storage.getItem(FLAG_KEY) === '1');
}

console.log('Defeat force-ends the tutorial and sets the flag:');
{
  const storage = fakeStorage();
  const t = createTutorial({ storage, hasSave: () => false, onPause: () => {} });
  t.maybeStart(fakeState());
  t.begin();
  t.refresh(fakeState({ status: 'lost' }));
  check('force-ended on defeat', t.active === false);
  check('flag set on defeat force-end', storage.getItem(FLAG_KEY) === '1');
}

console.log(fails === 0 ? 'TUTORIAL_QC_OK' : `TUTORIAL_QC_FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
