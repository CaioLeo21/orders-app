import { Router } from 'express';
import { getTenant, requireProfile } from '../../auth/middleware.js';
import { MANAGERS } from '../../auth/permissions.js';
import { toResidentWithLinksDto, toUnitDto } from '../../lib/serializers.js';
import { parse, parseId } from '../../lib/validation.js';
import { residentInputSchema, residentStatusSchema } from './schemas.js';
import * as service from './service.js';

export const residentsRouter = Router();

/** Sem os excluídos; inclui inativos; vínculos encerrados vêm com endedAt. */
residentsRouter.get('/residents', async (req, res) => {
  const residents = await service.listResidents(getTenant(req));
  res.json(residents.map(toResidentWithLinksDto));
});

residentsRouter.post('/residents', requireProfile(...MANAGERS), async (req, res) => {
  const tenant = getTenant(req);
  const { resident, units } = await service.saveResident(tenant, null, parse(residentInputSchema, req.body));
  res.status(201).json({ resident: toResidentWithLinksDto(resident), units: units.map((unit) => toUnitDto(unit, tenant.kind)) });
});

residentsRouter.put('/residents/:id', requireProfile(...MANAGERS), async (req, res) => {
  const tenant = getTenant(req);
  const id = parseId(req.params.id);
  await service.getResident(tenant, id);
  const { resident, units } = await service.saveResident(tenant, id, parse(residentInputSchema, req.body));
  res.json({ resident: toResidentWithLinksDto(resident), units: units.map((unit) => toUnitDto(unit, tenant.kind)) });
});

residentsRouter.patch('/residents/:id/status', requireProfile(...MANAGERS), async (req, res) => {
  const tenant = getTenant(req);
  const id = parseId(req.params.id);
  await service.getResident(tenant, id);
  const { status } = parse(residentStatusSchema, req.body);
  res.json(toResidentWithLinksDto(await service.setResidentStatus(tenant, id, status)));
});

residentsRouter.delete('/residents/:id', requireProfile(...MANAGERS), async (req, res) => {
  await service.deleteResident(getTenant(req), parseId(req.params.id));
  res.status(204).end();
});
