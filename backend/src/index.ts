import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { hospitalRoutes } from './routes/hospitals';
import { floorRoutes } from './routes/floors';
import { locationRoutes } from './routes/locations';
import { qrCodeRoutes } from './routes/qrCodes';
import { routeRoutes } from './routes/routes';
import { sessionRoutes } from './routes/sessions';
import { authRoutes } from './routes/auth';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/qr-codes', qrCodeRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/sessions', sessionRoutes);

app.listen(PORT, () => {
  console.log(`Wayfinder API running on port ${PORT}`);
});
