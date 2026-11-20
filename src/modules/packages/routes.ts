import { Router, type Request, type Response } from 'express';
import { getTenant, requireProfile } from '../../auth/middleware.js';
import { MANAGERS } from '../../auth/permissions.js';
import { parse, parseId } from '../../lib/validation.js';
import { deletePackageSchema, listPackagesQuerySchema, newPackageSchema, packageEditSchema, pickupSchema } from './schemas.js';
import * as service from './service.js';

export const packagesRouter = Router();

packagesRouter.get('/packages', async (req, res) => {
  res.json(await service.listPackages(getTenant(req), parse(listPackagesQuerySchema, req.query)));
});

packagesRouter.get('/packages/:id', async (req, res) => {
  const tenant = getTenant(req);
  res.json(await service.toView(await service.getPackage(tenant, parseId(req.params.id)), tenant.kind));
});

packagesRouter.post('/packages', async (req, res) => {
  const tenant = getTenant(req);
  const pkg = await service.createPackage(tenant, parse(newPackageSchema, req.body));
  res.status(201).json(await service.toView(pkg, tenant.kind));
});

packagesRouter.patch('/packages/:id', async (req, res) => {
  const tenant = getTenant(req);
  const id = parseId(req.params.id);
  await service.getPackage(tenant, id);
  const pkg = await service.updatePackage(tenant, id, parse(packageEditSchema, req.body));
  res.json(await service.toView(pkg, tenant.kind));
});

packagesRouter.post('/packages/:id/pickup', async (req, res) => {
  const tenant = getTenant(req);
  const id = parseId(req.params.id);
  await service.getPackage(tenant, id);
  const pkg = await service.registerPickup(tenant, id, parse(pickupSchema, req.body));
  res.json(await service.toView(pkg, tenant.kind));
});

async function remove(req: Request, res: Response) {
  const tenant = getTenant(req);
  const id = parseId(req.params.id);
  await service.getPackage(tenant, id);
  const { reason } = parse(deletePackageSchema, req.body);
  await service.deletePackage(tenant, id, reason);
  res.status(204).end();
}

packagesRouter.delete('/packages/:id', requireProfile(...MANAGERS), remove);
/** Alias para proxies que descartam o corpo do DELETE. */
packagesRouter.post('/packages/:id/delete', requireProfile(...MANAGERS), remove);
