import { Router } from 'express';
import { authenticate, getAuth } from '../../auth/middleware.js';
import { clearSessionCookie, setSessionCookie } from '../../auth/session.js';
import { toSessionDto } from '../../lib/serializers.js';
import { parse } from '../../lib/validation.js';
import { changePasswordSchema, loginSchema } from './schemas.js';
import * as service from './service.js';

export const authRouter = Router();

authRouter.post('/auth/login', async (req, res) => {
  const input = parse(loginSchema, req.body);
  const { user, condominium } = await service.login(input, req.ip ?? 'unknown');
  await setSessionCookie(res, user);
  res.json(toSessionDto(user, condominium));
});

authRouter.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', authenticate({ allowPasswordChange: true }), (req, res) => {
  const { user, condominium } = getAuth(req);
  res.json(toSessionDto(user, condominium));
});

authRouter.post('/auth/change-password', authenticate({ allowPasswordChange: true }), async (req, res) => {
  const auth = getAuth(req);
  const input = parse(changePasswordSchema, req.body);
  const user = await service.changePassword(auth.user, input);
  await setSessionCookie(res, user);
  res.json(toSessionDto(user, auth.condominium));
});
