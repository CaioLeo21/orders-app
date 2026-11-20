import { Prisma } from '@prisma/client';
import type { Condominium, Invoice, PackageKind, PackageSize, Plan, Resident, ResidentUnit, Unit, User } from '@prisma/client';
import { invoiceStatus, planStatus, toCompetence, toYmd, todayYmd, type InvoiceStatus, type PlanStatus } from './dates.js';
import { formatUnit, maskPhone, packageCode, type UnitKind } from './format.js';

// Serializer central (handoff 8.1): ids em string, instantes em ISO UTC, datas "YYYY-MM-DD",
// competência "YYYY-MM", dinheiro em number e campos opcionais vazios OMITIDOS (nunca null).
// Exceções do Anexo A: User.condominiumId sai null para o owner; Resident.phone sai "" quando vazio.
// Os tipos abaixo são o contrato do front (condo-order-hub/src/types).

const id = (value: number) => String(value);
const iso = (value: Date) => value.toISOString();
const optIso = (value: Date | null) => (value ? value.toISOString() : undefined);
const opt = <T>(value: T | null | undefined): T | undefined => value ?? undefined;
export const decimalToNumber = (value: Prisma.Decimal) => Number(value.toFixed(2));

/** Remove as chaves undefined, para o objeto comparar e serializar sem buracos. */
function compact<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) if (value[key] === undefined) delete value[key];
  return value;
}

// ---------------------------------------------------------------------------
// Usuário e condomínio
// ---------------------------------------------------------------------------

export interface UserDto {
  matricula: string;
  name: string;
  profile: User['profile'];
  shift?: NonNullable<User['shift']>;
  status: User['status'];
  condominiumId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toUserDto(user: User): UserDto {
  return compact({
    matricula: id(user.matricula),
    name: user.name,
    profile: user.profile,
    shift: opt(user.shift),
    status: user.status,
    condominiumId: user.condominiumId === null ? null : id(user.condominiumId),
    mustChangePassword: user.mustChangePassword,
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),
    deletedAt: optIso(user.deletedAt),
  });
}

export interface CondominiumDto {
  id: string;
  name: string;
  type: Condominium['type'];
  slug: string;
  status: Condominium['status'];
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export function toCondominiumDto(condominium: Condominium): CondominiumDto {
  return compact({
    id: id(condominium.id),
    name: condominium.name,
    type: condominium.type,
    slug: condominium.slug,
    status: condominium.status,
    address: opt(condominium.address),
    createdAt: iso(condominium.createdAt),
    updatedAt: iso(condominium.updatedAt),
  });
}

export interface AdminCondominiumDto extends CondominiumDto {
  unitCount: number;
  currentPlanId?: string;
}

export function toAdminCondominiumDto(condominium: Condominium, unitCount: number, currentPlanId?: number): AdminCondominiumDto {
  return compact({
    ...toCondominiumDto(condominium),
    unitCount,
    currentPlanId: currentPlanId === undefined ? undefined : id(currentPlanId),
  });
}

/** Corpo de /auth/login, /me e /auth/change-password. `condominium` omitido para o owner. */
export function toSessionDto(user: User, condominium: Condominium | null) {
  return compact({ user: toUserDto(user), condominium: condominium ? toCondominiumDto(condominium) : undefined });
}

// ---------------------------------------------------------------------------
// Unidade e morador
// ---------------------------------------------------------------------------

export interface UnitDto {
  id: string;
  condominiumId: string;
  kind: UnitKind;
  block?: string;
  apartment?: string;
  lot?: string;
  house?: string;
  street?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toUnitDto(unit: Unit, kind: UnitKind): UnitDto {
  return compact({
    id: id(unit.id),
    condominiumId: id(unit.condominiumId),
    kind,
    block: opt(unit.block),
    apartment: opt(unit.apartment),
    lot: opt(unit.lot),
    house: opt(unit.house),
    street: opt(unit.street),
    createdAt: iso(unit.createdAt),
    updatedAt: iso(unit.updatedAt),
    deletedAt: optIso(unit.deletedAt),
  });
}

export interface ResidentUnitDto {
  id: string;
  residentId: string;
  unitId: string;
  endedAt?: string;
}

export function toResidentUnitDto(link: ResidentUnit): ResidentUnitDto {
  return compact({ id: id(link.id), residentId: id(link.residentId), unitId: id(link.unitId), endedAt: optIso(link.endedAt) });
}

export interface ResidentDto {
  id: string;
  condominiumId: string;
  name: string;
  phone: string;
  residentType: Resident['residentType'];
  residentTypeDescription?: string;
  status: Resident['status'];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ResidentWithLinksDto extends ResidentDto {
  links: ResidentUnitDto[];
}

export function toResidentDto(resident: Resident): ResidentDto {
  return compact({
    id: id(resident.id),
    condominiumId: id(resident.condominiumId),
    name: resident.name,
    phone: resident.phone ? maskPhone(resident.phone) : '',
    residentType: resident.residentType,
    residentTypeDescription: opt(resident.residentTypeDescription),
    status: resident.status,
    createdAt: iso(resident.createdAt),
    updatedAt: iso(resident.updatedAt),
    deletedAt: optIso(resident.deletedAt),
  });
}

export function toResidentWithLinksDto(resident: Resident & { units: ResidentUnit[] }): ResidentWithLinksDto {
  const links = [...resident.units].sort((a, b) => a.id - b.id).map(toResidentUnitDto);
  return { ...toResidentDto(resident), links };
}

// ---------------------------------------------------------------------------
// Encomenda
// ---------------------------------------------------------------------------

export const packageViewInclude = {
  residentUnit: { include: { resident: true, unit: true } },
  receivedBy: { select: { name: true } },
  deliveredBy: { select: { name: true } },
} satisfies Prisma.PackageInclude;

export type PackageWithRelations = Prisma.PackageGetPayload<{ include: typeof packageViewInclude }>;

export interface PackageViewDto {
  id: string;
  code: string;
  status: 'pending' | 'collected';
  condominiumId: string;
  residentUnitId: string;
  unitId: string;
  residentId: string;
  recipientName: string;
  recipientUnit: string;
  senderCompany: string;
  trackingCode?: string;
  kind: PackageKind;
  size: PackageSize;
  notes?: string;
  photoUrl?: string;
  receivedAt: string;
  receivedBy: string;
  receivedByName: string;
  collectedAt?: string;
  collectedBy?: string;
  collectedByDocument?: string;
  signatureUrl?: string;
  deliveredBy?: string;
  deliveredByName?: string;
  createdAt: string;
  updatedAt: string;
}

/** `urls` são as URLs GET assinadas da foto e da assinatura (nunca a chave crua). */
export function toPackageViewDto(
  pkg: PackageWithRelations,
  kind: UnitKind,
  urls: { photoUrl?: string; signatureUrl?: string },
): PackageViewDto {
  const { resident, unit } = pkg.residentUnit;
  return compact({
    id: id(pkg.id),
    code: packageCode(pkg.id),
    status: pkg.collectedAt ? 'collected' : 'pending',
    condominiumId: id(pkg.condominiumId),
    residentUnitId: id(pkg.residentUnitId),
    unitId: id(unit.id),
    residentId: id(resident.id),
    // O histórico preserva o nome mesmo com o morador excluído (soft delete).
    recipientName: resident.name,
    recipientUnit: formatUnit(kind, unit),
    senderCompany: pkg.senderCompany,
    trackingCode: opt(pkg.trackingCode),
    kind: pkg.kind,
    size: pkg.size,
    notes: opt(pkg.notes),
    photoUrl: urls.photoUrl,
    receivedAt: iso(pkg.receivedAt),
    receivedBy: id(pkg.receivedById),
    receivedByName: pkg.receivedBy.name,
    collectedAt: optIso(pkg.collectedAt),
    collectedBy: opt(pkg.collectedBy),
    collectedByDocument: opt(pkg.collectedByDocument),
    signatureUrl: urls.signatureUrl,
    deliveredBy: pkg.deliveredById === null ? undefined : id(pkg.deliveredById),
    deliveredByName: pkg.deliveredBy?.name,
    createdAt: iso(pkg.createdAt),
    updatedAt: iso(pkg.updatedAt),
  });
}

// ---------------------------------------------------------------------------
// Planos e cobranças
// ---------------------------------------------------------------------------

export interface PlanDto {
  id: string;
  description: string;
  unitLimit: number;
  price: number;
  validFrom: string;
  validUntil?: string;
}

export function toPlanDto(plan: Plan): PlanDto {
  return compact({
    id: id(plan.id),
    description: plan.description,
    unitLimit: plan.unitLimit,
    price: decimalToNumber(plan.price),
    validFrom: toYmd(plan.validFrom),
    validUntil: plan.validUntil ? toYmd(plan.validUntil) : undefined,
  });
}

export interface PlanListItemDto extends PlanDto {
  inUse: boolean;
  status: PlanStatus;
}

export function toPlanListItemDto(plan: Plan, inUse: boolean, today: string = todayYmd()): PlanListItemDto {
  const dto = toPlanDto(plan);
  return { ...dto, inUse, status: planStatus(dto, today) };
}

export interface InvoiceDto {
  id: string;
  condominiumId: string;
  planId: string;
  competence: string;
  amountDue: number;
  amountPaid?: number;
  paidAt?: string;
  dueDate: string;
  status: InvoiceStatus;
}

export function toInvoiceDto(invoice: Invoice, today: string = todayYmd()): InvoiceDto {
  const paidAt = invoice.paidAt ? toYmd(invoice.paidAt) : undefined;
  const dueDate = toYmd(invoice.dueDate);
  return compact({
    id: id(invoice.id),
    condominiumId: id(invoice.condominiumId),
    planId: id(invoice.planId),
    competence: toCompetence(invoice.competence),
    amountDue: decimalToNumber(invoice.amountDue),
    amountPaid: invoice.amountPaid ? decimalToNumber(invoice.amountPaid) : undefined,
    paidAt,
    dueDate,
    status: invoiceStatus({ paidAt, dueDate }, today),
  });
}
