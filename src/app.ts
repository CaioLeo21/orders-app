import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { authenticate, csrfGuard, requireProfile } from './auth/middleware.js';
import { DOORMAN_AREA, MANAGERS, OWNER } from './auth/permissions.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './lib/http.js';
import { logger } from './lib/logger.js';
import { adminRouter } from './modules/admin/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { docsRouter } from './modules/docs/routes.js';
import { filesRouter } from './modules/files/routes.js';
import { packagesRouter } from './modules/packages/routes.js';
import { residentsRouter } from './modules/residents/routes.js';
import { unitsRouter } from './modules/units/routes.js';
import { uploadsRouter } from './modules/uploads/routes.js';
import { usersRouter } from './modules/users/routes.js';

function trustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', trustProxy(env.TRUST_PROXY));

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin: env.FRONTEND_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
      maxAge: 600,
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/health' } }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use(filesRouter);
  if (env.NODE_ENV !== 'production') api.use(docsRouter);

  api.use(csrfGuard);
  api.use(authRouter);

  // Escopo por perfil (seção 7). O condomínio vem sempre do token.
  api.use(['/packages', '/units', '/residents', '/uploads'], authenticate(), requireProfile(...DOORMAN_AREA));
  api.use('/users', authenticate(), requireProfile(...MANAGERS));
  api.use('/admin', authenticate(), requireProfile(...OWNER));
  api.use(packagesRouter, unitsRouter, residentsRouter, uploadsRouter, usersRouter, adminRouter);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
