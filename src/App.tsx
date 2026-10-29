/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  auth,
  googleProvider,
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
} from './lib/firebase';
import {
  BoardThemeId,
  PieceStyle,
  GameMode,
  TimeControlId,
  TIME_CONTROLS,
  DAILY_PUZZLES,
  evaluatePosition,
  evalToWhitePercentage,
  formatEvalScore,
  classifyMoveDelta,
  selectBestEngineMove,
  calculateCapturedMaterial,
  generateChess960Fen,
  calculateNewElo,
} from './game/chessEngine';
import { soundEngine } from './game/sound';
import { ChessPieceSvg } from './components/ChessPieceSvg';
import { ChessBoard2D } from './components/ChessBoard2D';
import { TitleScreen } from './components/TitleScreen';
import {
  RightCommandDock,
  MoveRecord,
  LeaderboardEntry,
  OnlineMatchRecord,
  FriendRequestRecord,
  LobbyMessage,
  CoachInsight,
  VenuePlace,
} from './components/RightCommandDock';

type ShellState = 'title' | 'playing' | 'paused' | 'gameover';

interface HistorySnap {
  fen: string;
  san: string;
  from: Square;
  to: Square;
  evalCp: number;
  classification: ReturnType<typeof classifyMoveDelta>;
  moverColor: 'w' | 'b';
}

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    uid: 'gm-magnus-v',
    displayName: 'Magnus_V',
    elo: 2840,
    wins: 412,
    losses: 38,
    draws: 95,
    gamesPlayed: 545,
    titleBadge: 'GM',
  },
  {
    uid: 'gm-hikaru-n',
    displayName: 'HikaruSpeed',
    elo: 2795,
    wins: 620,
    losses: 74,
    draws: 88,
    gamesPlayed: 782,
    titleBadge: 'GM',
  },
  {
    uid: 'im-elena-k',
    displayName: 'ElenaK_Chess',
    elo: 2465,
    wins: 215,
    losses: 64,
    draws: 42,
    gamesPlayed: 321,
    titleBadge: 'IM',
  },
  {
    uid: 'fm-arjun-t',
    displayName: 'ArjunTactics',
    elo: 2310,
    wins: 184,
    losses: 79,
    draws: 31,
    gamesPlayed: 294,
    titleBadge: 'FM',
  },
  {
    uid: 'cm-sofia-r',
    displayName: 'SofiaEndgame',
    elo: 2140,
    wins: 132,
    losses: 68,
    draws: 29,
    gamesPlayed: 229,
    titleBadge: 'CM',
  },
];

function formatClockMs(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function App() {
  // Check ?autostart=1 for instant gameplay launch
  const initialShellState = (): ShellState => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  };

  const [shellState, setShellState] = useState<ShellState>(initialShellState);
  const [gameMode, setGameMode] = useState<GameMode>('ai_club');
  const [timeControl, setTimeControl] = useState<TimeControlId>('rapid_10');
  const [boardTheme, setBoardTheme] = useState<BoardThemeId>('tournament_emerald');
  const [pieceStyle, setPieceStyle] = useState<PieceStyle>('neo_staunton');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [flipped, setFlipped] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Chess Game State
  const [startingFen, setStartingFen] = useState<string>(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  );
  const [history, setHistory] = useState<HistorySnap[]>([]);
  const [viewIndex, setViewIndex] = useState<number>(0); // 0 = startingFen, N = history[N-1]
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [activePuzzleId, setActivePuzzleId] = useState<string>(DAILY_PUZZLES[0].id);
  const [puzzleBanner, setPuzzleBanner] = useState<string | null>(null);

  // Clocks
  const [whiteTimeMs, setWhiteTimeMs] = useState<number>(TIME_CONTROLS.rapid_10.initialMs);
  const [blackTimeMs, setBlackTimeMs] = useState<number>(TIME_CONTROLS.rapid_10.initialMs);

  // End-of-Run Frozen Modal Snapshot
  const [gameOverSnapshot, setGameOverSnapshot] = useState<{
    outcomeTitle: string;
    outcomeSubtitle: string;
    winner: 'w' | 'b' | 'draw';
    totalMoves: number;
    accuracyPct: number;
    newElo: number;
    eloDelta: number;
  } | null>(null);

  // Auth & Persistent User Profile
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    displayName: string;
    email: string;
  } | null>(null);

  const [userProfile, setUserProfile] = useState<LeaderboardEntry>(() => {
    try {
      const saved = localStorage.getItem('gm_arena_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      uid: 'local-challenger',
      displayName: 'Challenger',
      elo: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      titleBadge: 'CLUB',
    };
  });

  // Firestore Collections State
  const [firestoreLeaderboard, setFirestoreLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [onlineMatches, setOnlineMatches] = useState<OnlineMatchRecord[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [matchMessages, setMatchMessages] = useState<{ id: string; senderName: string; text: string }[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestRecord[]>([]);

  // WebSocket Live Lobby State
  const [lobbyMessages, setLobbyMessages] = useState<LobbyMessage[]>([]);
  const [onlinePresenceCount, setOnlinePresenceCount] = useState<number>(4);
  const wsRef = useRef<WebSocket | null>(null);

  // Gemini AI Coach & Maps Grounding Clubs State
  const [coachInsight, setCoachInsight] = useState<CoachInsight | null>(null);
  const [coachLoading, setCoachLoading] = useState<boolean>(false);
  const [clubsQuery, setClubsQuery] = useState<string>('New York, NY');
  const [clubsOverview, setClubsOverview] = useState<string>(
    'Over-the-board chess clubs, iconic park tables, and FIDE tournament venues in New York, NY. Search any city above or click "Near Me" for live Google Maps venues.'
  );
  const [clubsPlaces, setClubsPlaces] = useState<VenuePlace[]>([
    {
      title: 'Marshall Chess Club · Greenwich Village',
      uri: 'https://www.google.com/maps/search/?api=1&query=Marshall+Chess+Club+New+York',
      placeId: 'marshall-club',
    },
    {
      title: 'Washington Square Park Chess Tables',
      uri: 'https://www.google.com/maps/search/?api=1&query=Washington+Square+Park+Chess+Tables',
      placeId: 'wsp-tables',
    },
  ]);
  const [clubsLoading, setClubsLoading] = useState<boolean>(false);

  // Sync body[data-state] attribute for Game Shell contract
  useEffect(() => {
    document.body.dataset.state = shellState;
  }, [shellState]);

  // Test Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Save profile to localStorage as fallback cache
  useEffect(() => {
    try {
      localStorage.setItem('gm_arena_profile', JSON.stringify(userProfile));
    } catch {}
  }, [userProfile]);

  // Derived active FEN & Chess instance
  const currentFen = viewIndex === 0 ? startingFen : history[viewIndex - 1]?.fen || startingFen;
  const latestFen = history.length === 0 ? startingFen : history[history.length - 1].fen;
  const activeChess = new Chess(currentFen);
  const latestChess = new Chess(latestFen);
  const evalCp = evaluatePosition(currentFen);
  const whiteBarPct = evalToWhitePercentage(evalCp);
  const evalFormatted = formatEvalScore(evalCp);
  const capturedMat = calculateCapturedMaterial(currentFen);

  const lastMoveHighlight =
    viewIndex > 0 && history[viewIndex - 1]
      ? { from: history[viewIndex - 1].from, to: history[viewIndex - 1].to }
      : null;

  // Build move pairs for algebraic notation table
  const movePairs: MoveRecord[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const w = history[i];
    const b = history[i + 1];
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: w
        ? {
            san: w.san,
            fen: w.fen,
            evalCp: w.evalCp,
            classification: w.classification,
            index: i + 1,
          }
        : undefined,
      black: b
        ? {
            san: b.san,
            fen: b.fen,
            evalCp: b.evalCp,
            classification: b.classification,
            index: i + 2,
          }
        : undefined,
    });
  }

  const pgnString = movePairs
    .map((p) => `${p.moveNumber}. ${p.white?.san || ''}${p.black ? ' ' + p.black.san : ''}`)
    .join(' ');

  // Firebase Auth & Firestore Listeners
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const cleanName = (user.displayName || 'Grandmaster').slice(0, 50);
        setCurrentUser({
          uid: user.uid,
          displayName: cleanName,
          email: user.email || '',
        });

        // Upsert private PII doc and public profile doc if verified
        if (user.emailVerified) {
          const privPath = `users/${user.uid}/private/info`;
          try {
            await setDoc(
              doc(db, 'users', user.uid, 'private', 'info'),
              {
                uid: user.uid,
                email: (user.email || 'player@example.com').slice(0, 254),
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, privPath);
          }
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubAuth();
  }, []);

  // Attach Firestore listeners for public leaderboard, matches, and friend requests
  useEffect(() => {
    // Public Leaderboard listener
    const qLeaderboard = query(
      collection(db, 'users_public'),
      where('elo', '>=', 100),
      orderBy('elo', 'desc'),
      limit(20)
    );
    const unsubLb = onSnapshot(
      qLeaderboard,
      (snap) => {
        const rows: LeaderboardEntry[] = [];
        snap.forEach((d) => {
          const data = d.data();
          rows.push({
            uid: data.uid,
            displayName: data.displayName,
            elo: data.elo,
            wins: data.wins,
            losses: data.losses,
            draws: data.draws,
            gamesPlayed: data.gamesPlayed,
            titleBadge: data.titleBadge || 'CLUB',
          });
        });
        setFirestoreLeaderboard(rows);
        if (currentUser) {
          const mine = rows.find((r) => r.uid === currentUser.uid);
          if (mine) setUserProfile(mine);
        }
      },
      (err) => {
        console.warn('Leaderboard snapshot fallback:', err.message);
      }
    );

    // Matches listener
    const qMatches = query(
      collection(db, 'matches'),
      where('status', 'in', ['waiting', 'active', 'finished']),
      limit(15)
    );
    const unsubMatches = onSnapshot(
      qMatches,
      (snap) => {
        const list: OnlineMatchRecord[] = [];
        snap.forEach((d) => {
          const data = d.data() as OnlineMatchRecord;
          list.push(data);
        });
        setOnlineMatches(list);
      },
      (err) => {
        console.warn('Matches snapshot fallback:', err.message);
      }
    );

    return () => {
      unsubLb();
      unsubMatches();
    };
  }, [currentUser]);

  // Listen to active online match document and its chat messages subcollection
  useEffect(() => {
    if (!activeMatchId) {
      setMatchMessages([]);
      return;
    }

    const matchRef = doc(db, 'matches', activeMatchId);
    const unsubMatch = onSnapshot(
      matchRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as OnlineMatchRecord;
        if (data.fen && data.fen !== latestFen) {
          setStartingFen(data.fen);
          setHistory([]);
          setViewIndex(0);
        }
        setWhiteTimeMs(data.whiteTimeMs);
        setBlackTimeMs(data.blackTimeMs);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `matches/${activeMatchId}`)
    );

    let unsubMsgs = () => {};
    if (currentUser) {
      const msgsQuery = query(
        collection(db, 'matches', activeMatchId, 'messages'),
        where('text', '>=', ' '),
        limit(30)
      );
      unsubMsgs = onSnapshot(
        msgsQuery,
        (snap) => {
          const list: { id: string; senderName: string; text: string }[] = [];
          snap.forEach((d) => {
            const dt = d.data();
            list.push({ id: d.id, senderName: dt.senderName, text: dt.text });
          });
          setMatchMessages(list);
        },
        (err) => console.warn('Match chat listener:', err.message)
      );
    }

    return () => {
      unsubMatch();
      unsubMsgs();
    };
  }, [activeMatchId, currentUser, latestFen]);

  // Friend Requests listener when authenticated
  useEffect(() => {
    if (!currentUser) {
      setFriendRequests([]);
      return;
    }
    const qSent = query(
      collection(db, 'friend_requests'),
      where('fromUid', '==', currentUser.uid)
    );
    const unsub = onSnapshot(
      qSent,
      (snap) => {
        const list: FriendRequestRecord[] = [];
        snap.forEach((d) => {
          const dt = d.data();
          list.push({
            id: d.id,
            fromUid: dt.fromUid,
            fromName: dt.fromName,
            fromElo: dt.fromElo,
            toUid: dt.toUid,
            toName: dt.toName,
            status: dt.status,
          });
        });
        setFriendRequests(list);
      },
      (err) => console.warn('Friend requests listener:', err.message)
    );
    return () => unsub();
  }, [currentUser]);

  // Connect to WebSocket server for real-time lobby chat and presence
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'user:join',
          id: userProfile.uid,
          name: userProfile.displayName,
          elo: userProfile.elo,
          titleBadge: userProfile.titleBadge,
          status: 'online',
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          if (Array.isArray(data.messages)) setLobbyMessages(data.messages);
          if (Array.isArray(data.players)) {
            setOnlinePresenceCount(Math.max(4, data.players.length + 3));
          }
        } else if (data.type === 'chat:message' && data.message) {
          setLobbyMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        } else if (data.type === 'presence:list' && Array.isArray(data.players)) {
          setOnlinePresenceCount(Math.max(4, data.players.length + 3));
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [userProfile.uid, userProfile.displayName, userProfile.elo, userProfile.titleBadge]);

  // Persist user profile to Firestore if signed in
  const syncProfileToFirestore = useCallback(
    async (updated: LeaderboardEntry) => {
      setUserProfile(updated);
      if (!currentUser || !auth.currentUser?.emailVerified) return;
      const pubPath = `users_public/${currentUser.uid}`;
      try {
        await setDoc(doc(db, 'users_public', currentUser.uid), {
          uid: currentUser.uid,
          displayName: updated.displayName.slice(0, 50),
          photoURL: (auth.currentUser.photoURL || '').slice(0, 500),
          elo: Math.max(100, Math.min(4000, updated.elo)),
          wins: updated.wins,
          losses: updated.losses,
          draws: updated.draws,
          gamesPlayed: updated.gamesPlayed,
          titleBadge: updated.titleBadge || 'CLUB',
          preferredBoard: boardTheme,
          preferredPieces: pieceStyle,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, pubPath);
      }
    },
    [currentUser, boardTheme, pieceStyle]
  );

  // Trigger Game Over snapshot & Elo update
  const triggerGameOver = useCallback(
    (winner: 'w' | 'b' | 'draw', reasonTitle: string, reasonSubtitle: string) => {
      const outcomeScore: 1 | 0.5 | 0 =
        winner === 'draw' ? 0.5 : winner === playerColor ? 1 : 0;

      const oppElo =
        gameMode === 'ai_novice'
          ? 800
          : gameMode === 'ai_club'
          ? 1450
          : gameMode === 'ai_master'
          ? 2050
          : gameMode === 'ai_grandmaster'
          ? 2550
          : 1500;

      const nextElo = calculateNewElo(userProfile.elo, oppElo, outcomeScore);
      const eloDelta = nextElo - userProfile.elo;

      // Compute accuracy % from move classifications
      const playerMoves = history.filter((h) => h.moverColor === playerColor);
      const goodMoves = playerMoves.filter((m) =>
        ['Brilliant', 'Best', 'Good'].includes(m.classification)
      ).length;
      const accuracyPct =
        playerMoves.length > 0 ? Math.round((goodMoves / playerMoves.length) * 100) : 92;

      setGameOverSnapshot({
        outcomeTitle: reasonTitle,
        outcomeSubtitle: reasonSubtitle,
        winner,
        totalMoves: Math.ceil(history.length / 2),
        accuracyPct,
        newElo: nextElo,
        eloDelta,
      });

      const updatedProfile: LeaderboardEntry = {
        ...userProfile,
        elo: nextElo,
        wins: userProfile.wins + (outcomeScore === 1 ? 1 : 0),
        losses: userProfile.losses + (outcomeScore === 0 ? 1 : 0),
        draws: userProfile.draws + (outcomeScore === 0.5 ? 1 : 0),
        gamesPlayed: userProfile.gamesPlayed + 1,
      };
      syncProfileToFirestore(updatedProfile);

      if (outcomeScore === 1) soundEngine.playVictory();
      else soundEngine.playDefeat();

      setShellState('gameover');
    },
    [gameMode, history, playerColor, syncProfileToFirestore, userProfile]
  );

  // Start or Reset a Match
  const startNewGame = useCallback(
    (config?: {
      mode?: GameMode;
      timeControl?: TimeControlId;
      boardTheme?: BoardThemeId;
      pieceStyle?: PieceStyle;
      playerColor?: 'w' | 'b';
      customFen?: string;
    }) => {
      const nextMode = config?.mode ?? gameMode;
      const nextTc = config?.timeControl ?? timeControl;
      const nextBoard = config?.boardTheme ?? boardTheme;
      const nextPieces = config?.pieceStyle ?? pieceStyle;
      const nextColor = config?.playerColor ?? playerColor;

      setGameMode(nextMode);
      setTimeControl(nextTc);
      setBoardTheme(nextBoard);
      setPieceStyle(nextPieces);
      setPlayerColor(nextColor);
      setFlipped(nextColor === 'b');
      setHintMove(null);
      setCoachInsight(null);
      setGameOverSnapshot(null);
      setPuzzleBanner(null);

      let initFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      if (config?.customFen) {
        initFen = config.customFen;
      } else if (nextMode === 'chess960') {
        initFen = generateChess960Fen();
      } else if (nextMode === 'daily_puzzle') {
        const pz = DAILY_PUZZLES.find((p) => p.id === activePuzzleId) || DAILY_PUZZLES[0];
        initFen = pz.fen;
        setPuzzleBanner(`Puzzle Goal: ${pz.description}`);
      }

      setStartingFen(initFen);
      setHistory([]);
      setViewIndex(0);

      const tcMs = TIME_CONTROLS[nextTc]?.initialMs || 600_000;
      setWhiteTimeMs(tcMs);
      setBlackTimeMs(tcMs);
      setShellState('playing');
    },
    [activePuzzleId, boardTheme, gameMode, pieceStyle, playerColor, timeControl]
  );

  // Execute a move on the board
  const executeMove = useCallback(
    (from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n' = 'q'): boolean => {
      if (shellState !== 'playing') return false;
      // Only allow moving from the latest position
      const baseFen = history.length === 0 ? startingFen : history[history.length - 1].fen;
      const chess = new Chess(baseFen);
      const prevEval = evaluatePosition(baseFen);
      const moverColor = chess.turn();

      try {
        const moveResult = chess.move({ from, to, promotion });
        if (!moveResult) return false;

        const nextFen = chess.fen();
        const nextEval = evaluatePosition(nextFen);
        const classification = classifyMoveDelta(prevEval, nextEval, moverColor);

        // Sound feedback
        if (chess.inCheck()) {
          soundEngine.playCheck();
        } else if (moveResult.captured) {
          soundEngine.playCapture();
        } else {
          soundEngine.playMove();
        }

        // Increment clock for mover
        const incMs = TIME_CONTROLS[timeControl]?.incrementMs || 0;
        if (moverColor === 'w') {
          setWhiteTimeMs((t) => t + incMs);
        } else {
          setBlackTimeMs((t) => t + incMs);
        }

        const newSnap: HistorySnap = {
          fen: nextFen,
          san: moveResult.san,
          from,
          to,
          evalCp: nextEval,
          classification,
          moverColor,
        };

        const updatedHistory = [...history, newSnap];
        setHistory(updatedHistory);
        setViewIndex(updatedHistory.length);
        setHintMove(null);

        // Check Daily Puzzle verification
        if (gameMode === 'daily_puzzle') {
          const pz = DAILY_PUZZLES.find((p) => p.id === activePuzzleId) || DAILY_PUZZLES[0];
          if (pz.solutionSan.includes(moveResult.san) || chess.isCheckmate()) {
            setPuzzleBanner(`Solved! ${moveResult.san} is the winning tactical strike!`);
            soundEngine.playVictory();
          } else {
            setPuzzleBanner(`Not quite (${moveResult.san}). Try looking for a forcing check or mate!`);
          }
          return true;
        }

        // Sync move to Firestore if in an active online match
        if (gameMode === 'multiplayer' && activeMatchId && currentUser) {
          const isOver = chess.isGameOver();
          const matchWinner = chess.isCheckmate()
            ? moverColor
            : isOver
            ? 'draw'
            : 'none';
          updateDoc(doc(db, 'matches', activeMatchId), {
            fen: nextFen,
            pgn: updatedHistory.map((h) => h.san).join(' '),
            turn: chess.turn(),
            status: isOver ? 'finished' : 'active',
            winner: matchWinner,
            whiteTimeMs,
            blackTimeMs,
            lastMoveSan: moveResult.san.slice(0, 16),
            updatedAt: serverTimestamp(),
          }).catch((e) =>
            handleFirestoreError(e, OperationType.UPDATE, `matches/${activeMatchId}`)
          );
        }

        // Check terminal states
        if (chess.isCheckmate()) {
          setTimeout(() => {
            triggerGameOver(
              moverColor,
              moverColor === playerColor ? 'Victory by Checkmate!' : 'Defeat by Checkmate',
              `${moverColor === 'w' ? 'White' : 'Black'} delivered checkmate with ${moveResult.san}.`
            );
          }, 450);
        } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
          setTimeout(() => {
            triggerGameOver(
              'draw',
              'Match Drawn',
              chess.isStalemate() ? 'Draw by Stalemate.' : 'Draw by repetition or insufficient material.'
            );
          }, 450);
        }

        return true;
      } catch {
        return false;
      }
    },
    [
      activeMatchId,
      activePuzzleId,
      blackTimeMs,
      currentUser,
      gameMode,
      history,
      playerColor,
      shellState,
      startingFen,
      timeControl,
      triggerGameOver,
      whiteTimeMs,
    ]
  );

  const executeMoveRef = useRef(executeMove);
  useEffect(() => {
    executeMoveRef.current = executeMove;
  }, [executeMove]);

  const triggerGameOverRef = useRef(triggerGameOver);
  useEffect(() => {
    triggerGameOverRef.current = triggerGameOver;
  }, [triggerGameOver]);

  const activeTurn = latestChess.turn();

  // Automated AI Bot Response when it is AI's turn
  useEffect(() => {
    if (shellState !== 'playing') return;
    const isAiMode =
      gameMode === 'ai_novice' ||
      gameMode === 'ai_club' ||
      gameMode === 'ai_master' ||
      gameMode === 'ai_grandmaster' ||
      gameMode === 'chess960';

    if (!isAiMode) return;

    const chess = new Chess(latestFen);
    if (chess.isGameOver()) return;

    if (chess.turn() !== playerColor) {
      const timer = setTimeout(() => {
        const diff =
          gameMode === 'chess960'
            ? 'ai_club'
            : (gameMode as 'ai_novice' | 'ai_club' | 'ai_master' | 'ai_grandmaster');
        const aiMove = selectBestEngineMove(latestFen, diff);
        if (aiMove) {
          executeMoveRef.current(aiMove.from, aiMove.to, 'q');
        }
      }, 420);
      return () => clearTimeout(timer);
    }
  }, [gameMode, latestFen, playerColor, shellState]);

  // Live Chess Clocks Countdown
  useEffect(() => {
    if (shellState !== 'playing' || gameMode === 'daily_puzzle') return;
    const interval = setInterval(() => {
      if (activeTurn === 'w') {
        setWhiteTimeMs((prev) => {
          if (prev <= 200) {
            triggerGameOverRef.current('b', 'Time Out', 'White flagged on time.');
            return 0;
          }
          return prev - 200;
        });
      } else {
        setBlackTimeMs((prev) => {
          if (prev <= 200) {
            triggerGameOverRef.current('w', 'Time Out', 'Black flagged on time.');
            return 0;
          }
          return prev - 200;
        });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [activeTurn, gameMode, shellState]);

  // Global Keyboard Shortcuts (Title Enter/Space to Start, Esc/P Pause, F Flip, M Mute, Arrows History)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (shellState === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setShellState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setMuted((m) => {
          soundEngine.muted = !m;
          return !m;
        });
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        startNewGame();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setViewIndex((v) => Math.max(0, v - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setViewIndex((v) => Math.min(history.length, v + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history.length, shellState, startNewGame]);

  // Handlers for Gemini Coach & Maps Grounding
  const handleAskCoach = async () => {
    setCoachLoading(true);
    try {
      const legalMoves = activeChess.moves();
      const res = await fetch('/api/chess/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: currentFen,
          pgn: pgnString,
          lastMove: viewIndex > 0 ? history[viewIndex - 1]?.san : 'Opening',
          evaluation: evalCp,
          turn: activeChess.turn(),
          legalMoves,
        }),
      });
      const data = await res.json();
      setCoachInsight(data);
    } catch {
      setCoachInsight({
        summary: 'Maintain central tension and develop knights toward active outposts.',
        candidateMove: activeChess.moves()[0] || 'Nf3',
        tacticalMotif: 'Central Outpost Control',
        plan: 'Castle early and connect rooks on the back rank.',
      });
    } finally {
      setCoachLoading(false);
    }
  };

  const handleSearchClubs = async (useGeolocation = false) => {
    setClubsLoading(true);
    const runFetch = async (lat?: number, lng?: number, q?: string) => {
      try {
        const res = await fetch('/api/chess/venues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryLocation: q || clubsQuery,
            lat,
            lng,
          }),
        });
        const data = await res.json();
        if (data.overview) setClubsOverview(data.overview);
        if (Array.isArray(data.places) && data.places.length > 0) {
          setClubsPlaces(data.places);
        }
      } catch {}
      setClubsLoading(false);
    };

    if (useGeolocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setClubsQuery('Near Current Location');
          runFetch(pos.coords.latitude, pos.coords.longitude, 'my current coordinates');
        },
        () => runFetch(undefined, undefined, clubsQuery)
      );
    } else {
      await runFetch(undefined, undefined, clubsQuery);
    }
  };

  // Handlers for Firebase Auth, Multiplayer Matches, and Social Friends
  const handleSignInGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        const updated: LeaderboardEntry = {
          ...userProfile,
          uid: cred.user.uid,
          displayName: (cred.user.displayName || userProfile.displayName).slice(0, 50),
        };
        await syncProfileToFirestore(updated);
      }
    } catch (err) {
      console.warn('Google sign-in popup closed or cancelled:', err);
    }
  };

  const handleSignOut = async () => {
    await fbSignOut(auth);
  };

  const handleCreateOnlineMatch = async (tc: TimeControlId) => {
    if (!currentUser) {
      await handleSignInGoogle();
      return;
    }
    const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const initMs = TIME_CONTROLS[tc]?.initialMs || 600_000;
    const startF = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    try {
      await setDoc(doc(db, 'matches', matchId), {
        matchId,
        whiteUid: currentUser.uid,
        whiteName: userProfile.displayName.slice(0, 50),
        whiteElo: userProfile.elo,
        blackUid: 'waiting',
        blackName: 'Waiting for Challenger...',
        blackElo: 1200,
        fen: startF,
        pgn: '',
        turn: 'w',
        status: 'waiting',
        winner: 'none',
        timeControl: tc,
        whiteTimeMs: initMs,
        blackTimeMs: initMs,
        lastMoveSan: 'Start',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActiveMatchId(matchId);
      startNewGame({ mode: 'multiplayer', timeControl: tc, playerColor: 'w' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `matches/${matchId}`);
    }
  };

  const handleJoinOnlineMatch = async (match: OnlineMatchRecord) => {
    if (match.status === 'waiting' && currentUser && match.whiteUid !== currentUser.uid) {
      try {
        await updateDoc(doc(db, 'matches', match.matchId), {
          blackUid: currentUser.uid,
          blackName: userProfile.displayName.slice(0, 50),
          blackElo: userProfile.elo,
          status: 'active',
          updatedAt: serverTimestamp(),
        });
        setActiveMatchId(match.matchId);
        startNewGame({
          mode: 'multiplayer',
          timeControl: match.timeControl,
          playerColor: 'b',
          customFen: match.fen,
        });
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `matches/${match.matchId}`);
      }
    }
    setActiveMatchId(match.matchId);
    startNewGame({
      mode: 'multiplayer',
      timeControl: match.timeControl,
      playerColor: currentUser?.uid === match.blackUid ? 'b' : 'w',
      customFen: match.fen,
    });
  };

  const handleSendFriendRequest = async (target: LeaderboardEntry) => {
    if (!currentUser) {
      // Also broadcast challenge/friend ping over WebSocket for immediate lobby feedback
      wsRef.current?.send(
        JSON.stringify({
          type: 'chat:send',
          senderId: userProfile.uid,
          senderName: userProfile.displayName,
          senderTitle: userProfile.titleBadge,
          senderElo: userProfile.elo,
          text: `Sent a friend & match invite to ${target.displayName}!`,
          room: 'global',
        })
      );
      return;
    }
    if (target.uid === currentUser.uid) return;
    const reqId = `freq_${currentUser.uid}_${target.uid}`;
    try {
      await setDoc(doc(db, 'friend_requests', reqId), {
        fromUid: currentUser.uid,
        fromName: userProfile.displayName.slice(0, 50),
        fromElo: userProfile.elo,
        toUid: target.uid,
        toName: target.displayName.slice(0, 50),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Friend request note:', err);
    }
  };

  const handleRespondFriendRequest = async (reqId: string, status: 'accepted' | 'declined') => {
    try {
      await updateDoc(doc(db, 'friend_requests', reqId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `friend_requests/${reqId}`);
    }
  };

  const handleSendLobbyMessage = (text: string) => {
    wsRef.current?.send(
      JSON.stringify({
        type: 'chat:send',
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        senderTitle: userProfile.titleBadge,
        senderElo: userProfile.elo,
        text,
        room: 'global',
      })
    );
  };

  const handleSendMatchMessage = async (text: string) => {
    if (!activeMatchId || !currentUser) {
      handleSendLobbyMessage(text);
      return;
    }
    const msgId = `msg_${Date.now()}`;
    try {
      await setDoc(doc(db, 'matches', activeMatchId, 'messages', msgId), {
        senderUid: currentUser.uid,
        senderName: userProfile.displayName.slice(0, 50),
        text: text.slice(0, 280),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `matches/${activeMatchId}/messages/${msgId}`);
    }
  };

  // Merge Firestore Leaderboard with Seed Grandmasters so Leaderboard is always populated
  const mergedLeaderboard: LeaderboardEntry[] = (() => {
    const map = new Map<string, LeaderboardEntry>();
    for (const s of SEED_LEADERBOARD) map.set(s.uid, s);
    for (const f of firestoreLeaderboard) map.set(f.uid, f);
    map.set(userProfile.uid, userProfile);
    return Array.from(map.values()).sort((a, b) => b.elo - a.elo);
  })();

  // Render Title Screen when in 'title' state
  if (shellState === 'title') {
    return (
      <TitleScreen
        initialBoardTheme={boardTheme}
        initialPieceStyle={pieceStyle}
        onStartGame={(cfg) => startNewGame(cfg)}
      />
    );
  }

  const topPlayerIsBlack = !flipped;
  const opponentName =
    gameMode === 'ai_novice'
      ? 'Engine · Novice Bot (800)'
      : gameMode === 'ai_club'
      ? 'Engine · Club Tactician (1450)'
      : gameMode === 'ai_master'
      ? 'Engine · Master AI (2050)'
      : gameMode === 'ai_grandmaster'
      ? 'Engine · Grandmaster Apex (2550)'
      : gameMode === 'daily_puzzle'
      ? 'Daily Tactical Puzzle Master'
      : gameMode === 'pass_and_play'
      ? 'Player 2 (Over-The-Board)'
      : 'Challenger · Online';

  const topName = topPlayerIsBlack ? opponentName : `${userProfile.displayName} (${userProfile.elo})`;
  const bottomName = topPlayerIsBlack ? `${userProfile.displayName} (${userProfile.elo})` : opponentName;
  const topClockMs = topPlayerIsBlack ? blackTimeMs : whiteTimeMs;
  const bottomClockMs = topPlayerIsBlack ? whiteTimeMs : blackTimeMs;
  const topCaptured = topPlayerIsBlack ? capturedMat.capturedByBlack : capturedMat.capturedByWhite;
  const bottomCaptured = topPlayerIsBlack ? capturedMat.capturedByWhite : capturedMat.capturedByBlack;
  const topAdvantage = topPlayerIsBlack ? capturedMat.blackAdvantage : capturedMat.whiteAdvantage;
  const bottomAdvantage = topPlayerIsBlack ? capturedMat.whiteAdvantage : capturedMat.blackAdvantage;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0D1014] text-stone-100 select-none">
      {/* Main Arena Playfield Grid: Left/Center Board Stage + Unified Right Command Dock */}
      <div className="mx-auto grid h-full w-full max-w-[1440px] grid-cols-1 gap-4 p-3 sm:p-5 lg:grid-cols-12">
        {/* Left & Center Stage (8 Columns on Desktop): Evaluation Bar + Board + Player HUD Strips */}
        <div className="relative flex flex-col items-center justify-between lg:col-span-7 xl:col-span-8">
          {/* Top Bar: Opponent HUD Strip + Top-Right Utility Controls (Mute, Pause, Restart, Title) */}
          <div className="flex w-full max-w-[min(68vh,88vw)] items-center justify-between gap-2 rounded-xl border border-stone-800/90 bg-[#14181F] px-3.5 py-2 shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-900 font-mono text-xs font-bold text-amber-400">
                {topPlayerIsBlack ? 'B' : 'W'}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-xs font-bold text-white sm:text-sm">
                  {topName}
                </div>
                <div className="flex items-center gap-1">
                  {topCaptured.slice(0, 10).map((type, idx) => (
                    <span key={idx} className="inline-block h-3.5 w-3.5">
                      <ChessPieceSvg
                        type={type as 'p' | 'n' | 'b' | 'r' | 'q'}
                        color={topPlayerIsBlack ? 'w' : 'b'}
                        style={pieceStyle}
                      />
                    </span>
                  ))}
                  {topAdvantage > 0 && (
                    <span className="font-mono text-[11px] font-bold text-emerald-400 tabular-nums">
                      +{topAdvantage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Top Clock */}
              <div
                aria-label="Top player clock"
                className={`rounded-lg border px-3 py-1 font-mono text-base font-bold tabular-nums sm:text-lg ${
                  latestChess.turn() === (topPlayerIsBlack ? 'b' : 'w')
                    ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                    : 'border-stone-800 bg-stone-950 text-stone-400'
                }`}
              >
                {formatClockMs(topClockMs)}
              </div>

              {/* Compact SVG Utility Buttons (Mute [M], Pause [P], Restart [R], Title) */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setMuted((m) => {
                      soundEngine.muted = !m;
                      return !m;
                    });
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-600 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    {muted ? (
                      <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                    ) : (
                      <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    )}
                  </svg>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause game (P)"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShellState('paused');
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-600 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Restart match (R)"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    startNewGame();
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-600 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Return to Title Screen"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShellState('title');
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-600 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Puzzle Banner if in Daily Puzzle mode */}
          {puzzleBanner && (
            <div className="my-1 w-full max-w-[min(68vh,88vw)] rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-center font-display text-xs font-bold text-amber-300">
              {puzzleBanner}
            </div>
          )}

          {/* Centerpiece: Live Centipawn Evaluation Bar + 2D Chessboard */}
          <div className="my-auto flex w-full items-center justify-center gap-3 py-1">
            {/* Vertical Centipawn Evaluation Bar */}
            <div
              aria-label={`Engine evaluation ${evalFormatted}`}
              className="relative flex h-[min(60vh,60vw)] sm:h-[min(64vh,64vw)] w-6 flex-col overflow-hidden rounded-lg border border-stone-700 bg-[#22252A] shadow-inner"
            >
              <div
                className="w-full bg-[#F1F5F9] transition-all duration-300"
                style={{
                  height: `${flipped ? 100 - whiteBarPct : whiteBarPct}%`,
                }}
              />
              <span className="absolute inset-x-0 bottom-1.5 text-center font-mono text-[9px] font-extrabold text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] tabular-nums">
                {evalFormatted}
              </span>
            </div>

            {/* Interactive 2D Chess Board */}
            <ChessBoard2D
              fen={currentFen}
              flipped={flipped}
              boardTheme={boardTheme}
              pieceStyle={pieceStyle}
              lastMove={lastMoveHighlight}
              hintMove={hintMove}
              onMove={executeMove}
              disabled={shellState !== 'playing' || viewIndex < history.length}
            />
          </div>

          {/* Bottom Bar: Active Player HUD Strip & Clock */}
          <div className="flex w-full max-w-[min(68vh,88vw)] items-center justify-between gap-2 rounded-xl border border-stone-800/90 bg-[#14181F] px-3.5 py-2 shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 font-mono text-xs font-bold text-amber-300">
                {topPlayerIsBlack ? 'W' : 'B'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-xs font-bold text-white sm:text-sm">
                    {bottomName}
                  </span>
                  <span className="font-mono text-[11px] text-stone-400">
                    · {activeChess.inCheck() ? 'CHECK!' : activeChess.turn() === 'w' ? 'White to Move' : 'Black to Move'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {bottomCaptured.slice(0, 10).map((type, idx) => (
                    <span key={idx} className="inline-block h-3.5 w-3.5">
                      <ChessPieceSvg
                        type={type as 'p' | 'n' | 'b' | 'r' | 'q'}
                        color={topPlayerIsBlack ? 'b' : 'w'}
                        style={pieceStyle}
                      />
                    </span>
                  ))}
                  {bottomAdvantage > 0 && (
                    <span className="font-mono text-[11px] font-bold text-emerald-400 tabular-nums">
                      +{bottomAdvantage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              aria-label="Bottom player clock"
              className={`rounded-lg border px-3 py-1 font-mono text-base font-bold tabular-nums sm:text-lg ${
                latestChess.turn() === (topPlayerIsBlack ? 'w' : 'b')
                  ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                  : 'border-stone-800 bg-stone-950 text-stone-400'
              }`}
            >
              {formatClockMs(bottomClockMs)}
            </div>
          </div>
        </div>

        {/* Right Command Dock (4 Columns on Desktop) */}
        <div className="h-full min-h-[380px] overflow-hidden lg:col-span-5 xl:col-span-4">
          <RightCommandDock
            gameMode={gameMode}
            timeControl={timeControl}
            boardTheme={boardTheme}
            pieceStyle={pieceStyle}
            onSelectMode={(m, tc) => startNewGame({ mode: m, timeControl: tc })}
            onSelectPuzzle={(pid) => {
              setActivePuzzleId(pid);
              const pz = DAILY_PUZZLES.find((p) => p.id === pid) || DAILY_PUZZLES[0];
              startNewGame({ mode: 'daily_puzzle', customFen: pz.fen });
              setPuzzleBanner(`Puzzle Goal: ${pz.description}`);
            }}
            activePuzzleId={activePuzzleId}
            onChangeBoardTheme={(t) => setBoardTheme(t)}
            onChangePieceStyle={(s) => setPieceStyle(s)}
            onFlipBoard={() => setFlipped((f) => !f)}
            onResign={() =>
              triggerGameOver(
                playerColor === 'w' ? 'b' : 'w',
                'Match Resigned',
                'You resigned the match.'
              )
            }
            onOfferDraw={() =>
              triggerGameOver('draw', 'Draw Agreed', 'Mutual draw agreed between players.')
            }
            onNewGame={() => startNewGame()}
            onRequestHint={() => {
              const best = selectBestEngineMove(currentFen, 'ai_master');
              if (best) setHintMove({ from: best.from, to: best.to });
            }}
            movePairs={movePairs}
            currentHistoryIndex={viewIndex}
            totalMoves={history.length}
            onJumpToMove={(idx) => setViewIndex(idx)}
            pgnString={pgnString}
            fenString={currentFen}
            coachInsight={coachInsight}
            coachLoading={coachLoading}
            onAskCoach={handleAskCoach}
            currentUser={currentUser}
            userProfile={userProfile}
            onSignInGoogle={handleSignInGoogle}
            onSignOut={handleSignOut}
            onUpdateDisplayName={(newName) => {
              const updated = { ...userProfile, displayName: newName.slice(0, 50) };
              syncProfileToFirestore(updated);
            }}
            onlineMatches={onlineMatches}
            activeMatchId={activeMatchId}
            onCreateOnlineMatch={handleCreateOnlineMatch}
            onJoinOnlineMatch={handleJoinOnlineMatch}
            leaderboard={mergedLeaderboard}
            friendRequests={friendRequests}
            onSendFriendRequest={handleSendFriendRequest}
            onRespondFriendRequest={handleRespondFriendRequest}
            lobbyMessages={lobbyMessages}
            matchMessages={matchMessages}
            onSendLobbyMessage={handleSendLobbyMessage}
            onSendMatchMessage={handleSendMatchMessage}
            onlinePresenceCount={onlinePresenceCount}
            clubsQuery={clubsQuery}
            setClubsQuery={setClubsQuery}
            clubsOverview={clubsOverview}
            clubsPlaces={clubsPlaces}
            clubsLoading={clubsLoading}
            onSearchClubs={handleSearchClubs}
          />
        </div>
      </div>

      {/* PAUSE MODAL (No backdrop-blur over playfield per Game Shell rules) */}
      {shellState === 'paused' && (
        <div
          role="dialog"
          aria-label="Game Paused"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-[#14181F] p-6 text-center shadow-2xl space-y-5">
            <div>
              <span className="font-mono text-xs font-bold tracking-widest text-amber-400 uppercase">
                ARENA CLOCK PAUSED
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
                Match Suspended
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-800 bg-stone-950 p-3 font-mono tabular-nums">
              <div>
                <div className="text-[10px] text-stone-400 uppercase">MOVES</div>
                <div className="text-lg font-bold text-white">{Math.ceil(history.length / 2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-stone-400 uppercase">EVAL</div>
                <div className="text-lg font-bold text-emerald-400">{evalFormatted}</div>
              </div>
              <div>
                <div className="text-[10px] text-stone-400 uppercase">RATING</div>
                <div className="text-lg font-bold text-amber-400">{userProfile.elo}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShellState('playing')}
                className="w-full cursor-pointer rounded-xl bg-amber-500 py-3 font-display text-sm font-bold text-stone-950 hover:bg-amber-400"
              >
                Resume Match (Esc)
              </button>
              <button
                type="button"
                onClick={() => startNewGame()}
                className="w-full cursor-pointer rounded-xl border border-stone-700 bg-stone-900 py-2.5 font-display text-sm font-semibold text-stone-200 hover:border-stone-600"
              >
                Restart Match
              </button>
              <button
                type="button"
                onClick={() => setShellState('title')}
                className="w-full cursor-pointer rounded-xl border border-stone-800 bg-stone-950 py-2.5 font-display text-sm font-semibold text-stone-400 hover:text-stone-200"
              >
                Exit to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL */}
      {shellState === 'gameover' && gameOverSnapshot && (
        <div
          role="dialog"
          aria-label="Match Outcome"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-[#14181F] p-6 text-center shadow-2xl space-y-5">
            <div>
              <span className="font-mono text-xs font-bold tracking-widest text-amber-400 uppercase">
                OFFICIAL MATCH RESULT
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
                {gameOverSnapshot.outcomeTitle}
              </h2>
              <p className="mt-1 text-xs text-stone-400">{gameOverSnapshot.outcomeSubtitle}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-800 bg-stone-950 p-3 font-mono tabular-nums">
              <div>
                <div className="text-[10px] text-stone-400 uppercase">ACCURACY</div>
                <div className="text-lg font-bold text-emerald-400">
                  {gameOverSnapshot.accuracyPct}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-stone-400 uppercase">MOVES</div>
                <div className="text-lg font-bold text-white">{gameOverSnapshot.totalMoves}</div>
              </div>
              <div>
                <div className="text-[10px] text-stone-400 uppercase">NEW ELO</div>
                <div className="text-lg font-bold text-amber-400">
                  {gameOverSnapshot.newElo}{' '}
                  <span className="text-xs">
                    ({gameOverSnapshot.eloDelta >= 0 ? `+${gameOverSnapshot.eloDelta}` : gameOverSnapshot.eloDelta})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => startNewGame()}
                className="w-full cursor-pointer rounded-xl bg-amber-500 py-3 font-display text-sm font-bold text-stone-950 hover:bg-amber-400"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={() => setShellState('playing')}
                className="w-full cursor-pointer rounded-xl border border-stone-700 bg-stone-900 py-2.5 font-display text-sm font-semibold text-stone-200 hover:border-stone-600"
              >
                Review Board & Analysis
              </button>
              <button
                type="button"
                onClick={() => setShellState('title')}
                className="w-full cursor-pointer rounded-xl border border-stone-800 bg-stone-950 py-2.5 font-display text-sm font-semibold text-stone-400 hover:text-stone-200"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
