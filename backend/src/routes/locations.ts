import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const locationRoutes = Router();

locationRoutes.get('/', async (req, res) => {
  const { floor_id, type, search } = req.query;
  let query = 'SELECT * FROM locations WHERE 1=1';
  const params: unknown[] = [];

  if (floor_id) { params.push(floor_id); query += ` AND floor_id = $${params.length}`; }
  if (type) { params.push(type); query += ` AND type = $${params.length}`; }
  if (search) { params.push(`%${search}%`); query += ` AND name ILIKE $${params.length}`; }

  query += ' ORDER BY name';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

locationRoutes.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(rows[0]);
});

locationRoutes.post('/', requireAuth, async (req, res) => {
  const { floor_id, name, description, type, coordinates, accessibility_features, is_accessible } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO locations (floor_id, name, description, type, coordinates, accessibility_features, is_accessible)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [floor_id, name, description, type, JSON.stringify(coordinates), accessibility_features ?? [], is_accessible ?? true]
  );
  res.status(201).json(rows[0]);
});

locationRoutes.put('/:id', requireAuth, async (req, res) => {
  const { name, description, type, coordinates, accessibility_features, is_accessible } = req.body;
  const { rows } = await pool.query(
    `UPDATE locations SET name=$1, description=$2, type=$3, coordinates=$4,
     accessibility_features=$5, is_accessible=$6 WHERE id=$7 RETURNING *`,
    [name, description, type, JSON.stringify(coordinates), accessibility_features, is_accessible, req.params.id]
  );
  res.json(rows[0]);
});

locationRoutes.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
  res.status(204).send();
});
