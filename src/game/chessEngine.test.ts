import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePosition,
  evalToWhitePercentage,
  formatEvalScore,
  classifyMoveDelta,
  selectBestEngineMove,
  calculateCapturedMaterial,
  generateChess960Fen,
  calculateNewElo,
} from './chessEngine';

test('starting position evaluates to 0 centipawns and 50% bar height', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const score = evaluatePosition(startFen);
  assert.equal(score, 0);
  assert.equal(evalToWhitePercentage(score), 50);
  assert.equal(formatEvalScore(score), '+0.0');
});

test('material advantage reflects captured pieces accurately', () => {
  // Black is missing a Queen (d8 empty)
  const whiteUpQueenFen = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const score = evaluatePosition(whiteUpQueenFen);
  assert.ok(score > 800, `Expected score > 800, got ${score}`);

  const mat = calculateCapturedMaterial(whiteUpQueenFen);
  assert.deepEqual(mat.capturedByWhite, ['q']);
  assert.equal(mat.whiteAdvantage, 9);
  assert.equal(mat.blackAdvantage, 0);
});

test('engine finds immediate checkmate in one (Opera back-rank mate)', () => {
  const mateInOneFen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
  const best = selectBestEngineMove(mateInOneFen, 'ai_master');
  assert.ok(best, 'Expected engine to return a move');
  assert.equal(best.san, 'Re8#');
});

test('move classification accurately distinguishes Best, Mistake, and Blunder', () => {
  assert.equal(classifyMoveDelta(20, 25, 'w'), 'Best');
  assert.equal(classifyMoveDelta(50, -130, 'w'), 'Mistake');
  assert.equal(classifyMoveDelta(0, -450, 'w'), 'Blunder');
  assert.equal(classifyMoveDelta(0, 300, 'w'), 'Brilliant');
});

test('Elo calculation rewards wins against higher-rated opponents', () => {
  const newElo = calculateNewElo(1200, 1400, 1);
  assert.ok(newElo > 1220, `Expected Elo gain > 20, got ${newElo - 1200}`);
  const lossElo = calculateNewElo(1200, 1200, 0);
  assert.equal(lossElo, 1184);
});

test('Chess960 generator produces valid playable FEN positions', () => {
  const fen = generateChess960Fen(1);
  assert.ok(fen.includes('/pppppppp/8/8/8/8/PPPPPPPP/'));
  const move = selectBestEngineMove(fen, 'ai_club');
  assert.ok(move !== null);
});
