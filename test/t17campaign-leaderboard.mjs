import * as board from '../src/services/campaign-leaderboard.js';

let fails = 0;
const check = (name, condition) => { if (!condition) { fails++; console.log('  FAIL', name); } else console.log('  ok  ', name); };
const store = new Map();
global.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

console.log('Campaign score calculator:');
{
  const score = board.calculateStageScore(42.9, 7);
  check('floors gold and weights lives explicitly', score.gold === 42 && score.lives === 7 && score.goldPoints === 42 && score.lifePoints === 700 && score.total === 742);
  check('clamps invalid resources to zero', board.calculateStageScore(-2, 'bad').total === 0);
}

console.log('Campaign board isolation and ordering:');
{
  board._clearCampaignScores();
  board.addStageScore('l1', 'Gold', { gold: 200, lives: 1, levelName: 'First Steps', difficulty: 'EXPERT' }, 4);
  board.addStageScore('l1', 'Lives', { gold: 1, lives: 3 }, 2);
  board.addStageScore('l2', 'Elsewhere', { gold: 999, lives: 9 }, 1);
  const l1 = board.getStageScores('l1');
  check('keeps level boards separate', l1.length === 2 && board.getStageScores('l2').length === 1);
  check('sorts by score, then lives, then gold', l1[0].name === 'Lives' && l1[1].name === 'Gold');
  check('retains stage metadata with the saved attempt', l1[1].levelName === 'First Steps' && l1[1].difficulty === 'EXPERT');
  check('does not touch Maze storage', localStorage.getItem('mazecore_maze_leaderboard_v1') === null);
}

console.log('Campaign board trim and name preference:');
{
  board._clearCampaignScores();
  for (let i = 0; i < 21; i++) board.addStageScore('l1', 'P' + i, { gold: i, lives: 0 }, i + 1);
  check('keeps the best twenty stage entries', board.getStageScores('l1').length === 20 && board.getStageScores('l1')[0].name === 'P20');
  board.setCampaignLastName('  Defender  ');
  check('stores a dedicated clean campaign name', board.getCampaignLastName() === 'Defender' && localStorage.getItem('mazecore_maze_name') === null);
}

console.log(fails ? `CAMPAIGN_LEADERBOARD_FAIL (${fails})` : 'CAMPAIGN_LEADERBOARD_OK');
if (fails) process.exitCode = 1;
