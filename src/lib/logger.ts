import { pino } from 'pino';
import { env } from '../config/env.js';

// Nunca registrar senha, senha provisória, token, telefone, documento ou imagem (handoff 9.2).
// O pino-http não loga corpos; o redact cobre cabeçalhos e objetos passados ao logger.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.temporaryPassword',
      '*.passwordHash',
      '*.phone',
      '*.collectedByDocument',
      '*.token',
    ],
    censor: '[redacted]',
  },
});
