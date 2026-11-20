import type { Prisma, Resident, ResidentUnit, Unit } from '@prisma/client';
import type { TenantContext } from '../../auth/middleware.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { unitKey, type UnitKind } from '../../lib/format.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import type { ResidentInput, UnitInput } from './schemas.js';

export type ResidentWithLinks = Resident & { units: ResidentUnit[] };

interface NormalizedUnit {
  key: string;
  group: string | null;
  number: string;
  street: string | null;
}

/** RN-U2/RN-M1: descarta linhas sem número, remove duplicatas pela chave. */
function normalizeUnits(inputs: UnitInput[]): NormalizedUnit[] {
  const byKey = new Map<string, NormalizedUnit>();
  for (const input of inputs) {
    const number = input.number.trim();
    if (!number) continue;
    const group = input.group?.trim() || null;
    const key = unitKey(group, number);
    if (!byKey.has(key)) byKey.set(key, { key, group, number, street: input.street?.trim() || null });
  }
  return [...byKey.values()];
}

/** RN-U3: as colunas usadas dependem do tipo do condomínio. */
function unitColumns(condominiumId: number, kind: UnitKind, unit: NormalizedUnit): Prisma.UnitCreateManyInput {
  return kind === 'house'
    ? { condominiumId, key: unit.key, lot: unit.group, house: unit.number, street: unit.street }
    : { condominiumId, key: unit.key, block: unit.group, apartment: unit.number };
}

/**
 * RN-U1: acha ou cria cada unidade por (condomínio, chave). O ON CONFLICT DO NOTHING
 * é seguro contra corrida e não sobrescreve a rua de uma casa já existente.
 */
async function ensureUnits(tx: Tx, tenant: TenantContext, units: NormalizedUnit[]): Promise<Unit[]> {
  await tx.unit.createMany({ data: units.map((unit) => unitColumns(tenant.condominiumId, tenant.kind, unit)), skipDuplicates: true });
  const rows = await tx.unit.findMany({ where: { condominiumId: tenant.condominiumId, key: { in: units.map((unit) => unit.key) } } });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return units.map((unit) => byKey.get(unit.key)!);
}

/**
 * RN-M2: sincroniza os vínculos com a lista completa de unidades. Reabre os encerrados
 * que voltaram, cria os novos e, para os que saíram, encerra (se há encomenda apontando,
 * mesmo excluída) ou apaga.
 */
async function syncLinks(tx: Tx, residentId: number, unitIds: number[]): Promise<void> {
  const links = await tx.residentUnit.findMany({ where: { residentId } });

  for (const unitId of unitIds) {
    const link = links.find((item) => item.unitId === unitId);
    if (!link) await tx.residentUnit.create({ data: { residentId, unitId } });
    else if (link.endedAt) await tx.residentUnit.update({ where: { id: link.id }, data: { endedAt: null } });
  }

  const removed = links.filter((link) => !link.endedAt && !unitIds.includes(link.unitId)).map((link) => link.id);
  if (!removed.length) return;
  const withPackages = await tx.package.groupBy({ by: ['residentUnitId'], where: { residentUnitId: { in: removed } } });
  const keep = new Set(withPackages.map((row) => row.residentUnitId));
  const toEnd = removed.filter((linkId) => keep.has(linkId));
  const toDelete = removed.filter((linkId) => !keep.has(linkId));
  if (toEnd.length) await tx.residentUnit.updateMany({ where: { id: { in: toEnd } }, data: { endedAt: new Date() } });
  if (toDelete.length) await tx.residentUnit.deleteMany({ where: { id: { in: toDelete } } });
}

export async function listResidents(tenant: TenantContext): Promise<ResidentWithLinks[]> {
  return prisma.resident.findMany({
    where: { condominiumId: tenant.condominiumId, deletedAt: null },
    include: { units: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

/** Cria (id = null) ou substitui um morador e suas unidades, numa transação. */
export async function saveResident(
  tenant: TenantContext,
  id: number | null,
  input: ResidentInput,
): Promise<{ resident: ResidentWithLinks; units: Unit[] }> {
  const units = normalizeUnits(input.units);
  if (!units.length) {
    throw unprocessable('RESIDENT_NEEDS_UNIT', 'Informe pelo menos uma unidade.', { units: 'Informe pelo menos uma unidade.' });
  }

  const fields = {
    name: input.name,
    phone: input.phone || null,
    residentType: input.residentType,
    // RN-M3: a descrição só vale para o tipo "other".
    residentTypeDescription: input.residentType === 'other' ? (input.residentTypeDescription ?? null) : null,
  };

  return prisma.$transaction(async (tx) => {
    if (id !== null) {
      const existing = await tx.resident.findFirst({ where: { id, condominiumId: tenant.condominiumId, deletedAt: null } });
      if (!existing) throw notFound('Morador não encontrado.');
    }
    const unitRows = await ensureUnits(tx, tenant, units);
    const unitIds = unitRows.map((unit) => unit.id);

    const saved =
      id === null
        ? await tx.resident.create({ data: { ...fields, condominiumId: tenant.condominiumId } })
        : await tx.resident.update({ where: { id }, data: fields });

    await syncLinks(tx, saved.id, unitIds);

    const resident = await tx.resident.findUniqueOrThrow({ where: { id: saved.id }, include: { units: true } });
    const activeUnitIds = resident.units.filter((link) => !link.endedAt).map((link) => link.unitId);
    const current = await tx.unit.findMany({ where: { id: { in: activeUnitIds }, deletedAt: null }, orderBy: { id: 'asc' } });
    return { resident, units: current };
  });
}

/** Morador não excluído do condomínio do token; senão 404 (inclusive de outro tenant). */
export async function getResident(tenant: TenantContext, id: number): Promise<Resident> {
  const resident = await prisma.resident.findFirst({ where: { id, condominiumId: tenant.condominiumId, deletedAt: null } });
  if (!resident) throw notFound('Morador não encontrado.');
  return resident;
}

export async function setResidentStatus(tenant: TenantContext, id: number, status: Resident['status']): Promise<ResidentWithLinks> {
  await getResident(tenant, id);
  return prisma.resident.update({ where: { id }, data: { status }, include: { units: true } });
}

/** RN-M5: soft delete. Os vínculos ficam (o histórico de encomendas depende deles). */
export async function deleteResident(tenant: TenantContext, id: number): Promise<void> {
  await getResident(tenant, id);
  await prisma.resident.update({ where: { id }, data: { deletedAt: new Date(), status: 'inactive' } });
}
