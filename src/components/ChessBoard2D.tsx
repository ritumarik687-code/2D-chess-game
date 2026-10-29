import React, { useState, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { BoardThemeId, PieceStyle } from '../game/chessEngine';
import { BOARD_THEMES, ChessPieceSvg } from './ChessPieceSvg';

export interface TacticalArrow {
  from: Square;
  to: Square;
  color: string;
}

interface ChessBoard2DProps {
  fen: string;
  flipped: boolean;
  boardTheme: BoardThemeId;
  pieceStyle: PieceStyle;
  lastMove: { from: Square; to: Square } | null;
  hintMove: { from: Square; to: Square } | null;
  onMove: (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  disabled?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const ChessBoard2D: React.FC<ChessBoard2DProps> = ({
  fen,
  flipped,
  boardTheme,
  pieceStyle,
  lastMove,
  hintMove,
  onMove,
  disabled = false,
}) => {
  const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.tournament_emerald;
  const chess = new Chess(fen);
  const board = chess.board();
  const inCheck = chess.inCheck();
  const turnColor = chess.turn();

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<{ to: Square; isCapture: boolean; isPromotion: boolean }[]>([]);
  const [draggedFrom, setDraggedFrom] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: 'w' | 'b' } | null>(null);
  const [arrows, setArrows] = useState<TacticalArrow[]>([]);
  const [markedSquares, setMarkedSquares] = useState<Set<Square>>(new Set());

  const rightClickStartRef = useRef<Square | null>(null);

  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;

  const computeLegalMovesForSquare = (sq: Square) => {
    try {
      const moves = chess.moves({ square: sq, verbose: true });
      return moves.map((m) => ({
        to: m.to as Square,
        isCapture: Boolean(m.captured),
        isPromotion: Boolean(m.promotion),
      }));
    } catch {
      return [];
    }
  };

  const handleSquareSelect = (sq: Square) => {
    if (disabled) return;
    // Clear tactical annotations on left click
    if (arrows.length > 0 || markedSquares.size > 0) {
      setArrows([]);
      setMarkedSquares(new Set());
    }

    // Check if clicking a legal target square from currently selected piece
    if (selectedSquare) {
      const targetMatch = legalTargets.find((t) => t.to === sq);
      if (targetMatch) {
        if (targetMatch.isPromotion) {
          setPendingPromotion({ from: selectedSquare, to: sq, color: turnColor });
        } else {
          onMove(selectedSquare, sq);
        }
        setSelectedSquare(null);
        setLegalTargets([]);
        return;
      }
    }

    const piece = chess.get(sq);
    if (piece && piece.color === turnColor) {
      setSelectedSquare(sq);
      setLegalTargets(computeLegalMovesForSquare(sq));
    } else {
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  const handleDragStart = (e: React.DragEvent, sq: Square) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    const piece = chess.get(sq);
    if (!piece || piece.color !== turnColor) {
      e.preventDefault();
      return;
    }
    setDraggedFrom(sq);
    setSelectedSquare(sq);
    setLegalTargets(computeLegalMovesForSquare(sq));
    e.dataTransfer.setData('text/plain', sq);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetSq: Square) => {
    e.preventDefault();
    const fromSq = (draggedFrom || e.dataTransfer.getData('text/plain')) as Square;
    setDraggedFrom(null);

    if (!fromSq || fromSq === targetSq || disabled) return;

    const moves = computeLegalMovesForSquare(fromSq);
    const match = moves.find((m) => m.to === targetSq);
    if (match) {
      if (match.isPromotion) {
        setPendingPromotion({ from: fromSq, to: targetSq, color: turnColor });
      } else {
        onMove(fromSq, targetSq);
      }
      setSelectedSquare(null);
      setLegalTargets([]);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleMouseDown = (e: React.MouseEvent, sq: Square) => {
    if (e.button === 2) {
      rightClickStartRef.current = sq;
    }
  };

  const handleMouseUp = (e: React.MouseEvent, sq: Square) => {
    if (e.button === 2 && rightClickStartRef.current) {
      const startSq = rightClickStartRef.current;
      rightClickStartRef.current = null;
      if (startSq === sq) {
        setMarkedSquares((prev) => {
          const next = new Set(prev);
          if (next.has(sq)) next.delete(sq);
          else next.add(sq);
          return next;
        });
      } else {
        setArrows((prev) => {
          const exists = prev.some((a) => a.from === startSq && a.to === sq);
          if (exists) return prev.filter((a) => !(a.from === startSq && a.to === sq));
          return [...prev, { from: startSq, to: sq, color: 'rgba(245, 158, 11, 0.85)' }];
        });
      }
    }
  };

  const squareToCenterCoords = (sq: Square): { x: number; y: number } => {
    const fileIdx = FILES.indexOf(sq[0]);
    const rankIdx = RANKS.indexOf(sq[1]);
    const col = flipped ? 7 - fileIdx : fileIdx;
    const row = flipped ? 7 - rankIdx : rankIdx;
    return {
      x: col * 12.5 + 6.25,
      y: row * 12.5 + 6.25,
    };
  };

  return (
    <div
      data-testid="chess-board-container"
      onContextMenu={handleContextMenu}
      className="relative aspect-square w-full max-w-[min(64vh,64vw)] sm:max-w-[min(68vh,68vw)] select-none rounded-xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.65)] transition-colors duration-200"
      style={{ backgroundColor: theme.borderHex }}
    >
      <div className="relative grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-lg">
        {displayRanks.map((rank, rIdx) =>
          displayFiles.map((file, fIdx) => {
            const sq = `${file}${rank}` as Square;
            const origRow = RANKS.indexOf(rank);
            const origCol = FILES.indexOf(file);
            const isLight = (origRow + origCol) % 2 === 0;
            const piece = board[origRow][origCol];

            const isSelected = selectedSquare === sq;
            const isLastMove = lastMove?.from === sq || lastMove?.to === sq;
            const isHint = hintMove?.from === sq || hintMove?.to === sq;
            const isMarked = markedSquares.has(sq);
            const legalTarget = legalTargets.find((t) => t.to === sq);
            const isKingInCheck = inCheck && piece?.type === 'k' && piece?.color === turnColor;

            const showRankLabel = fIdx === 0;
            const showFileLabel = rIdx === 7;

            let bgStyle = isLight ? theme.lightSquare : theme.darkSquare;
            if (isSelected || isLastMove) {
              bgStyle = theme.highlightMove;
            }

            return (
              <button
                key={sq}
                type="button"
                aria-label={`Square ${sq}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type.toUpperCase()}` : ''}`}
                data-square={sq}
                onClick={() => handleSquareSelect(sq)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, sq)}
                onMouseDown={(e) => handleMouseDown(e, sq)}
                onMouseUp={(e) => handleMouseUp(e, sq)}
                className="relative flex items-center justify-center p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                style={{
                  backgroundColor: isLight ? theme.lightSquare : theme.darkSquare,
                }}
              >
                {/* Last move / selected highlight overlay */}
                {(isSelected || isLastMove) && (
                  <span
                    className="pointer-events-none absolute inset-0"
                    style={{ backgroundColor: theme.highlightMove }}
                  />
                )}

                {/* Hint square pulse */}
                {isHint && (
                  <span className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-emerald-400/80" />
                )}

                {/* Right-click tactical mark */}
                {isMarked && (
                  <span className="pointer-events-none absolute inset-0 bg-rose-500/45" />
                )}

                {/* King in check crimson radial alert */}
                {isKingInCheck && (
                  <span
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: 'radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(220,38,38,0.4) 65%, transparent 100%)',
                    }}
                  />
                )}

                {/* Coordinate Labels */}
                {showRankLabel && (
                  <span
                    className="pointer-events-none absolute top-0.5 left-1 font-mono text-[10px] font-bold leading-none sm:text-[11px]"
                    style={{ color: isLight ? theme.coordLight : theme.coordDark }}
                  >
                    {rank}
                  </span>
                )}
                {showFileLabel && (
                  <span
                    className="pointer-events-none absolute right-1 bottom-0.5 font-mono text-[10px] font-bold leading-none sm:text-[11px]"
                    style={{ color: isLight ? theme.coordLight : theme.coordDark }}
                  >
                    {file}
                  </span>
                )}

                {/* Legal move target indicator */}
                {legalTarget && !legalTarget.isCapture && (
                  <span
                    className="pointer-events-none z-10 h-3.5 w-3.5 rounded-full transition-transform duration-150"
                    style={{ backgroundColor: theme.highlightLegal }}
                  />
                )}
                {legalTarget && legalTarget.isCapture && (
                  <span
                    className="pointer-events-none absolute inset-1 z-10 rounded-full border-[4px]"
                    style={{ borderColor: theme.highlightLegal }}
                  />
                )}

                {/* Piece SVG */}
                {piece && (
                  <div
                    draggable={!disabled && piece.color === turnColor}
                    onDragStart={(e) => handleDragStart(e, sq)}
                    className={`z-10 h-[84%] w-[84%] transition-transform duration-150 ${
                      !disabled && piece.color === turnColor ? 'cursor-grab active:scale-110 active:cursor-grabbing' : 'cursor-pointer'
                    }`}
                  >
                    <ChessPieceSvg type={piece.type} color={piece.color} style={pieceStyle} />
                  </div>
                )}
              </button>
            );
          })
        )}

        {/* SVG Tactical Arrows Overlay */}
        {(arrows.length > 0 || hintMove) && (
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full"
          >
            <defs>
              <marker
                id="arrowhead-amber"
                markerWidth="4.5"
                markerHeight="4.5"
                refX="2.8"
                refY="2.25"
                orient="auto"
              >
                <polygon points="0 0, 4.5 2.25, 0 4.5" fill="rgba(245, 158, 11, 0.9)" />
              </marker>
              <marker
                id="arrowhead-emerald"
                markerWidth="4.5"
                markerHeight="4.5"
                refX="2.8"
                refY="2.25"
                orient="auto"
              >
                <polygon points="0 0, 4.5 2.25, 0 4.5" fill="rgba(16, 185, 129, 0.95)" />
              </marker>
            </defs>
            {arrows.map((arrow, i) => {
              const start = squareToCenterCoords(arrow.from);
              const end = squareToCenterCoords(arrow.to);
              return (
                <line
                  key={`${arrow.from}-${arrow.to}-${i}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="rgba(245, 158, 11, 0.85)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead-amber)"
                />
              );
            })}
            {hintMove && (() => {
              const start = squareToCenterCoords(hintMove.from);
              const end = squareToCenterCoords(hintMove.to);
              return (
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="rgba(16, 185, 129, 0.92)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead-emerald)"
                />
              );
            })()}
          </svg>
        )}
      </div>

      {/* Pawn Promotion Selector Modal */}
      {pendingPromotion && (
        <div
          role="dialog"
          aria-label="Choose promotion piece"
          className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-black/75 p-4"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-stone-700 bg-stone-900 p-4 shadow-2xl">
            <span className="font-display text-xs font-semibold tracking-wider text-stone-300 uppercase">
              Promote Pawn To
            </span>
            <div className="flex items-center gap-3">
              {(['q', 'r', 'b', 'n'] as const).map((pType) => (
                <button
                  key={pType}
                  type="button"
                  aria-label={`Promote to ${pType.toUpperCase()}`}
                  onClick={() => {
                    onMove(pendingPromotion.from, pendingPromotion.to, pType);
                    setPendingPromotion(null);
                  }}
                  className="h-14 w-14 rounded-lg border border-stone-700 bg-stone-800 p-2 transition-transform hover:scale-105 hover:border-amber-400"
                >
                  <ChessPieceSvg type={pType} color={pendingPromotion.color} style={pieceStyle} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
