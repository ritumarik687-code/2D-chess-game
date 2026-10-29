import { Chess, Square, Move } from 'chess.js';

export type PieceStyle = 'neo_staunton' | 'alpha_minimal' | 'imperial_royal' | 'cyber_vector';
export type BoardThemeId = 'tournament_emerald' | 'classic_walnut' | 'obsidian_slate' | 'arctic_ice' | 'imperial_marble';
export type GameMode =
  | 'ai_novice'
  | 'ai_club'
  | 'ai_master'
  | 'ai_grandmaster'
  | 'pass_and_play'
  | 'multiplayer'
  | 'daily_puzzle'
  | 'chess960';

export type TimeControlId = 'bullet_1' | 'blitz_3' | 'rapid_10' | 'classical_15' | 'chess960';

export interface TimeControlConfig {
  id: TimeControlId;
  label: string;
  initialMs: number;
  incrementMs: number;
  category: string;
}

export const TIME_CONTROLS: Record<TimeControlId, TimeControlConfig> = {
  bullet_1: { id: 'bullet_1', label: '1 min · Bullet', initialMs: 60_000, incrementMs: 0, category: 'Bullet' },
  blitz_3: { id: 'blitz_3', label: '3 min · Blitz', initialMs: 180_000, incrementMs: 2_000, category: 'Blitz' },
  rapid_10: { id: 'rapid_10', label: '10 min · Rapid', initialMs: 600_000, incrementMs: 0, category: 'Rapid' },
  classical_15: { id: 'classical_15', label: '15 | 10 · Classical', initialMs: 900_000, incrementMs: 10_000, category: 'Classical' },
  chess960: { id: 'chess960', label: '10 min · Chess960', initialMs: 600_000, incrementMs: 0, category: 'Variant' },
};

export interface DailyPuzzle {
  id: string;
  title: string;
  theme: string;
  rating: number;
  fen: string;
  solutionSan: string[];
  description: string;
}

export const DAILY_PUZZLES: DailyPuzzle[] = [
  {
    id: 'puzzle-1',
    title: 'Back-Rank Opera Strike',
    theme: 'Back-Rank Mate',
    rating: 1450,
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    solutionSan: ['Re8#'],
    description: 'White to move and deliver immediate checkmate on the 8th rank.',
  },
  {
    id: 'puzzle-2',
    title: 'Philidor Smothered Finale',
    theme: 'Smothered Mate',
    rating: 1780,
    fen: '5r1k/6pp/7N/8/8/8/6PP/6K1 w - - 0 1',
    solutionSan: ['Nf7+'],
    description: 'White to move and unleash a decisive royal knight check.',
  },
  {
    id: 'puzzle-3',
    title: 'Scholar Queen Sacrifice',
    theme: 'King Hunt',
    rating: 1620,
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solutionSan: ['Qxf7#'],
    description: 'White to move and strike the vulnerable f7 square for mate.',
  },
];

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables from White's perspective (flipped for Black)
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0],
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0],
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20],
];

const KING_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20],
];

function getPstBonus(type: string, color: 'w' | 'b', row: number, col: number): number {
  const r = color === 'w' ? row : 7 - row;
  switch (type) {
    case 'p': return PAWN_PST[r][col];
    case 'n': return KNIGHT_PST[r][col];
    case 'b': return BISHOP_PST[r][col];
    case 'r': return ROOK_PST[r][col];
    case 'q': return QUEEN_PST[r][col];
    case 'k': return KING_PST[r][col];
    default: return 0;
  }
}

/**
 * Evaluates a FEN position in centipawns from White's perspective (+100 = +1.00 pawn for White).
 */
export function evaluatePosition(fen: string): number {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -9999 : 9999;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const base = PIECE_VALUES[piece.type] || 0;
      const positional = getPstBonus(piece.type, piece.color, r, c);
      if (piece.color === 'w') {
        score += base + positional;
      } else {
        score -= base + positional;
      }
    }
  }

  return score;
}

/**
 * Converts centipawn evaluation to a 0-100% bar height for White.
 */
export function evalToWhitePercentage(centipawns: number): number {
  if (centipawns >= 9000) return 98;
  if (centipawns <= -9000) return 2;
  const clamped = Math.max(-1000, Math.min(1000, centipawns));
  // Sigmoid-like mapping centered at 50%
  const pct = 50 + (clamped / 1000) * 45;
  return Math.round(Math.max(4, Math.min(96, pct)));
}

/**
 * Formats centipawns into human-readable string like "+1.4" or "M".
 */
export function formatEvalScore(centipawns: number): string {
  if (centipawns >= 9000) return '+M';
  if (centipawns <= -9000) return '-M';
  const pawns = centipawns / 100;
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
}

/**
 * Classifies a move delta (in centipawns from the mover's perspective).
 */
export type MoveClassification = 'Brilliant' | 'Best' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder';

export function classifyMoveDelta(prevEvalWhite: number, nextEvalWhite: number, moverColor: 'w' | 'b'): MoveClassification {
  const diffForMover = moverColor === 'w' ? nextEvalWhite - prevEvalWhite : prevEvalWhite - nextEvalWhite;
  if (diffForMover >= 180) return 'Brilliant';
  if (diffForMover >= -25) return 'Best';
  if (diffForMover >= -65) return 'Good';
  if (diffForMover >= -140) return 'Inaccuracy';
  if (diffForMover >= -260) return 'Mistake';
  return 'Blunder';
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const scoreA = (a.captured ? (PIECE_VALUES[a.captured] || 100) * 10 - (PIECE_VALUES[a.piece] || 100) : 0) + (a.promotion ? 800 : 0);
    const scoreB = (b.captured ? (PIECE_VALUES[b.captured] || 100) * 10 - (PIECE_VALUES[b.piece] || 100) : 0) + (b.promotion ? 800 : 0);
    return scoreB - scoreA;
  });
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingWhite: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluatePosition(chess.fen());
  }

  const legalMoves = orderMoves(chess.moves({ verbose: true }));

  if (maximizingWhite) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Selects the best move for the given difficulty mode using Minimax with Alpha-Beta Pruning.
 */
export function selectBestEngineMove(
  fen: string,
  difficulty: 'ai_novice' | 'ai_club' | 'ai_master' | 'ai_grandmaster'
): { san: string; from: Square; to: Square; evalScore: number } | null {
  const chess = new Chess(fen);
  const legalMoves = orderMoves(chess.moves({ verbose: true }));
  if (legalMoves.length === 0) return null;

  const isWhite = chess.turn() === 'w';

  // Novice plays occasional suboptimal moves with depth 1
  if (difficulty === 'ai_novice' && legalMoves.length > 1 && Math.random() < 0.35) {
    const randomMove = legalMoves[Math.floor(Math.random() * Math.min(3, legalMoves.length))];
    chess.move(randomMove);
    return {
      san: randomMove.san,
      from: randomMove.from,
      to: randomMove.to,
      evalScore: evaluatePosition(chess.fen()),
    };
  }

  const depthMap: Record<typeof difficulty, number> = {
    ai_novice: 1,
    ai_club: 2,
    ai_master: 2,
    ai_grandmaster: 3,
  };
  const searchDepth = depthMap[difficulty] || 2;

  let bestMove = legalMoves[0];
  let bestVal = isWhite ? -Infinity : Infinity;

  for (const move of legalMoves) {
    chess.move(move);
    const val = minimax(chess, searchDepth - 1, -Infinity, Infinity, !isWhite);
    chess.undo();

    if (isWhite) {
      if (val > bestVal) {
        bestVal = val;
        bestMove = move;
      }
    } else {
      if (val < bestVal) {
        bestVal = val;
        bestMove = move;
      }
    }
  }

  return {
    san: bestMove.san,
    from: bestMove.from,
    to: bestMove.to,
    evalScore: bestVal,
  };
}

/**
 * Calculates captured pieces and material advantage for White and Black.
 */
export function calculateCapturedMaterial(fen: string): {
  capturedByWhite: string[];
  capturedByBlack: string[];
  whiteAdvantage: number;
  blackAdvantage: number;
} {
  const startingCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentWhite: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const currentBlack: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  const chess = new Chess(fen);
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.type === 'k') continue;
      if (piece.color === 'w') {
        currentWhite[piece.type] = (currentWhite[piece.type] || 0) + 1;
      } else {
        currentBlack[piece.type] = (currentBlack[piece.type] || 0) + 1;
      }
    }
  }

  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  for (const type of ['q', 'r', 'b', 'n', 'p']) {
    const missingBlack = Math.max(0, startingCounts[type] - (currentBlack[type] || 0));
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(type);

    const missingWhite = Math.max(0, startingCounts[type] - (currentWhite[type] || 0));
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(type);
  }

  const matValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let whiteMat = 0;
  let blackMat = 0;
  for (const type of ['p', 'n', 'b', 'r', 'q']) {
    whiteMat += (currentWhite[type] || 0) * matValues[type];
    blackMat += (currentBlack[type] || 0) * matValues[type];
  }

  return {
    capturedByWhite,
    capturedByBlack,
    whiteAdvantage: Math.max(0, whiteMat - blackMat),
    blackAdvantage: Math.max(0, blackMat - whiteMat),
  };
}

/**
 * Generates a valid Fischer Random / Chess960 starting FEN (with standard castling flags if applicable)
 * or a deterministic valid back-rank permutation for Chess960 mode.
 */
export function generateChess960Fen(seedIndex?: number): string {
  const presets = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w - - 0 1',
    'qnnrbbkr/pppppppp/8/8/8/8/PPPPPPPP/QNNRBBKR w - - 0 1',
    'nqnrbbkr/pppppppp/8/8/8/8/PPPPPPPP/NQNRBBKR w - - 0 1',
    'rkrnnqbb/pppppppp/8/8/8/8/PPPPPPPP/RKRNNQBB w - - 0 1',
  ];
  if (typeof seedIndex === 'number') {
    return presets[Math.abs(seedIndex) % presets.length];
  }
  const idx = 1 + Math.floor(Math.random() * (presets.length - 1));
  return presets[idx];
}

/**
 * Calculates updated Elo rating after a game outcome (1 = win, 0.5 = draw, 0 = loss).
 */
export function calculateNewElo(playerElo: number, opponentElo: number, outcome: 1 | 0.5 | 0, kFactor = 32): number {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const next = Math.round(playerElo + kFactor * (outcome - expected));
  return Math.max(100, Math.min(4000, next));
}
