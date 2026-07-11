// U4 checks — big-board render performance plumbing:
//   computeView visible-rect math (zoom 1 / no camera = null = draw everything;
//   zoom 2.5 pans clamp to the world edges), the +1-cell cull margin (the
//   margin cell is IN, the cell beyond it is OUT, both axes, both edges), the
//   static map-layer cache's rev seam (build/sell bumps state.js's maze rev,
//   wave ticks never do), and the determinism guard (a full render() pass
//   writes nothing sim-relevant into game state; back-to-back headless
//   campaign runs return identical results).
import { installFakeDom } from './fakedom.mjs';
import { readFileSync } from 'node:fs';
const { makeCtx } = installFakeDom();
const { CONFIG, TICK_DT } = await import('../src/config.js');
const { makeRng } = await import('../src/engine/rng.js');
const grid = await import('../src/engine/grid.js');
const { setGridSize, SIZE } = grid;
const { createState, canBuildAt, getMapRev } = await import('../src/game/state.js');
const { addTower, removeTower, updateTowers } = await import('../src/game/tower.js');
const { updateEnemies } = await import('../src/game/enemy.js');
const { updateProjectiles, updateEffects } = await import('../src/game/projectile.js');
const { onEnemyKilled, onEnemyLeaked, updateFloaters } = await import('../src/game/economy.js');
const { startWave, processSpawning, updateBosses } = await import('../src/game/wave.js');
const { getLevel } = await import('../src/game/levels.js');
const { towerSpriteCandidates, towerAttackCandidates } = await import('../src/ui/sprites.js');
const { Viewport } = await import('../src/ui/viewport.js');
const { render, computeView, viewHasCell } = await import('../src/ui/render.js');
const { runLevel } = await import('./campaign-sim.mjs');

let fails = 0;
const check = (n, c, e = '') => { if (!c) { fails++; console.log('  FAIL', n, e); } else console.log('  ok  ', n, e); };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const renderSource = readFileSync(new URL('../src/ui/render.js', import.meta.url), 'utf8');

console.log('Battlefield foundation: one fitted frame and one sparse route language:');
check('path tiles are not rendered', !renderSource.includes('drawPathTile') && !renderSource.includes("'tile-path'"));
check('route uses the half-density moving dash cadence', renderSource.includes('ctx.setLineDash([8, 40])') && renderSource.includes('state.time * 20'));
check('continuous frame begins with an opaque mortar bed', renderSource.includes("ctx.fillStyle = '#302b2a'") && renderSource.includes('fractional DPR rounding'));
check('boss status is no longer painted over the board', !renderSource.includes('drawBossBars'));

const fakeCanvas = (w, h) => ({
  width: 0, height: 0, style: {}, parentElement: null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
});
const box = (w, h) => ({ clientWidth: w, clientHeight: h });

console.log('Tower art lookup: level-specific sprites fall back cleanly by tier:');
{
  const c1 = towerSpriteCandidates('cannon', 1);
  const c3 = towerSpriteCandidates('cannon', 3);
  const c5 = towerSpriteCandidates('cannon', 5);
  check('level 1 prefers lv1 then base', c1[0] === 'tower-cannon-lv1' && c1[c1.length - 1] === 'tower-cannon');
  check('level 3 walks down through lower tiers', c3.join() === 'tower-cannon-lv3,tower-cannon-lv2,tower-cannon-lv1,tower-cannon');
  check('level 5 reaches the full fallback chain', c5[0] === 'tower-cannon-lv5' && c5.includes('tower-cannon-lv1') && c5[c5.length - 1] === 'tower-cannon');
  const a3 = towerAttackCandidates('cannon', 3);
  check('attack sprites mirror the same tier chain', a3.join() === 'tower-cannon-attack-lv3,tower-cannon-attack-lv2,tower-cannon-attack-lv1,tower-cannon-attack');
}

console.log('View rect: zoom 1 / no camera = null (culling short-circuits):');
{
  setGridSize(28, 44);   // 896x1408 world — the plan\'s top-end board
  const v = new Viewport(fakeCanvas(400, 629), { style: {} }, box(400, 629));
  check('no viewport -> null (headless render path)', computeView(null) === null);
  check('zoom 1 (fit-all) -> null', computeView(v) === null);
  check('null view admits every cell', viewHasCell(null, 0, 0) && viewHasCell(null, 27, 43));
}

console.log('View rect: zoom 2.5, pans clamp to the world edges:');
{
  const v = new Viewport(fakeCanvas(400, 629), { style: {} }, box(400, 629));
  v.zoomAt(CONFIG.CAMERA.MAX_ZOOM, 0, 0);   // anchor (0,0): camera stays at origin
  let view = computeView(v);
  check('window spans worldW/zoom + one margin cell each side',
    near(view.x1 - view.x0, 896 / 2.5 + 2 * SIZE), `${(view.x1 - view.x0).toFixed(1)}`);
  check('cell bounds clamp at the origin corner', view.cx0 === 0 && view.cy0 === 0);
  v.panBy(1e6, 1e6);                        // slam into the far corner
  view = computeView(v);
  check('cell bounds clamp at the far corner', view.cx1 === 27 && view.cy1 === 43);
  // camX = 896 - 358.4 = 537.6: first visible col 16, so the margin col is 15
  check('exactly one margin col survives the far-corner clamp', view.cx0 === 15, String(view.cx0));
}

console.log('Cull margin: the +1 cell is in, the cell beyond it is out:');
{
  const v = new Viewport(fakeCanvas(400, 629), { style: {} }, box(400, 629));
  v.zoomAt(CONFIG.CAMERA.MAX_ZOOM, 0, 0);
  v.panBy(2 * SIZE, 2 * SIZE);   // camera at exactly (64, 64): visible from col/row 2
  const view = computeView(v);
  check('left: margin col 1 in, col 0 out', viewHasCell(view, 1, 5) && !viewHasCell(view, 0, 5));
  check('top: margin row 1 in, row 0 out', viewHasCell(view, 10, 1) && !viewHasCell(view, 10, 0));
  // right edge: 64 + 896/2.5 = 422.4 -> last visible col 13, margin col 14
  check('right: margin col 14 in, col 15 out', viewHasCell(view, 14, 5) && !viewHasCell(view, 15, 5));
  // bottom edge: 64 + 1408/2.5 = 627.2 -> last visible row 19, margin row 20
  check('bottom: margin row 20 in, row 21 out', viewHasCell(view, 10, 20) && !viewHasCell(view, 10, 21));

  // boundary-aligned edge (zoom 2: window = 448 = exactly 14 cols): still ONE margin cell
  v.resetCamera();
  v.zoomAt(2, 0, 0);
  const vb = computeView(v);
  check('boundary-aligned right edge gets exactly one margin col',
    vb.cx1 === 14 && !viewHasCell(vb, 15, 0), String(vb.cx1));
  check('boundary-aligned bottom edge gets exactly one margin row',
    vb.cy1 === 22 && !viewHasCell(vb, 10, 23), String(vb.cy1));
}

console.log('Static-cache rev seam: build/sell bumps, wave ticks never:');
const lv = getLevel('l3');
setGridSize(lv.cols, lv.rows);
const st = createState(makeRng(1), 1, lv);
{
  // a buildable cell (open, not spawn/goal/flag/obstacle)
  let spot = null;
  for (let y = 1; y < lv.rows - 1 && !spot; y++) {
    for (let x = 1; x < lv.cols - 1 && !spot; x++) if (canBuildAt(st, x, y)) spot = { x, y };
  }
  const r0 = getMapRev();
  const t = addTower(st, 'wall', spot.x, spot.y);
  check('build bumps the rev', getMapRev() === r0 + 1, `rev ${getMapRev()}`);
  removeTower(st, t);
  check('sell bumps the rev', getMapRev() === r0 + 2, `rev ${getMapRev()}`);

  const r1 = getMapRev();
  startWave(st, 1);
  for (let i = 0; i < 60 * 30; i++) {   // 30 sim-seconds of a live wave
    st.time += TICK_DT;
    processSpawning(st, TICK_DT);
    updateBosses(st, TICK_DT);
    updateTowers(st, TICK_DT);
    updateProjectiles(st, TICK_DT);
    updateEnemies(st, TICK_DT, onEnemyKilled, onEnemyLeaked);
    updateEffects(st, TICK_DT);
    updateFloaters(st, TICK_DT);
  }
  check('30s of wave ticks do not bump the rev', getMapRev() === r1, `rev ${getMapRev()}`);
}

console.log('Determinism guard: render() writes nothing sim-relevant into state:');
{
  // digest of every field the sim reads (cosmetic-only render fields like
  // e._face are render-owned by long-standing contract and excluded)
  const digest = (s) => JSON.stringify({
    gold: s.gold, lives: s.lives, wave: s.wave, time: s.time,
    towers: s.towers.map((t) => [t.type, t.cx, t.cy, t.level, t.hp]),
    enemies: s.enemies.map((e) => [e.type, Math.round(e.x * 1e6), Math.round(e.y * 1e6), e.hp, e.alive]),
    projectiles: s.projectiles.length, effects: s.effects.length,
    cells: s.map.cells.map((r) => r.join('')).join('|'),
  });
  const before = digest(st);
  const rev = getMapRev();
  const v = new Viewport(fakeCanvas(400, 629), { style: {} }, box(400, 629));
  v.zoomAt(CONFIG.CAMERA.MAX_ZOOM, 100, 100);
  render(makeCtx(), st, v);      // culled path (zoomed camera)
  render(makeCtx(), st, null);   // uncull path (no camera)
  render(makeCtx(), st, v);      // second culled pass: cache-hit path
  check('three render passes mutate no sim state', digest(st) === before);
  check('rendering never bumps the maze rev', getMapRev() === rev);
}

console.log('Determinism guard: back-to-back headless campaign runs are identical:');
{
  const a = runLevel('l3');
  const b = runLevel('l3');
  check('two runLevel(l3) results identical', JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a));
}

setGridSize(CONFIG.GRID_COLS, CONFIG.GRID_ROWS);   // restore the classic default
console.log(fails === 0 ? 'RENDER_OK' : `RENDER_FAIL (${fails})`);
