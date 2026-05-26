import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';

export const authRoutes = Router();

authRoutes.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const { rows } = await pool.query(
    'SELECT id, password_hash FROM admin_users WHERE email = $1',
    [email]
  );
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({ token });
});
