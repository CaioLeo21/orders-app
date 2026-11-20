import { z } from 'zod';
import type {
  AdminCondominiumDto,
  CondominiumDto,
  InvoiceDto,
  PackageViewDto,
  PlanDto,
  PlanListItemDto,
  ResidentUnitDto,
  ResidentWithLinksDto,
  UnitDto,
  UserDto,
} from '../../lib/serializers.js';

// Esquemas de RESPOSTA para o OpenAPI. O `satisfies` amarra cada um ao tipo que o
// serializer realmente devolve: se um mudar sem o outro, o typecheck acusa.

export const registry = z.registry<{ id: string; description?: string }>();

function named<S extends z.ZodType>(id: string, schema: S, description?: string): S {
  registry.add(schema, { id, description });
  return schema;
}

const status = z.enum(['active', 'inactive']);
const isoInstant = z.string().describe('ISO 8601 UTC, ex.: 2026-10-15T13:42:10.123Z');
const ymd = z.string().describe('YYYY-MM-DD');

export const ErrorSchema = named(
  'Error',
  z.object({
    error: z.object({
      code: z.string().describe('SNAKE_UPPER, ex.: VALIDATION_ERROR'),
      message: z.string().describe('Mensagem em pt-BR para exibir'),
      details: z.object({ fields: z.record(z.string(), z.string()).optional() }).catchall(z.unknown()).optional(),
    }),
  }),
);

export const UserSchema = named(
  'User',
  z.object({
    matricula: z.string(),
    name: z.string(),
    profile: z.enum(['doorman', 'manager', 'admin', 'owner']),
    shift: z.enum(['morning', 'afternoon', 'night']).optional().describe('Só doorman'),
    status,
    condominiumId: z.string().nullable().describe('null só para owner'),
    mustChangePassword: z.boolean(),
    createdAt: isoInstant,
    updatedAt: isoInstant,
    deletedAt: isoInstant.optional(),
  }) satisfies z.ZodType<UserDto>,
);

export const CondominiumSchema = named(
  'Condominium',
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['apartment', 'house']),
    slug: z.string(),
    status,
    address: z.string().optional(),
    createdAt: isoInstant,
    updatedAt: isoInstant,
  }) satisfies z.ZodType<CondominiumDto>,
);

export const AdminCondominiumSchema = named(
  'AdminCondominium',
  CondominiumSchema.extend({
    unitCount: z.number().int(),
    currentPlanId: z.string().optional().describe('Omitido se ainda não há cobrança'),
  }) satisfies z.ZodType<AdminCondominiumDto>,
);

export const SessionSchema = named(
  'Session',
  z.object({ user: UserSchema, condominium: CondominiumSchema.optional().describe('Omitido para owner') }),
);

export const UnitSchema = named(
  'Unit',
  z.object({
    id: z.string(),
    condominiumId: z.string(),
    kind: z.enum(['apartment', 'house']),
    block: z.string().optional(),
    apartment: z.string().optional(),
    lot: z.string().optional().describe('Quadra'),
    house: z.string().optional(),
    street: z.string().optional(),
    createdAt: isoInstant,
    updatedAt: isoInstant,
    deletedAt: isoInstant.optional(),
  }) satisfies z.ZodType<UnitDto>,
);

export const ResidentUnitSchema = named(
  'ResidentUnit',
  z.object({ id: z.string(), residentId: z.string(), unitId: z.string(), endedAt: isoInstant.optional() }) satisfies z.ZodType<ResidentUnitDto>,
);

export const ResidentWithLinksSchema = named(
  'ResidentWithLinks',
  z.object({
    id: z.string(),
    condominiumId: z.string(),
    name: z.string(),
    phone: z.string().describe('"(11) 99999-9999" ou "" quando não informado'),
    residentType: z.enum(['owner', 'tenant', 'other']),
    residentTypeDescription: z.string().optional(),
    status,
    createdAt: isoInstant,
    updatedAt: isoInstant,
    deletedAt: isoInstant.optional(),
    links: z.array(ResidentUnitSchema),
  }) satisfies z.ZodType<ResidentWithLinksDto>,
);

export const SavedResidentSchema = named('SavedResident', z.object({ resident: ResidentWithLinksSchema, units: z.array(UnitSchema) }));

export const PackageViewSchema = named(
  'PackageView',
  z.object({
    id: z.string(),
    code: z.string().describe('"#000318"'),
    status: z.enum(['pending', 'collected']),
    condominiumId: z.string(),
    residentUnitId: z.string(),
    unitId: z.string(),
    residentId: z.string(),
    recipientName: z.string(),
    recipientUnit: z.string().describe('"Bloco B · Apto 204"'),
    senderCompany: z.string(),
    trackingCode: z.string().optional(),
    kind: z.enum(['envelope', 'box', 'bag', 'other']),
    size: z.enum(['small', 'medium', 'large']),
    notes: z.string().optional(),
    photoUrl: z.string().optional().describe('URL GET assinada (15 min)'),
    receivedAt: isoInstant,
    receivedBy: z.string().describe('Matrícula'),
    receivedByName: z.string(),
    collectedAt: isoInstant.optional(),
    collectedBy: z.string().optional(),
    collectedByDocument: z.string().optional(),
    signatureUrl: z.string().optional().describe('URL GET assinada (15 min)'),
    deliveredBy: z.string().optional().describe('Matrícula'),
    deliveredByName: z.string().optional(),
    createdAt: isoInstant,
    updatedAt: isoInstant,
  }) satisfies z.ZodType<PackageViewDto>,
);

export const PackageListSchema = named(
  'PackageList',
  z.object({
    items: z.array(PackageViewSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    counts: z.object({ pending: z.number().int(), collected: z.number().int() }).describe('Respeita from/to/q e ignora status'),
  }),
);

export const PlanSchema = named(
  'Plan',
  z.object({
    id: z.string(),
    description: z.string(),
    unitLimit: z.number().int(),
    price: z.number(),
    validFrom: ymd,
    validUntil: ymd.optional(),
  }) satisfies z.ZodType<PlanDto>,
);

export const PlanListItemSchema = named(
  'PlanListItem',
  PlanSchema.extend({ inUse: z.boolean(), status: z.enum(['active', 'scheduled', 'ended']) }) satisfies z.ZodType<PlanListItemDto>,
);

export const InvoiceSchema = named(
  'Invoice',
  z.object({
    id: z.string(),
    condominiumId: z.string(),
    planId: z.string(),
    competence: z.string().describe('YYYY-MM'),
    amountDue: z.number(),
    amountPaid: z.number().optional(),
    paidAt: ymd.optional(),
    dueDate: ymd,
    status: z.enum(['open', 'overdue', 'paid']),
  }) satisfies z.ZodType<InvoiceDto>,
);

export const UploadResultSchema = named('UploadResult', z.object({ key: z.string(), url: z.string().describe('URL GET assinada') }));
