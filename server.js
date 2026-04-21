'use strict';
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');
const { initDB, insertScore, getLeaderboard, getStats } = require('./db');

/* ── Config ─────────────────────────────────────────────────────── */
const PORT       = process.env.PORT       || 3000;
const ADMIN_KEY  = process.env.ADMIN_KEY  || 'netlearn2024';
const FRONTEND   = process.env.FRONTEND_URL || '*';

/* ── Express + Socket.IO ────────────────────────────────────────── */
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── Helper: authenticate admin key ─────────────────────────────── */
function requireAdmin(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

/* ══════════════════════════════════════════════════════════════════
   SCORE ROUTES
══════════════════════════════════════════════════════════════════ */

/* POST /api/scores — submit a new score */
app.post('/api/scores', async (req, res) => {
  try {
    const { player_name, game, score, correct, total } = req.body;
    if (!player_name || !game) {
      return res.status(400).json({ error: 'player_name and game are required' });
    }
    const validGames = ['time_attack', 'quiz', 'ip_class'];
    if (!validGames.includes(game)) {
      return res.status(400).json({ error: 'Invalid game. Must be: ' + validGames.join(', ') });
    }

    const entry = await insertScore({
      player_name: player_name.toString().trim(),
      game,
      score:   Math.max(0, parseInt(score)   || 0),
      correct: Math.max(0, parseInt(correct) || 0),
      total:   Math.max(0, parseInt(total)   || 0)
    });

    /* Broadcast updated leaderboard to all connected clients */
    const leaderboard = await getLeaderboard(game);
    io.emit('leaderboard_update', { game, entries: leaderboard });

    /* Broadcast to admin live feed */
    io.emit('admin_feed', {
      player_name: entry.player_name,
      game:        entry.game,
      score:       entry.score,
      correct:     entry.correct,
      total:       entry.total,
      created_at:  entry.created_at
    });

    res.json({ ok: true, entry });
  } catch (err) {
    console.error('[POST /api/scores]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /api/leaderboard/:game — top scores for a game */
app.get('/api/leaderboard/:game', async (req, res) => {
  try {
    const entries = await getLeaderboard(req.params.game);
    res.json(entries);
  } catch (err) {
    console.error('[GET /api/leaderboard]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /api/leaderboard — all games combined (requires admin key) */
app.get('/api/leaderboard', requireAdmin, async (req, res) => {
  try {
    const entries = await getLeaderboard('all');
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   ADMIN ROUTES
══════════════════════════════════════════════════════════════════ */

/* GET /api/admin/verify — check if admin key is valid */
app.get('/api/admin/verify', (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  if (key === ADMIN_KEY) return res.json({ ok: true });
  res.status(401).json({ error: 'Invalid key' });
});

/* GET /api/admin/stats — full stats (protected) */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    console.error('[GET /api/admin/stats]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /admin — serve admin dashboard */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/* ══════════════════════════════════════════════════════════════════
   HEALTH CHECK
══════════════════════════════════════════════════════════════════ */
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

/* ══════════════════════════════════════════════════════════════════
   SOCKET.IO
══════════════════════════════════════════════════════════════════ */
let connectedCount = 0;   // all socket connections (admin + players)
let playerCount    = 0;   // only verified NetLearn Platform players
const playerSockets = new Set();

io.on('connection', (socket) => {
  connectedCount++;
  io.emit('connection_count', connectedCount);
  console.log(`[Socket] Client connected: ${socket.id} (total: ${connectedCount})`);

  /* ── Player join — emitted by the NetLearn Platform on page load ── */
  socket.on('player_join', () => {
    if (!playerSockets.has(socket.id)) {
      playerSockets.add(socket.id);
      playerCount++;
      io.emit('player_count', playerCount);
      console.log(`[Socket] Player joined: ${socket.id} (players: ${playerCount})`);
    }
  });

  socket.on('disconnect', () => {
    connectedCount = Math.max(0, connectedCount - 1);
    io.emit('connection_count', connectedCount);

    if (playerSockets.has(socket.id)) {
      playerSockets.delete(socket.id);
      playerCount = Math.max(0, playerCount - 1);
      io.emit('player_count', playerCount);
      console.log(`[Socket] Player left: ${socket.id} (players: ${playerCount})`);
    } else {
      console.log(`[Socket] Client disconnected: ${socket.id} (total: ${connectedCount})`);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════
   STARTUP
══════════════════════════════════════════════════════════════════ */
(async () => {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`\n🚀 NetLearn backend running on port ${PORT}`);
      console.log(`   Admin dashboard → http://localhost:${PORT}/admin`);
      console.log(`   Admin key       → ${ADMIN_KEY}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
