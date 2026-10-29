import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface OnlinePlayer {
  id: string;
  name: string;
  elo: number;
  titleBadge: string;
  status: 'online' | 'in_game' | 'seeking';
}

interface LobbyMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderTitle: string;
  senderElo: number;
  text: string;
  timestamp: string;
  room: string;
}

interface ChallengeEvent {
  id: string;
  fromId: string;
  fromName: string;
  fromElo: number;
  toId: string;
  timeControl: string;
  matchId: string;
}

const connectedClients = new Map<WebSocket, OnlinePlayer>();
const lobbyMessages: LobbyMessage[] = [
  {
    id: 'seed-msg-1',
    senderId: 'gm-magnus',
    senderName: 'Magnus_V',
    senderTitle: 'GM',
    senderElo: 2840,
    text: 'Welcome to the Grandmaster Arena lobby. Anyone up for a 3+0 Blitz game?',
    timestamp: '10:42',
    room: 'global',
  },
  {
    id: 'seed-msg-2',
    senderId: 'im-elena',
    senderName: 'ElenaK_Chess',
    senderTitle: 'IM',
    senderElo: 2465,
    text: 'Studying the Sicilian Najdorf lines in the Analysis tab—the evaluation bar swing on 14.Nd5 is wild!',
    timestamp: '10:44',
    room: 'global',
  },
  {
    id: 'seed-msg-3',
    senderId: 'fm-arjun',
    senderName: 'ArjunTactics',
    senderTitle: 'FM',
    senderElo: 2310,
    text: 'Try Daily Puzzle #2 — classic smothered mate motif.',
    timestamp: '10:46',
    room: 'global',
  },
];

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // 1. Low-Latency Chess Coach & Move Analysis using gemini-3.1-flash-lite
  app.post('/api/chess/coach', async (req, res) => {
    try {
      const { fen, pgn, lastMove, evaluation, turn, legalMoves } = req.body;
      if (!fen) {
        res.status(400).json({ error: 'FEN position is required' });
        return;
      }

      const prompt = `You are a concise, world-class Grandmaster Chess Coach.
Current FEN: ${fen}
Recent PGN: ${pgn || 'Opening'}
Last Move Played: ${lastMove || 'None'}
Side to move: ${turn === 'w' ? 'White' : 'Black'}
Engine Centipawn Evaluation (White perspective): ${evaluation ?? 0}
Available Legal Moves: ${(legalMoves || []).slice(0, 18).join(', ')}

Provide a fast, sharp tactical & positional breakdown in JSON format with:
- summary: 1-2 sentences explaining who stands better and why.
- candidateMove: the single best recommended SAN move from the available legal moves.
- tacticalMotif: short label for the key theme (e.g. "Central Control", "King Safety", "Pin on f6", "Passed Pawn Push").
- plan: 1 concise sentence for the active player's next plan.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              candidateMove: { type: Type.STRING },
              tacticalMotif: { type: Type.STRING },
              plan: { type: Type.STRING },
            },
            required: ['summary', 'candidateMove', 'tacticalMotif', 'plan'],
          },
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (error) {
      console.error('Coach API Error:', error);
      // Graceful fallback if API key is not configured or rate limited
      res.status(200).json({
        summary: 'Control the center squares and prioritize king safety before launching flank attacks.',
        candidateMove: req.body?.legalMoves?.[0] || 'Nf3',
        tacticalMotif: 'Piece Development & Harmony',
        plan: 'Complete minor piece development and connect your rooks.',
      });
    }
  });

  // 2. Maps Grounding OTB Chess Clubs & Tournament Venues Finder using gemini-3.8-flash + googleMaps
  app.post('/api/chess/venues', async (req, res) => {
    try {
      const { queryLocation, lat, lng } = req.body;
      const locationStr = queryLocation || 'New York, NY';

      const toolConfig: Record<string, unknown> = {};
      if (typeof lat === 'number' && typeof lng === 'number') {
        toolConfig.retrievalConfig = {
          latLng: { latitude: lat, longitude: lng },
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Find popular real-world chess clubs, chess cafes, parks with chess tables, and tournament venues in or near ${locationStr}. For each venue, describe the atmosphere, player skill levels, and what makes it notable for chess players.`,
        config: {
          tools: [{ googleMaps: {} }],
          ...(Object.keys(toolConfig).length > 0 ? { toolConfig } : {}),
        },
      });

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const places = groundingChunks
        .map((chunk: any) => {
          if (chunk.maps) {
            return {
              title: chunk.maps.title || 'Chess Venue',
              uri: chunk.maps.uri || 'https://maps.google.com',
              placeId: chunk.maps.placeId || '',
            };
          }
          return null;
        })
        .filter(Boolean);

      res.json({
        overview:
          response.text ||
          `Featured over-the-board chess clubs and community tables near ${locationStr}.`,
        places,
      });
    } catch (error) {
      console.error('Maps Grounding Error:', error);
      res.status(200).json({
        overview: `Over-the-board chess clubs and historic parks in ${req.body?.queryLocation || 'your city'} host weekly rapid nights, casual blitz tables, and FIDE-rated weekend opens.`,
        places: [
          {
            title: 'Marshall Chess Club · Greenwich Village',
            uri: 'https://www.google.com/maps/search/?api=1&query=Marshall+Chess+Club+New+York',
            placeId: 'marshall-ny',
          },
          {
            title: 'Washington Square Park Chess Tables',
            uri: 'https://www.google.com/maps/search/?api=1&query=Washington+Square+Park+Chess+Tables',
            placeId: 'wsp-ny',
          },
          {
            title: 'Mechanics Institute Chess Club · San Francisco',
            uri: 'https://www.google.com/maps/search/?api=1&query=Mechanics+Institute+Chess+Club+San+Francisco',
            placeId: 'mechanics-sf',
          },
        ],
      });
    }
  });

  // 3. WebSocket Server for Real-Time Lobby Presence, Live Chat, and Direct Challenges
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function broadcastPresence() {
    const activePlayers = Array.from(connectedClients.values());
    const payload = JSON.stringify({
      type: 'presence:list',
      players: activePlayers,
    });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    // Send initial state immediately
    ws.send(
      JSON.stringify({
        type: 'init',
        messages: lobbyMessages.slice(-40),
        players: Array.from(connectedClients.values()),
      })
    );

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'user:join') {
          const player: OnlinePlayer = {
            id: String(data.id || 'guest-' + Math.random().toString(36).slice(2, 7)),
            name: String(data.name || 'Guest Player').slice(0, 40),
            elo: Number(data.elo) || 1200,
            titleBadge: String(data.titleBadge || 'CLUB'),
            status: data.status || 'online',
          };
          connectedClients.set(ws, player);
          broadcastPresence();
        } else if (data.type === 'chat:send') {
          const msg: LobbyMessage = {
            id: String(data.id || Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
            senderId: String(data.senderId || 'anon'),
            senderName: String(data.senderName || 'Player').slice(0, 40),
            senderTitle: String(data.senderTitle || 'CLUB'),
            senderElo: Number(data.senderElo) || 1200,
            text: String(data.text || '').trim().slice(0, 280),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            room: String(data.room || 'global'),
          };
          if (!msg.text) return;
          // Idempotency guard
          if (!lobbyMessages.some((m) => m.id === msg.id)) {
            lobbyMessages.push(msg);
            if (lobbyMessages.length > 100) lobbyMessages.shift();
          }
          const broadcast = JSON.stringify({ type: 'chat:message', message: msg });
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcast);
            }
          }
        } else if (data.type === 'challenge:send') {
          const challenge: ChallengeEvent = {
            id: String(data.id || 'chal-' + Date.now()),
            fromId: String(data.fromId),
            fromName: String(data.fromName),
            fromElo: Number(data.fromElo) || 1200,
            toId: String(data.toId),
            timeControl: String(data.timeControl || 'blitz_3'),
            matchId: String(data.matchId || ''),
          };
          const broadcast = JSON.stringify({ type: 'challenge:received', challenge });
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcast);
            }
          }
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      broadcastPresence();
    });
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Grandmaster Arena server running on http://localhost:${PORT}`);
  });
}

startServer();
