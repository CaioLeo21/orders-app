import { Router } from 'express';
import { getTenant } from '../../auth/middleware.js';
import { toUserDto } from '../../lib/serializers.js';
import { parse, parseId } from '../../lib/validation.js';
import { userInputSchema, userStatusSchema } from './schemas.js';
import * as service from './service.js';

// Equipe do condomínio. Só manager e admin (checado ao montar o router).
export const usersRouter = Router();

usersRouter.get('/users', async (req, res) => {
  res.json((await service.listUsers(getTenant(req))).map(toUserDto));
});

usersRouter.post('/users', async (req, res) => {
  const { user, temporaryPassword } = await service.createUser(getTenant(req), parse(userInputSchema, req.body));
  res.status(201).json({ user: toUserDto(user), temporaryPassword });
});

usersRouter.put('/users/:matricula', async (req, res) => {
  const tenant = getTenant(req);
  const matricula = parseId(req.params.matricula);
  await service.getUser(tenant, matricula);
  res.json(toUserDto(await service.updateUser(tenant, matricula, parse(userInputSchema, req.body))));
});

usersRouter.patch('/users/:matricula/status', async (req, res) => {
  const tenant = getTenant(req);
  const matricula = parseId(req.params.matricula);
  await service.getUser(tenant, matricula);
  const { status } = parse(userStatusSchema, req.body);
  res.json(toUserDto(await service.setUserStatus(tenant, matricula, status)));
});

usersRouter.post('/users/:matricula/reset-password', async (req, res) => {
  const temporaryPassword = await service.resetUserPassword(getTenant(req), parseId(req.params.matricula));
  res.json({ temporaryPassword });
});
