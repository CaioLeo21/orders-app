import { Prisma } from '@prisma/client';
import type { TenantContext } from '../../auth/middleware.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import type { UnitKind } from '../../lib/format.js';
import { prisma } from '../../lib/prisma.js';
import { packageViewInclude, toPackageViewDto, type PackageViewDto, type PackageWithRelations } from '../../lib/serializers.js';
import { signedUrlOrUndefined } from '../../storage/index.js';
import { assertUploadKey } from '../uploads/service.js';
import type { ListPackagesQuery, NewPackageInput, PackageEditInput, PickupInput } from './schemas.js';

const packageNotFound = () => notFound('Encomenda não encontrada.');

export async function toView(pkg: PackageWithRelations, kind: UnitKind): Promise<PackageViewDto> {
  const [photoUrl, signatureUrl] = await Promise.all([signedUrlOrUndefined(pkg.photoKey), signedUrlOrUndefined(pkg.signatureKey)]);
  return toPackageViewDto(pkg, kind, { photoUrl, signatureUrl });
}

// ---------------------------------------------------------------------------
// Listagem (busca em SQL: unaccent + ILIKE sobre os mesmos campos que o front pesquisa)
// ---------------------------------------------------------------------------

/** formatUnit do front em SQL ("Bloco B · Apto 204", "Quadra 3 · Casa 12"…). */
function unitLabelSql(kind: UnitKind): Prisma.Sql {
  return kind === 'house'
    ? Prisma.sql`CASE WHEN c."quadra" IS NOT NULL THEN 'Quadra ' || c."quadra" || ' · Casa ' || c."casa"
        WHEN c."rua" IS NOT NULL THEN c."rua" || ' · Casa ' || c."casa" ELSE 'Casa ' || c."casa" END`
    : Prisma.sql`CASE WHEN c."bloco" IS NOT NULL THEN 'Bloco ' || c."bloco" || ' · Apto ' || c."apartamento"
        ELSE 'Apto ' || c."apartamento" END`;
}

/** unitCode do front em SQL ("B-204", "Q3-12"). */
function unitCodeSql(kind: UnitKind): Prisma.Sql {
  return kind === 'house'
    ? Prisma.sql`CASE WHEN c."quadra" IS NOT NULL THEN 'Q' || c."quadra" || '-' || c."casa" ELSE c."casa" END`
    : Prisma.sql`CASE WHEN c."bloco" IS NOT NULL THEN c."bloco" || '-' || c."apartamento" ELSE c."apartamento" END`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function rangeSql(column: string, from?: Date, to?: Date): Prisma.Sql {
  const col = Prisma.raw(column);
  const parts: Prisma.Sql[] = [];
  if (from) parts.push(Prisma.sql`${col} >= ${from}`);
  if (to) parts.push(Prisma.sql`${col} <= ${to}`);
  return Prisma.join(parts, ' AND ');
}

const FROM_SQL = Prisma.sql`
  FROM "encomenda" e
  JOIN "morador_casa" mc ON mc."id_morador_casa" = e."fk_id_morador_casa"
  JOIN "morador" m ON m."id_morador" = mc."fk_id_morador"
  JOIN "casa" c ON c."id_casa" = mc."fk_id_casa"
  JOIN "usuario" ur ON ur."matricula" = e."fk_usuario_matricula"
  LEFT JOIN "usuario" ud ON ud."matricula" = e."fk_usuario_retirada"`;

export interface PackageList {
  items: PackageViewDto[];
  total: number;
  page: number;
  pageSize: number;
  counts: { pending: number; collected: number };
}

/** GET /packages. `counts` respeita from/to/q, mas ignora status (alimenta as abas). */
export async function listPackages(tenant: TenantContext, query: ListPackagesQuery): Promise<PackageList> {
  const filters: Prisma.Sql[] = [Prisma.sql`e."fk_id_condominio" = ${tenant.condominiumId}`, Prisma.sql`e."deleted_at" IS NULL`];

  if (query.from || query.to) {
    filters.push(Prisma.sql`(
      (e."data_retirada" IS NULL AND ${rangeSql('e."data_chegada"', query.from, query.to)})
      OR (e."data_retirada" IS NOT NULL AND ${rangeSql('e."data_retirada"', query.from, query.to)})
    )`);
  }

  if (query.q) {
    const haystack = Prisma.sql`concat_ws(' ',
      e."remetente", e."codigo_rastreio", e."recebedor", m."nome", ur."nome", ud."nome",
      ${unitLabelSql(tenant.kind)}, ${unitCodeSql(tenant.kind)},
      '#' || lpad(e."id_encomenda"::text, 6, '0'))`;
    filters.push(Prisma.sql`unaccent(${haystack}) ILIKE unaccent(${`%${escapeLike(query.q)}%`})`);
  }

  const where = Prisma.join(filters, ' AND ');

  const [countRow] = await prisma.$queryRaw<{ pending: number; collected: number }[]>`
    SELECT COUNT(*) FILTER (WHERE e."data_retirada" IS NULL)::int AS pending,
           COUNT(*) FILTER (WHERE e."data_retirada" IS NOT NULL)::int AS collected
    ${FROM_SQL}
    WHERE ${where}`;
  const counts = { pending: countRow?.pending ?? 0, collected: countRow?.collected ?? 0 };

  const statusSql =
    query.status === 'pending' ? Prisma.sql`AND e."data_retirada" IS NULL`
    : query.status === 'collected' ? Prisma.sql`AND e."data_retirada" IS NOT NULL`
    : Prisma.empty;
  // Pendentes: as que esperam há mais tempo primeiro (decisão do produto, igual ao front);
  // retiradas: retirada mais recente primeiro.
  const orderSql =
    query.status === 'pending' ? Prisma.sql`e."data_chegada" ASC, e."id_encomenda" ASC`
    : query.status === 'collected' ? Prisma.sql`e."data_retirada" DESC, e."id_encomenda" DESC`
    : Prisma.sql`COALESCE(e."data_retirada", e."data_chegada") DESC, e."id_encomenda" DESC`;

  const offset = (query.page - 1) * query.pageSize;
  const idRows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT e."id_encomenda" AS id
    ${FROM_SQL}
    WHERE ${where} ${statusSql}
    ORDER BY ${orderSql}
    LIMIT ${query.pageSize} OFFSET ${offset}`;

  const ids = idRows.map((row) => row.id);
  const rows = ids.length ? await prisma.package.findMany({ where: { id: { in: ids } }, include: packageViewInclude }) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = await Promise.all(ids.map((id) => toView(byId.get(id)!, tenant.kind)));

  const total = query.status ? counts[query.status] : counts.pending + counts.collected;
  return { items, total, page: query.page, pageSize: query.pageSize, counts };
}

// ---------------------------------------------------------------------------
// Uma encomenda
// ---------------------------------------------------------------------------

/** Encomenda não excluída do condomínio do token; senão 404 (inclusive de outro tenant). */
export async function getPackage(tenant: TenantContext, id: number): Promise<PackageWithRelations> {
  const pkg = await prisma.package.findFirst({
    where: { id, condominiumId: tenant.condominiumId, deletedAt: null },
    include: packageViewInclude,
  });
  if (!pkg) throw packageNotFound();
  return pkg;
}

/** RN-E1/RN-E2/RN-E3. Data de chegada, quem registrou e o condomínio vêm do servidor. */
export async function createPackage(tenant: TenantContext, input: NewPackageInput): Promise<PackageWithRelations> {
  if (input.photoUrl) await assertUploadKey(input.photoUrl, tenant.condominiumId, 'package-photo');

  return prisma.$transaction(async (tx) => {
    const link = await tx.residentUnit.findUnique({
      where: { id: input.residentUnitId },
      include: { unit: true, resident: true },
    });
    // (b) vínculo de outro condomínio → 404, para não vazar a existência.
    if (!link || link.unit.condominiumId !== tenant.condominiumId) throw notFound('Destinatário não encontrado.');
    // (c) vínculo encerrado ou (d) morador inativo/excluído.
    if (link.endedAt || link.unit.deletedAt || link.resident.status !== 'active' || link.resident.deletedAt) {
      throw unprocessable('RECIPIENT_UNAVAILABLE', 'Este morador não está mais disponível para receber encomendas nesta unidade.');
    }

    return tx.package.create({
      data: {
        condominiumId: tenant.condominiumId,
        residentUnitId: link.id,
        senderCompany: input.senderCompany,
        trackingCode: input.trackingCode ?? null,
        kind: input.kind,
        size: input.size,
        notes: input.notes ?? null,
        photoKey: input.photoUrl ?? null,
        receivedAt: new Date(),
        receivedById: tenant.matricula,
      },
      include: packageViewInclude,
    });
  });
}

/** RN-E4: só remetente, rastreio, tipo, tamanho e observação. "" limpa rastreio/observação. */
export async function updatePackage(tenant: TenantContext, id: number, input: PackageEditInput): Promise<PackageWithRelations> {
  await getPackage(tenant, id);
  const data: Prisma.PackageUpdateInput = {};
  if (input.senderCompany !== undefined) data.senderCompany = input.senderCompany;
  if (input.trackingCode !== undefined) data.trackingCode = input.trackingCode || null;
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.size !== undefined) data.size = input.size;
  if (Object.keys(data).length) await prisma.package.update({ where: { id }, data });
  return getPackage(tenant, id);
}

/**
 * RN-E5: retirada atômica e idempotente contra corrida — o UPDATE só pega a linha se
 * ainda estiver pendente e não excluída. 0 linhas → 409 ALREADY_COLLECTED (ou 404).
 * GREATEST garante data_retirada >= data_chegada mesmo com relógios diferentes.
 */
export async function registerPickup(tenant: TenantContext, id: number, input: PickupInput): Promise<PackageWithRelations> {
  await assertUploadKey(input.signatureUrl, tenant.condominiumId, 'signature');

  const updated = await prisma.$executeRaw`
    UPDATE "encomenda"
       SET "data_retirada" = GREATEST(now(), "data_chegada"),
           "recebedor" = ${input.collectedBy},
           "documento_recebedor" = ${input.collectedByDocument ?? null},
           "link_assinatura" = ${input.signatureUrl},
           "fk_usuario_retirada" = ${tenant.matricula},
           "updated_at" = now()
     WHERE "id_encomenda" = ${id}
       AND "fk_id_condominio" = ${tenant.condominiumId}
       AND "data_retirada" IS NULL
       AND "deleted_at" IS NULL`;

  if (updated === 0) {
    const current = await prisma.package.findFirst({ where: { id, condominiumId: tenant.condominiumId } });
    if (!current || current.deletedAt) throw packageNotFound();
    throw conflict('ALREADY_COLLECTED', 'Esta encomenda já foi retirada.');
  }
  return getPackage(tenant, id);
}

/** RN-E7: soft delete com motivo, só manager/admin (checado na rota). */
export async function deletePackage(tenant: TenantContext, id: number, reason: string): Promise<void> {
  const { count } = await prisma.package.updateMany({
    where: { id, condominiumId: tenant.condominiumId, deletedAt: null },
    data: { deletedAt: new Date(), deletionReason: reason, deletedById: tenant.matricula },
  });
  if (count === 0) throw packageNotFound();
}
