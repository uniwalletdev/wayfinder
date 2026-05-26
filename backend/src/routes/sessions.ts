import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const sessionRoutes = Router();

sessionRoutes.post('/', async (req, res) => {
  const { qr_code_id, destination_location_id } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO navigation_sessions (qr_code_id, destination_location_id) VALUES ($1, $2) RETURNING *',
    [qr_code_id, destination_location_id]
  );
  res.status(201).json(rows[0]);
});

sessionRoutes.patch('/:id/complete', async (req, res) => {
  const { route_taken } = req.body;
  const { rows } = await pool.query(
    'UPDATE navigation_sessions SET completed_at = now(), route_taken = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(route_taken ?? []), req.params.id]
  );
  res.json(rows[0]);
});

sessionRoutes.get('/stats', requireAuth, async (_req, res) => {
  const { rows: summary } = await pool.query(`
    SELECT
      COUNT(*) as total_sessions,
      COUNT(completed_at) as completed_sessions,
      ROUND(COUNT(completed_at)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as completion_rate
    FROM navigation_sessions
    WHERE started_at > now() - interval '30 days'
  `);

  const { rows: daily } = await pool.query(`
    SELECT
      started_at::date as date,
      COUNT(*) as sessions,
      COUNT(completed_at) as completions
    FROM navigation_sessions
    WHERE started_at > now() - interval '7 days'
    GROUP BY started_at::date
    ORDER BY date
  `);

  res.json({ summary: summary[0], daily });
});
