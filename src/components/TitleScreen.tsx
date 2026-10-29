import React, { useState } from 'react';
import {
  BoardThemeId,
  PieceStyle,
  GameMode,
  TimeControlId,
  TIME_CONTROLS,
} from '../game/chessEngine';
import { BOARD_THEMES, PIECE_STYLES, ChessPieceSvg } from './ChessPieceSvg';

interface TitleScreenProps {
  onStartGame: (config: {
    mode: GameMode;
    timeControl: TimeControlId;
    boardTheme: BoardThemeId;
    pieceStyle: PieceStyle;
    playerColor: 'w' | 'b';
  }) => void;
  initialBoardTheme: BoardThemeId;
  initialPieceStyle: PieceStyle;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  initialBoardTheme,
  initialPieceStyle,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('ai_club');
  const [selectedTime, setSelectedTime] = useState<TimeControlId>('rapid_10');
  const [boardTheme, setBoardTheme] = useState<BoardThemeId>(initialBoardTheme);
  const [pieceStyle, setPieceStyle] = useState<PieceStyle>(initialPieceStyle);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [hoverRotation, setHoverRotation] = useState({ x: 0, y: 0 });

  const activeTheme = BOARD_THEMES[boardTheme];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    setHoverRotation({ x: ny, y: nx });
  };

  return (
    <main
      onMouseMove={handleMouseMove}
      className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[#0D1014] px-6 py-8 text-stone-100 lg:px-14 lg:py-10"
      style={{
        backgroundImage:
          'radial-gradient(circle at 72% 42%, rgba(118, 150, 86, 0.14) 0%, rgba(15, 23, 42, 0.0) 60%)',
      }}
    >
      {/* Main Asymmetric Split Stage (Left 40% Calm Negative Space + Title Lockup, Right 60% Interactive Centerpiece & Setup) */}
      <div className="mx-auto my-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-12">
        {/* Left Column: Bespoke SVG Emblem & Primary CTA over Calm Negative Space */}
        <div className="flex flex-col items-start justify-center space-y-6 lg:col-span-5">
          {/* Custom Inline SVG Title Lockup */}
          <div className="flex items-center gap-4">
            <svg
              viewBox="0 0 64 64"
              className="h-16 w-16 shrink-0 drop-shadow-[0_6px_16px_rgba(245,158,11,0.35)]"
              aria-hidden="true"
            >
              <polygon
                points="32,4 58,18 58,46 32,60 6,46 6,18"
                fill="#181C23"
                stroke="#F59E0B"
                strokeWidth="2.5"
              />
              <path
                d="M22 46 L42 46 L40 38 C40 32 45 27 42 20 C39 14 33 17 32 23 C31 17 25 14 22 20 C19 27 24 32 24 38 Z"
                fill="#F8FAFC"
                stroke="#F59E0B"
                strokeWidth="1.8"
              />
              <path d="M32 10 L32 16 M29 13 L35 13" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                GRANDMASTER
              </h1>
              <p className="font-mono text-sm font-semibold tracking-widest text-amber-400">
                ARENA · 2D TACTICAL CHESS
              </p>
            </div>
          </div>

          <p className="max-w-md text-base leading-relaxed text-stone-300">
            Play live ranked matches, challenge adaptive engines with real-time centipawn evaluation, customize championship boards, and discover local OTB chess clubs.
          </p>

          {/* Primary Start Action (<= 3 menu actions total) */}
          <div className="flex w-full max-w-md flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartGame({
                  mode: selectedMode,
                  timeControl: selectedTime,
                  boardTheme,
                  pieceStyle,
                  playerColor,
                });
              }}
              className="flex-1 cursor-pointer rounded-xl bg-amber-500 px-7 py-4 text-center font-display text-base font-bold tracking-wide text-stone-950 shadow-[0_8px_28px_rgba(245,158,11,0.35)] transition-transform duration-150 hover:bg-amber-400 active:scale-98 whitespace-nowrap shrink-0"
            >
              Enter Arena & Play
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartGame({
                  mode: 'daily_puzzle',
                  timeControl: 'rapid_10',
                  boardTheme,
                  pieceStyle,
                  playerColor: 'w',
                });
              }}
              className="cursor-pointer rounded-xl border border-stone-700 bg-stone-900/90 px-5 py-4 font-display text-sm font-semibold text-stone-200 transition-colors hover:border-amber-400/60 hover:text-white whitespace-nowrap shrink-0"
            >
              Daily Tactical Puzzle
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Hero Board Centerpiece & Mode/Theme Selector */}
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-stone-800/90 bg-[#14181F] p-6 shadow-2xl sm:grid-cols-12 lg:col-span-7">
          {/* Interactive Live Preview Mini-Board */}
          <div className="flex flex-col items-center justify-center sm:col-span-5">
            <div
              className="aspect-square w-full max-w-[230px] rounded-xl p-2 shadow-2xl transition-transform duration-150"
              style={{
                backgroundColor: activeTheme.borderHex,
                transform: `perspective(700px) rotateX(${hoverRotation.x}deg) rotateY(${hoverRotation.y}deg)`,
              }}
            >
              <div className="grid h-full w-full grid-cols-4 grid-rows-4 overflow-hidden rounded-lg">
                {(
                  [
                    { r: 0, c: 0, p: { type: 'r', color: 'b' } },
                    { r: 0, c: 1, p: { type: 'n', color: 'b' } },
                    { r: 0, c: 2, p: { type: 'q', color: 'b' } },
                    { r: 0, c: 3, p: { type: 'k', color: 'b' } },
                    { r: 1, c: 0, p: { type: 'p', color: 'b' } },
                    { r: 1, c: 1, p: null },
                    { r: 1, c: 2, p: { type: 'p', color: 'b' } },
                    { r: 1, c: 3, p: { type: 'p', color: 'b' } },
                    { r: 2, c: 0, p: null },
                    { r: 2, c: 1, p: { type: 'n', color: 'w' } },
                    { r: 2, c: 2, p: { type: 'b', color: 'w' } },
                    { r: 2, c: 3, p: null },
                    { r: 3, c: 0, p: { type: 'r', color: 'w' } },
                    { r: 3, c: 1, p: { type: 'q', color: 'w' } },
                    { r: 3, c: 2, p: { type: 'k', color: 'w' } },
                    { r: 3, c: 3, p: { type: 'p', color: 'w' } },
                  ] as const
                ).map((cell, i) => {
                  const isLight = (cell.r + cell.c) % 2 === 0;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-center p-1"
                      style={{
                        backgroundColor: isLight ? activeTheme.lightSquare : activeTheme.darkSquare,
                      }}
                    >
                      {cell.p && (
                        <ChessPieceSvg
                          type={cell.p.type}
                          color={cell.p.color}
                          style={pieceStyle}
                          className="h-4/5 w-4/5"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 font-mono text-xs text-stone-400">
              {activeTheme.name} · {PIECE_STYLES.find((s) => s.id === pieceStyle)?.name}
            </p>
          </div>

          {/* Customization Controls */}
          <div className="flex flex-col justify-between space-y-4 sm:col-span-7">
            {/* Game Mode Selector */}
            <div>
              <label className="mb-1.5 block font-mono text-xs font-semibold text-stone-400 uppercase">
                Select Match Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'ai_novice', label: 'Bot · Novice (800)' },
                    { id: 'ai_club', label: 'Bot · Club (1450)' },
                    { id: 'ai_master', label: 'Bot · Master (2050)' },
                    { id: 'ai_grandmaster', label: 'Bot · GM (2550)' },
                    { id: 'multiplayer', label: 'Live Online Match' },
                    { id: 'pass_and_play', label: '2P Pass & Play' },
                    { id: 'chess960', label: 'Chess960 Variant' },
                    { id: 'daily_puzzle', label: 'Tactical Puzzles' },
                  ] as { id: GameMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    className={`cursor-pointer rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                      selectedMode === m.id
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                        : 'border-stone-800 bg-stone-900/70 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Control & Side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-xs font-semibold text-stone-400 uppercase">
                  Time Control
                </label>
                <select
                  aria-label="Time Control"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value as TimeControlId)}
                  className="w-full rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-2 text-xs font-medium text-stone-100 focus:border-amber-400 focus:outline-none"
                >
                  {Object.values(TIME_CONTROLS).map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-semibold text-stone-400 uppercase">
                  Play Side
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPlayerColor('w')}
                    className={`rounded-lg border py-1.5 text-xs font-semibold ${
                      playerColor === 'w'
                        ? 'border-amber-400 bg-stone-100 text-stone-950'
                        : 'border-stone-800 bg-stone-900 text-stone-400'
                    }`}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerColor('b')}
                    className={`rounded-lg border py-1.5 text-xs font-semibold ${
                      playerColor === 'b'
                        ? 'border-amber-400 bg-stone-800 text-white'
                        : 'border-stone-800 bg-stone-900 text-stone-400'
                    }`}
                  >
                    Black
                  </button>
                </div>
              </div>
            </div>

            {/* Board Theme Swatches */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-xs font-semibold text-stone-400 uppercase">
                  Board Surface
                </label>
                <div className="flex items-center gap-2">
                  {Object.values(BOARD_THEMES).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={`Board theme ${t.name}`}
                      onClick={() => setBoardTheme(t.id)}
                      className={`h-7 w-7 rounded-md border-2 transition-transform ${
                        boardTheme === t.id ? 'scale-110 border-amber-400' : 'border-stone-700'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${t.lightSquare} 50%, ${t.darkSquare} 50%)`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-xs font-semibold text-stone-400 uppercase">
                  Piece Set
                </label>
                <select
                  aria-label="Piece Style"
                  value={pieceStyle}
                  onChange={(e) => setPieceStyle(e.target.value as PieceStyle)}
                  className="w-full rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-stone-100 focus:border-amber-400 focus:outline-none"
                >
                  {PIECE_STYLES.map((ps) => (
                    <option key={ps.id} value={ps.id}>
                      {ps.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Safe Margin Flat Control-Hint Line */}
      <div className="mx-auto w-full max-w-7xl pt-4 text-center font-mono text-xs text-stone-400">
        Drag or Click Square to Move · Right-Click Drag Tactical Arrows · Arrow Keys Review History · F Flip Board · Esc Pause
      </div>
    </main>
  );
};
