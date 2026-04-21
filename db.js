'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // Required for Supabase
});

/* ── Auto-create table on first deploy ─────────────────────────── */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id          SERIAL PRIMARY KEY,
      player_name VARCHAR(50)  NOT NULL,
      game        VARCHAR(20)  NOT NULL,
      score       INTEGER      NOT NULL DEFAULT 0,
      correct     INTEGER      NOT NULL DEFAULT 0,
      total       INTEGER      NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_scores_game       ON scores (game);
    CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores (game, score DESC);
    CREATE INDEX IF NOT EXISTS idx_scores_created    ON scores (created_at DESC);
  `);
  console.log('[DB] Schema ready');
}

/* ── Insert one score attempt ───────────────────────────────────── */
async function insertScore({ player_name, game, score, correct, total }) {
  const { rows } = await pool.query(
    `INSERT INTO scores (player_name, game, score, correct, total)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [player_name.slice(0, 50), game, score, correct || 0, total || 0]
  );
  return rows[0];
}

/* ── Best score per player for a given game ─────────────────────── */
async function getLeaderboard(game, limit = 25) {
  if (game === 'all') {
    const { rows } = await pool.query(
      `SELECT player_name, game, MAX(score) AS score,
              MAX(correct) AS correct, MAX(total) AS total,
              MAX(created_at) AS created_at
       FROM scores
       GROUP BY player_name, game
       ORDER BY score DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  /* DISTINCT ON keeps only the highest-score row per player */
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (player_name)
            player_name, game, score, correct, total, created_at
     FROM   scores
     WHERE  game = $1
     ORDER  BY player_name, score DESC`,
    [game]
  );

  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ── Admin stats ────────────────────────────────────────────────── */
async function getStats() {
  const [perGame, totals, topScore, recent, weekly] = await Promise.all([
    pool.query(`
      SELECT game,
             COUNT(*)                          AS total_submissions,
             COUNT(DISTINCT player_name)        AS unique_players,
             MAX(score)                         AS high_score,
             ROUND(AVG(score)::numeric, 0)      AS avg_score,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS today_count
      FROM   scores
      GROUP  BY game
      ORDER  BY game
    `),
    pool.query(`
      SELECT COUNT(*)                           AS total_submissions,
             COUNT(DISTINCT player_name)         AS total_players,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS today_count
      FROM   scores
    `),
    pool.query(`
      SELECT player_name, game, score
      FROM   scores
      ORDER  BY score DESC
      LIMIT  1
    `),
    pool.query(`
      SELECT player_name, game, score, correct, total, created_at
      FROM   scores
      ORDER  BY created_at DESC
      LIMIT  20
    `),
    pool.query(`
      SELECT TO_CHAR(DATE(created_at AT TIME ZONE 'UTC'), 'Mon DD') AS day,
             COUNT(*) AS submissions
      FROM   scores
      WHERE  created_at > NOW() - INTERVAL '7 days'
      GROUP  BY DATE(created_at AT TIME ZONE 'UTC'), day
      ORDER  BY DATE(created_at AT TIME ZONE 'UTC')
    `)
  ]);

  return {
    byGame:   perGame.rows,
    totals:   totals.rows[0],
    topScore: topScore.rows[0] || null,
    recent:   recent.rows,
    weekly:   weekly.rows
  };
}

module.exports = { initDB, insertScore, getLeaderboard, getStats };
