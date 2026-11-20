import type { Condominium, RecordStatus, User } from '@prisma/client';
import { conflict, notFound } from '../../lib/errors.js';
import { generateTemporaryPassword, hashPassword } from '../../lib/password.js';
import { isUniqueViolation, prisma } from '../../lib/prisma.js';
import type { CondominiumInput } from './schemas.js';

const slugTaken = () => conflict('SLUG_TAKEN', 'Este endereço (slug) já está em uso por outro condomínio.');
const condominiumNotFound = () => notFound('Condomínio não encontrado.');

export interface CondominiumSummary {
  condominium: Condominium;
  unitCount: number;
  currentPlanId?: number;
}

/** unitCount (unidades não excluídas, RN-U4) e currentPlanId (plano da cobrança mais recente, RN-F7). */
async function summarize(condominiums: Condominium[]): Promise<CondominiumSummary[]> {
  const ids = condominiums.map((condominium) => condominium.id);
  if (!ids.length) return [];
  const [unitCounts, latestInvoices] = await Promise.all([
    prisma.unit.groupBy({ by: ['condominiumId'], where: { condominiumId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
    prisma.invoice.findMany({
      where: { condominiumId: { in: ids } },
      distinct: ['condominiumId'],
      orderBy: [{ condominiumId: 'asc' }, { competence: 'desc' }],
      select: { condominiumId: true, planId: true },
    }),
  ]);
  const units = new Map(unitCounts.map((row) => [row.condominiumId, row._count._all]));
  const plans = new Map(latestInvoices.map((row) => [row.condominiumId, row.planId]));
  return condominiums.map((condominium) => ({
    condominium,
    unitCount: units.get(condominium.id) ?? 0,
    currentPlanId: plans.get(condominium.id),
  }));
}

export async function listCondominiums(): Promise<CondominiumSummary[]> {
  return summarize(await prisma.condominium.findMany({ orderBy: { id: 'asc' } }));
}

export async function getCondominium(id: number): Promise<Condominium> {
  const condominium = await prisma.condominium.findUnique({ where: { id } });
  if (!condominium) throw condominiumNotFound();
  return condominium;
}

export async function getCondominiumSummary(id: number): Promise<CondominiumSummary> {
  const [summary] = await summarize([await getCondominium(id)]);
  return summary!;
}

export async function isSlugAvailable(slug: string, exceptId?: number): Promise<boolean> {
  const found = await prisma.condominium.findUnique({ where: { slug }, select: { id: true } });
  return !found || found.id === exceptId;
}

/** RN-C2: cria o condomínio e o primeiro admin na mesma transação. */
export async function createCondominium(
  input: CondominiumInput,
  adminName: string,
): Promise<{ summary: CondominiumSummary; admin: User; temporaryPassword: string }> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const { condominium, admin } = await prisma.$transaction(async (tx) => {
      const condominium = await tx.condominium.create({
        data: { name: input.name, type: input.type, slug: input.slug, address: input.address ?? null },
      });
      const admin = await tx.user.create({
        data: { name: adminName, profile: 'admin', condominiumId: condominium.id, passwordHash, mustChangePassword: true },
      });
      return { condominium, admin };
    });
    return { summary: { condominium, unitCount: 0 }, admin, temporaryPassword };
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) throw slugTaken();
    throw error;
  }
}

/** RN-C1 e RN-C3 (tipo imutável quando já há unidades). */
export async function updateCondominium(id: number, input: CondominiumInput): Promise<CondominiumSummary> {
  const current = await getCondominium(id);
  if (input.type !== current.type && (await prisma.unit.count({ where: { condominiumId: id } })) > 0) {
    throw conflict('TYPE_LOCKED', 'O tipo não pode mudar porque o condomínio já tem unidades cadastradas.');
  }
  try {
    await prisma.condominium.update({
      where: { id },
      data: { name: input.name, type: input.type, slug: input.slug, address: input.address ?? null },
    });
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) throw slugTaken();
    throw error;
  }
  return getCondominiumSummary(id);
}

/** RN-C4: inativo bloqueia login e requisições de todos os usuários (checado a cada requisição). */
export async function setCondominiumStatus(id: number, status: RecordStatus): Promise<CondominiumSummary> {
  await getCondominium(id);
  await prisma.condominium.update({ where: { id }, data: { status } });
  return getCondominiumSummary(id);
}
