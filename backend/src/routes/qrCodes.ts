import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const qrCodeRoutes = Router();

qrCodeRoutes.get('/', requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT qr.*, row_to_json(loc) as location
     FROM qr_codes qr
     JOIN locations loc ON loc.id = qr.location_id
     ORDER BY qr.created_at DESC`
  );
  res.json(rows);
});

qrCodeRoutes.get('/scan/:codeUuid', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT qr.*, row_to_json(loc) as location
     FROM qr_codes qr
     JOIN locations loc ON loc.id = qr.location_id
     WHERE qr.code_uuid = $1`,
    [req.params.codeUuid]
  );
  if (!rows[0]) { res.status(404).json({ error: 'QR code not found' }); return; }
  res.json(rows[0]);
});

qrCodeRoutes.post('/', requireAuth, async (req, res) => {
  const { location_id } = req.body;
  const codeUuid = uuidv4();
  const { rows } = await pool.query(
    `INSERT INTO qr_codes (code_uuid, location_id) VALUES ($1, $2)
     RETURNING *, (SELECT row_to_json(loc) FROM locations loc WHERE loc.id = location_id) as location`,
    [codeUuid, location_id]
  );
  res.status(201).json(rows[0]);
});

qrCodeRoutes.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM qr_codes WHERE id = $1', [req.params.id]);
  res.status(204).send();
});
