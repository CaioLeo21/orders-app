import { Router } from 'express';
import { getTenant } from '../../auth/middleware.js';
import { prisma } from '../../lib/prisma.js';
import { toUnitDto } from '../../lib/serializers.js';

// RN-U1: unidades não têm CRUD próprio; nascem quando um morador é salvo.
export const unitsRouter = Router();

/** Todas as unidades não excluídas do condomínio, sem paginação (são centenas, no máximo). */
unitsRouter.get('/units', async (req, res) => {
  const tenant = getTenant(req);
  const units = await prisma.unit.findMany({
    where: { condominiumId: tenant.condominiumId, deletedAt: null },
    orderBy: { id: 'asc' },
  });
  res.json(units.map((unit) => toUnitDto(unit, tenant.kind)));
});
