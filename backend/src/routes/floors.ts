import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const floorRoutes = Router();

floorRoutes.get('/', async (req, res) => {
  const { hospital_id } = req.query;
  const { rows } = await pool.query(
    'SELECT * FROM floors WHERE hospital_id = $1 ORDER BY floor_number',
    [hospital_id]
  );
  res.json(rows);
});

floorRoutes.post('/', requireAuth, async (req, res) => {
  const { hospital_id, floor_number, floor_name, map_image_url, map_bounds } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO floors (hospital_id, floor_number, floor_name, map_image_url, map_bounds)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [hospital_id, floor_number, floor_name, map_image_url, JSON.stringify(map_bounds)]
  );
  res.status(201).json(rows[0]);
});

floorRoutes.put('/:id', requireAuth, async (req, res) => {
  const { map_image_url, map_bounds } = req.body;
  const { rows } = await pool.query(
    'UPDATE floors SET map_image_url = $1, map_bounds = $2 WHERE id = $3 RETURNING *',
    [map_image_url, JSON.stringify(map_bounds), req.params.id]
  );
  res.json(rows[0]);
});
