import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const hospitalRoutes = Router();

hospitalRoutes.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM hospitals ORDER BY name');
  res.json(rows);
});

hospitalRoutes.post('/', requireAuth, async (req, res) => {
  const { name, address, timezone } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO hospitals (name, address, timezone) VALUES ($1, $2, $3) RETURNING *',
    [name, address, timezone ?? 'Europe/London']
  );
  res.status(201).json(rows[0]);
});
