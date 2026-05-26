import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const routeRoutes = Router();

routeRoutes.get('/', async (req, res) => {
  const { start_location_id, end_location_id, accessible } = req.query;
  const { rows } = await pool.query(
    `SELECT * FROM routes
     WHERE start_location_id = $1
       AND end_location_id = $2
       AND is_accessible = $3`,
    [start_location_id, end_location_id, accessible === 'true']
  );
  res.json(rows[0] ?? null);
});

routeRoutes.post('/', requireAuth, async (req, res) => {
  const { floor_id, start_location_id, end_location_id, path_coordinates, is_accessible, estimated_time_seconds, instructions } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO routes (floor_id, start_location_id, end_location_id, path_coordinates, is_accessible, estimated_time_seconds, instructions)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [floor_id, start_location_id, end_location_id, JSON.stringify(path_coordinates), is_accessible ?? false, estimated_time_seconds ?? 120, JSON.stringify(instructions ?? [])]
  );
  res.status(201).json(rows[0]);
});
