import React, { useState } from 'react';
import {
  BoardThemeId,
  PieceStyle,
  GameMode,
  TimeControlId,
  TIME_CONTROLS,
  DAILY_PUZZLES,
  MoveClassification,
} from '../game/chessEngine';
import { BOARD_THEMES, PIECE_STYLES } from './ChessPieceSvg';

export interface MoveRecord {
  moveNumber: number;
  white?: { san: string; fen: string; evalCp: number; classification: MoveClassification; index: number };
  black?: { san: string; fen: string; evalCp: number; classification: MoveClassification; index: number };
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  titleBadge: string;
}

export interface OnlineMatchRecord {
  matchId: string;
  whiteUid: string;
  whiteName: string;
  whiteElo: number;
  blackUid: string;
  blackName: string;
  blackElo: number;
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  status: 'waiting' | 'active' | 'finished';
  winner: 'none' | 'w' | 'b' | 'draw';
  timeControl: TimeControlId;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveSan: string;
}

export interface FriendRequestRecord {
  id: string;
  fromUid: string;
  fromName: string;
  fromElo: number;
  toUid: string;
  toName: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface LobbyMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderTitle: string;
  senderElo: number;
  text: string;
  timestamp: string;
  room: string;
}

export interface CoachInsight {
  summary: string;
  candidateMove: string;
  tacticalMotif: string;
  plan: string;
}

export interface VenuePlace {
  title: string;
  uri: string;
  placeId: string;
}

interface RightCommandDockProps {
  // Game State & Controls
  gameMode: GameMode;
  timeControl: TimeControlId;
  boardTheme: BoardThemeId;
  pieceStyle: PieceStyle;
  onSelectMode: (mode: GameMode, tc: TimeControlId) => void;
  onSelectPuzzle: (puzzleId: string) => void;
  activePuzzleId: string;
  onChangeBoardTheme: (theme: BoardThemeId) => void;
  onChangePieceStyle: (style: PieceStyle) => void;
  onFlipBoard: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onNewGame: () => void;
  onRequestHint: () => void;

  // Move History & Analysis
  movePairs: MoveRecord[];
  currentHistoryIndex: number;
  totalMoves: number;
  onJumpToMove: (idx: number) => void;
  pgnString: string;
  fenString: string;
  coachInsight: CoachInsight | null;
  coachLoading: boolean;
  onAskCoach: () => void;

  // Auth & Profile
  currentUser: { uid: string; displayName: string; email: string } | null;
  userProfile: LeaderboardEntry;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onUpdateDisplayName: (newName: string) => void;

  // Multiplayer Matches
  onlineMatches: OnlineMatchRecord[];
  activeMatchId: string | null;
  onCreateOnlineMatch: (tc: TimeControlId) => void;
  onJoinOnlineMatch: (match: OnlineMatchRecord) => void;

  // Leaderboard & Friends
  leaderboard: LeaderboardEntry[];
  friendRequests: FriendRequestRecord[];
  onSendFriendRequest: (target: LeaderboardEntry) => void;
  onRespondFriendRequest: (reqId: string, status: 'accepted' | 'declined') => void;

  // Real-time Chat & Presence
  lobbyMessages: LobbyMessage[];
  matchMessages: { id: string; senderName: string; text: string }[];
  onSendLobbyMessage: (text: string) => void;
  onSendMatchMessage: (text: string) => void;
  onlinePresenceCount: number;

  // Maps Grounding Clubs Finder
  clubsQuery: string;
  setClubsQuery: (q: string) => void;
  clubsOverview: string;
  clubsPlaces: VenuePlace[];
  clubsLoading: boolean;
  onSearchClubs: (useGeolocation?: boolean) => void;
}

export const RightCommandDock: React.FC<RightCommandDockProps> = ({
  gameMode,
  timeControl,
  boardTheme,
  pieceStyle,
  onSelectMode,
  onSelectPuzzle,
  activePuzzleId,
  onChangeBoardTheme,
  onChangePieceStyle,
  onFlipBoard,
  onResign,
  onOfferDraw,
  onNewGame,
  onRequestHint,
  movePairs,
  currentHistoryIndex,
  totalMoves,
  onJumpToMove,
  pgnString,
  fenString,
  coachInsight,
  coachLoading,
  onAskCoach,
  currentUser,
  userProfile,
  onSignInGoogle,
  onSignOut,
  onUpdateDisplayName,
  onlineMatches,
  activeMatchId,
  onCreateOnlineMatch,
  onJoinOnlineMatch,
  leaderboard,
  friendRequests,
  onSendFriendRequest,
  onRespondFriendRequest,
  lobbyMessages,
  matchMessages,
  onSendLobbyMessage,
  onSendMatchMessage,
  onlinePresenceCount,
  clubsQuery,
  setClubsQuery,
  clubsOverview,
  clubsPlaces,
  clubsLoading,
  onSearchClubs,
}) => {
  const [activeTab, setActiveTab] = useState<'play' | 'analysis' | 'leaderboard' | 'social' | 'clubs'>('play');
  const [chatInput, setChatInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(userProfile.displayName);
  const [copiedFen, setCopiedFen] = useState(false);

  const getClassificationColor = (c?: MoveClassification) => {
    switch (c) {
      case 'Brilliant':
        return 'text-cyan-400';
      case 'Best':
        return 'text-emerald-400';
      case 'Good':
        return 'text-stone-300';
      case 'Inaccuracy':
        return 'text-amber-400';
      case 'Mistake':
        return 'text-orange-400';
      case 'Blunder':
        return 'text-rose-400';
      default:
        return 'text-stone-400';
    }
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-stone-800/90 bg-[#13171D] text-stone-100 shadow-2xl">
      {/* Top Segmented Navigation Strip */}
      <div
        role="tablist"
        aria-label="Arena Command Tabs"
        className="grid grid-cols-5 gap-1 border-b border-stone-800 bg-[#0E1116] p-1.5"
      >
        {(
          [
            { id: 'play', label: 'Play' },
            { id: 'analysis', label: 'Moves' },
            { id: 'leaderboard', label: 'Ranks' },
            { id: 'social', label: 'Social' },
            { id: 'clubs', label: 'Clubs' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`cursor-pointer rounded-lg py-2 text-center font-display text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: PLAY & CUSTOMIZE */}
        {activeTab === 'play' && (
          <div className="space-y-4">
            {/* Active Mode & Time Control */}
            <div>
              <h2 className="font-display text-sm font-bold text-white">Game Mode & Time Control</h2>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'ai_novice', label: 'Bot · Novice (800)' },
                    { id: 'ai_club', label: 'Bot · Club (1450)' },
                    { id: 'ai_master', label: 'Bot · Master (2050)' },
                    { id: 'ai_grandmaster', label: 'Bot · GM (2550)' },
                    { id: 'pass_and_play', label: '2P Pass & Play' },
                    { id: 'chess960', label: 'Chess960 Variant' },
                    { id: 'daily_puzzle', label: 'Daily Puzzles' },
                    { id: 'multiplayer', label: 'Live Online Match' },
                  ] as { id: GameMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMode(m.id, timeControl)}
                    className={`cursor-pointer rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                      gameMode === m.id
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                        : 'border-stone-800 bg-stone-900/70 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Control Selector */}
            <div>
              <label className="mb-1.5 block font-mono text-xs font-semibold text-stone-400">
                Clock Format
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.values(TIME_CONTROLS).map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => onSelectMode(gameMode, tc.id)}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-left font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      timeControl === tc.id
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                        : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Puzzles Sub-Panel when in Daily Puzzle Mode */}
            {gameMode === 'daily_puzzle' && (
              <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3 space-y-2">
                <div className="font-display text-xs font-bold text-amber-400">
                  Select Tactical Puzzle Challenge
                </div>
                <div className="space-y-1.5">
                  {DAILY_PUZZLES.map((pz) => (
                    <button
                      key={pz.id}
                      type="button"
                      onClick={() => onSelectPuzzle(pz.id)}
                      className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${
                        activePuzzleId === pz.id
                          ? 'border-amber-400 bg-amber-500/15 text-white'
                          : 'border-stone-800 bg-stone-950/60 text-stone-300 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{pz.title}</span>
                        <span className="font-mono text-amber-400">Rating {pz.rating}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone-400">{pz.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Real-time Firebase Multiplayer Lobby when in Multiplayer Mode */}
            {gameMode === 'multiplayer' && (
              <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold text-white">
                    Firebase Real-Time Match Lobby
                  </span>
                  <button
                    type="button"
                    onClick={() => onCreateOnlineMatch(timeControl)}
                    className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1 font-display text-xs font-bold text-stone-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
                  >
                    + Create Open Table
                  </button>
                </div>
                {!currentUser && (
                  <p className="text-xs text-amber-300">
                    Sign in with Google below to host or join live Firebase-synced matches.
                  </p>
                )}
                <div className="max-h-36 overflow-y-auto space-y-1.5">
                  {onlineMatches.length === 0 ? (
                    <p className="py-2 text-center text-xs text-stone-400">
                      No open tables right now. Click "+ Create Open Table" to host one!
                    </p>
                  ) : (
                    onlineMatches.map((m) => (
                      <div
                        key={m.matchId}
                        className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-950/80 px-2.5 py-2 text-xs"
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold text-white">{m.whiteName}</span>
                          <span className="font-mono text-stone-400"> ({m.whiteElo}) · {m.status}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onJoinOnlineMatch(m)}
                          className="cursor-pointer rounded-md bg-amber-500/20 px-2.5 py-1 font-semibold text-amber-300 hover:bg-amber-500/30 whitespace-nowrap shrink-0"
                        >
                          {activeMatchId === m.matchId ? 'Active' : m.status === 'waiting' ? 'Join' : 'Watch'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Board & Piece Customization */}
            <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-3">
              <div className="font-display text-xs font-bold text-stone-200">
                Board Surface & Piece Architecture
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Object.values(BOARD_THEMES).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={`Select board ${t.name}`}
                    onClick={() => onChangeBoardTheme(t.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                      boardTheme === t.id
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-stone-800 bg-stone-950/50 hover:border-stone-700'
                    }`}
                  >
                    <span
                      className="h-6 w-6 rounded border border-stone-700"
                      style={{
                        background: `linear-gradient(135deg, ${t.lightSquare} 50%, ${t.darkSquare} 50%)`,
                      }}
                    />
                    <span className="w-full truncate text-center text-[10px] text-stone-300">
                      {t.name.split(' ')[1] || t.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {PIECE_STYLES.map((ps) => (
                  <button
                    key={ps.id}
                    type="button"
                    onClick={() => onChangePieceStyle(ps.id)}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                      pieceStyle === ps.id
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                        : 'border-stone-800 bg-stone-950/60 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    {ps.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={onNewGame}
                className="cursor-pointer rounded-xl bg-amber-500 py-2.5 font-display text-xs font-bold text-stone-950 hover:bg-amber-400 whitespace-nowrap shrink-0"
              >
                New Match
              </button>
              <button
                type="button"
                onClick={onRequestHint}
                className="cursor-pointer rounded-xl border border-emerald-500/50 bg-emerald-500/15 py-2.5 font-display text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 whitespace-nowrap shrink-0"
              >
                Engine Best Move Hint
              </button>
              <button
                type="button"
                onClick={onFlipBoard}
                className="cursor-pointer rounded-xl border border-stone-700 bg-stone-900 py-2 font-display text-xs font-semibold text-stone-200 hover:border-stone-600 whitespace-nowrap shrink-0"
              >
                Flip Board (F)
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onOfferDraw}
                  className="cursor-pointer rounded-xl border border-stone-700 bg-stone-900 py-2 font-display text-xs font-semibold text-stone-300 hover:border-stone-600 whitespace-nowrap shrink-0"
                >
                  Draw
                </button>
                <button
                  type="button"
                  onClick={onResign}
                  className="cursor-pointer rounded-xl border border-rose-500/40 bg-rose-500/15 py-2 font-display text-xs font-semibold text-rose-300 hover:bg-rose-500/25 whitespace-nowrap shrink-0"
                >
                  Resign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MOVE HISTORY, ENGINE EVALUATION & AI COACH */}
        {activeTab === 'analysis' && (
          <div className="flex h-full flex-col space-y-3">
            {/* Step-through History Controls */}
            <div className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-900 px-3 py-2">
              <span className="font-display text-xs font-bold text-stone-300">
                Move Explorer ({currentHistoryIndex}/{totalMoves})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="First move"
                  onClick={() => onJumpToMove(0)}
                  disabled={currentHistoryIndex === 0}
                  className="rounded border border-stone-700 bg-stone-800 px-2 py-1 font-mono text-xs text-stone-200 disabled:opacity-40"
                >
                  |&lt;
                </button>
                <button
                  type="button"
                  aria-label="Previous move"
                  onClick={() => onJumpToMove(Math.max(0, currentHistoryIndex - 1))}
                  disabled={currentHistoryIndex === 0}
                  className="rounded border border-stone-700 bg-stone-800 px-2.5 py-1 font-mono text-xs text-stone-200 disabled:opacity-40"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  aria-label="Next move"
                  onClick={() => onJumpToMove(Math.min(totalMoves, currentHistoryIndex + 1))}
                  disabled={currentHistoryIndex >= totalMoves}
                  className="rounded border border-stone-700 bg-stone-800 px-2.5 py-1 font-mono text-xs text-stone-200 disabled:opacity-40"
                >
                  &gt;
                </button>
                <button
                  type="button"
                  aria-label="Latest move"
                  onClick={() => onJumpToMove(totalMoves)}
                  disabled={currentHistoryIndex >= totalMoves}
                  className="rounded border border-stone-700 bg-stone-800 px-2 py-1 font-mono text-xs text-stone-200 disabled:opacity-40"
                >
                  &gt;|
                </button>
              </div>
            </div>

            {/* Algebraic Move Table */}
            <div className="max-h-48 min-h-[140px] overflow-y-auto rounded-xl border border-stone-800 bg-stone-950/80 p-2 font-mono text-xs tabular-nums">
              {movePairs.length === 0 ? (
                <div className="flex h-28 items-center justify-center text-stone-500">
                  Make a move on the board to begin algebraic recording.
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-800 text-[11px] text-stone-500">
                      <th className="py-1 pl-2 w-10">#</th>
                      <th className="py-1">White</th>
                      <th className="py-1">Black</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movePairs.map((pair) => (
                      <tr key={pair.moveNumber} className="border-b border-stone-900/80">
                        <td className="py-1.5 pl-2 text-stone-500">{pair.moveNumber}.</td>
                        <td className="py-1">
                          {pair.white && (
                            <button
                              type="button"
                              onClick={() => onJumpToMove(pair.white!.index)}
                              className={`rounded px-2 py-0.5 text-left transition-colors ${
                                currentHistoryIndex === pair.white.index
                                  ? 'bg-amber-500/25 font-bold text-amber-300'
                                  : 'text-stone-200 hover:bg-stone-800'
                              }`}
                            >
                              <span>{pair.white.san}</span>
                              <span className={`ml-1.5 text-[10px] ${getClassificationColor(pair.white.classification)}`}>
                                · {pair.white.classification}
                              </span>
                            </button>
                          )}
                        </td>
                        <td className="py-1">
                          {pair.black && (
                            <button
                              type="button"
                              onClick={() => onJumpToMove(pair.black!.index)}
                              className={`rounded px-2 py-0.5 text-left transition-colors ${
                                currentHistoryIndex === pair.black.index
                                  ? 'bg-amber-500/25 font-bold text-amber-300'
                                  : 'text-stone-200 hover:bg-stone-800'
                              }`}
                            >
                              <span>{pair.black.san}</span>
                              <span className={`ml-1.5 text-[10px] ${getClassificationColor(pair.black.classification)}`}>
                                · {pair.black.classification}
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Instant Low-Latency Gemini 3.1 Flash-Lite Grandmaster Coach */}
            <div className="rounded-xl border border-stone-800 bg-stone-900/90 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold text-amber-400">
                  Instant GM Coach Analysis
                </span>
                <button
                  type="button"
                  onClick={onAskCoach}
                  disabled={coachLoading}
                  className="cursor-pointer rounded-lg bg-amber-500 px-3 py-1 font-display text-xs font-bold text-stone-950 hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {coachLoading ? 'Analyzing...' : 'Analyze Position'}
                </button>
              </div>
              {coachInsight ? (
                <div className="space-y-1.5 text-xs text-stone-200">
                  <p className="leading-relaxed">{coachInsight.summary}</p>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-emerald-300">
                    <span>Candidate: {coachInsight.candidateMove}</span>
                    <span>·</span>
                    <span>Motif: {coachInsight.tacticalMotif}</span>
                  </div>
                  <p className="text-[11px] text-stone-400">Plan: {coachInsight.plan}</p>
                </div>
              ) : (
                <p className="text-xs text-stone-400">
                  Request an instant tactical & positional evaluation of the current board state.
                </p>
              )}
            </div>

            {/* FEN & PGN Export */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span className="font-mono">Position FEN</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(fenString);
                    setCopiedFen(true);
                    setTimeout(() => setCopiedFen(false), 1500);
                  }}
                  className="cursor-pointer font-mono text-amber-400 hover:underline"
                >
                  {copiedFen ? 'Copied!' : 'Copy FEN'}
                </button>
              </div>
              <input
                type="text"
                readOnly
                aria-label="Current FEN string"
                value={fenString}
                className="w-full rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 font-mono text-[11px] text-stone-300"
              />
              {pgnString && (
                <div className="rounded-lg border border-stone-800 bg-stone-950 p-2 font-mono text-[11px] text-stone-400 max-h-20 overflow-y-auto">
                  {pgnString}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GLOBAL LEADERBOARD & PERSISTENT USER PROFILE */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* Persistent Profile Card */}
            <div className="rounded-xl border border-stone-800 bg-stone-900/90 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {userProfile.titleBadge}
                    </span>
                    {editingName ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (nameDraft.trim()) {
                            onUpdateDisplayName(nameDraft.trim());
                            setEditingName(false);
                          }
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="text"
                          aria-label="Edit display name"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          maxLength={40}
                          className="w-32 rounded border border-stone-700 bg-stone-950 px-2 py-0.5 text-xs text-white"
                        />
                        <button
                          type="submit"
                          className="rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-stone-950"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <span className="font-display text-sm font-bold text-white">
                        {userProfile.displayName}
                      </span>
                    )}
                    {!editingName && (
                      <button
                        type="button"
                        onClick={() => {
                          setNameDraft(userProfile.displayName);
                          setEditingName(true);
                        }}
                        className="text-[11px] text-stone-400 hover:text-amber-400"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="font-mono text-xs text-stone-400 tabular-nums">
                    Rating: {userProfile.elo} · {userProfile.wins}W / {userProfile.losses}L / {userProfile.draws}D
                  </p>
                </div>

                {currentUser ? (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="cursor-pointer rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-stone-700 whitespace-nowrap shrink-0"
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="cursor-pointer rounded-lg bg-amber-500 px-3 py-1.5 font-display text-xs font-bold text-stone-950 hover:bg-amber-400 whitespace-nowrap shrink-0"
                  >
                    Google Sign-In
                  </button>
                )}
              </div>
            </div>

            {/* Global Standings Table */}
            <div>
              <h3 className="mb-2 font-display text-xs font-bold tracking-wider text-stone-300 uppercase">
                Global Arena Standings
              </h3>
              <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-950/80">
                <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-stone-800 text-[11px] text-stone-400">
                      <th className="py-2 pl-3">#</th>
                      <th className="py-2">Player</th>
                      <th className="py-2 text-right">Elo</th>
                      <th className="py-2 pr-3 text-right">W/L/D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, idx) => (
                      <tr
                        key={entry.uid}
                        className="border-b border-stone-900/80 hover:bg-stone-900/50"
                      >
                        <td className="py-2 pl-3 font-bold text-amber-400">{idx + 1}</td>
                        <td className="py-2 font-sans">
                          <span className="font-mono text-[11px] font-bold text-amber-400 mr-1.5">
                            {entry.titleBadge}
                          </span>
                          <span className="font-semibold text-stone-100">{entry.displayName}</span>
                        </td>
                        <td className="py-2 text-right font-bold text-emerald-400">{entry.elo}</td>
                        <td className="py-2 pr-3 text-right text-stone-400">
                          {entry.wins}/{entry.losses}/{entry.draws}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOCIAL HUB, FRIEND REQUESTS & LIVE LOBBY/MATCH CHAT */}
        {activeTab === 'social' && (
          <div className="flex h-full flex-col space-y-3">
            {/* Friend Requests & Directory */}
            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold text-white">
                  Friends & Challenges ({onlinePresenceCount} Online)
                </span>
              </div>

              {friendRequests.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {friendRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs"
                    >
                      <span>
                        <strong className="text-white">{req.fromName}</strong> →{' '}
                        <strong className="text-stone-300">{req.toName}</strong> ·{' '}
                        <span className="font-mono text-amber-400">{req.status}</span>
                      </span>
                      {currentUser && req.toUid === currentUser.uid && req.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onRespondFriendRequest(req.id, 'accepted')}
                            className="rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-stone-950"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => onRespondFriendRequest(req.id, 'declined')}
                            className="rounded bg-stone-800 px-2 py-0.5 text-[11px] text-stone-300"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Add Friend from Leaderboard */}
              <div className="pt-1">
                <div className="mb-1 text-[11px] text-stone-400">Connect with Active Players:</div>
                <div className="flex flex-wrap gap-1.5">
                  {leaderboard.slice(0, 4).map((p) => (
                    <button
                      key={p.uid}
                      type="button"
                      onClick={() => onSendFriendRequest(p)}
                      className="cursor-pointer rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1 text-xs text-stone-200 hover:border-amber-400 whitespace-nowrap shrink-0"
                    >
                      + Add {p.displayName}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Chat Stream (Global WebSocket + Match Chat) */}
            <div className="flex flex-1 flex-col rounded-xl border border-stone-800 bg-stone-950/90 p-3">
              <div className="mb-2 flex items-center justify-between border-b border-stone-800 pb-1.5">
                <span className="font-display text-xs font-bold text-stone-200">
                  {activeMatchId ? 'Live Match & Arena Chat' : 'Global Grandmaster Chat'}
                </span>
                <span className="font-mono text-[11px] text-emerald-400">Live Socket</span>
              </div>

              <div className="max-h-48 flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {lobbyMessages.map((msg) => (
                  <div key={msg.id} className="leading-snug">
                    <span className="font-mono text-[11px] font-bold text-amber-400">
                      {msg.senderTitle}
                    </span>{' '}
                    <span className="font-semibold text-white">{msg.senderName}</span>{' '}
                    <span className="font-mono text-[10px] text-stone-500">({msg.senderElo})</span>:{' '}
                    <span className="text-stone-300">{msg.text}</span>
                  </div>
                ))}
                {matchMessages.map((m) => (
                  <div key={m.id} className="leading-snug text-emerald-300">
                    <span className="font-semibold">[Match] {m.senderName}:</span> {m.text}
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatInput.trim()) return;
                  if (activeMatchId) {
                    onSendMatchMessage(chatInput.trim());
                  } else {
                    onSendLobbyMessage(chatInput.trim());
                  }
                  setChatInput('');
                }}
                className="mt-2 flex items-center gap-1.5 pt-2 border-t border-stone-800"
              >
                <input
                  type="text"
                  aria-label="Chat message"
                  placeholder="Send message to arena..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={240}
                  className="flex-1 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-amber-500 px-3 py-1.5 font-display text-xs font-bold text-stone-950 hover:bg-amber-400 whitespace-nowrap shrink-0"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: OTB CHESS CLUBS & TOURNAMENT VENUES (GOOGLE MAPS GROUNDING) */}
        {activeTab === 'clubs' && (
          <div className="space-y-3">
            <div>
              <h3 className="font-display text-sm font-bold text-white">
                OTB Chess Clubs & Park Tables Finder
              </h3>
              <p className="text-xs text-stone-400">
                Discover real-world chess clubs, tournament halls, and park tables grounded with Google Maps data.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchClubs(false);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                aria-label="City or region for chess clubs"
                placeholder="Enter city (e.g., New York, London, Tokyo)"
                value={clubsQuery}
                onChange={(e) => setClubsQuery(e.target.value)}
                className="flex-1 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-xs text-white placeholder-stone-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={clubsLoading}
                className="cursor-pointer rounded-lg bg-amber-500 px-3 py-2 font-display text-xs font-bold text-stone-950 hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {clubsLoading ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                aria-label="Find chess clubs near my location"
                onClick={() => onSearchClubs(true)}
                disabled={clubsLoading}
                className="cursor-pointer rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-2 text-xs font-semibold text-stone-200 hover:border-amber-400 whitespace-nowrap shrink-0"
              >
                Near Me
              </button>
            </form>

            {clubsOverview && (
              <div className="rounded-xl border border-stone-800 bg-stone-950/90 p-3 text-xs leading-relaxed text-stone-300 max-h-48 overflow-y-auto">
                {clubsOverview}
              </div>
            )}

            {clubsPlaces.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-mono text-[11px] font-semibold text-amber-400 uppercase">
                  Verified Google Maps Venues
                </div>
                {clubsPlaces.map((pl, idx) => (
                  <a
                    key={`${pl.placeId}-${idx}`}
                    href={pl.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900/90 px-3 py-2 text-xs font-semibold text-stone-100 transition-colors hover:border-amber-400/70"
                  >
                    <span className="truncate pr-2">{pl.title}</span>
                    <span className="font-mono text-[11px] text-amber-400 shrink-0">
                      Open Map ↗
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
