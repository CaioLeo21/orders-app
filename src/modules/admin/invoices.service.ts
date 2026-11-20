import type { Invoice, Plan, Prisma } from '@prisma/client';
import { conflict, notFound, validationError } from '../../lib/errors.js';
import { currentCompetence, dueDateYmd, fromCompetence, fromYmd, todayYmd, type InvoiceStatus } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { decimalToNumber } from '../../lib/serializers.js';
import { comparePlans, planStatusOf, toDecimal } from './plans.service.js';
import type { PaymentInput } from './schemas.js';

const invoiceNotFound = () => notFound('Cobrança não encontrada.');

/** Filtro de status calculado (RN-F3) em termos de colunas. */
function statusWhere(status: InvoiceStatus | undefined, today: string): Prisma.InvoiceWhereInput {
  if (status === 'paid') return { paidAt: { not: null } };
  if (status === 'overdue') return { paidAt: null, dueDate: { lt: fromYmd(today) } };
  if (status === 'open') return { paidAt: null, dueDate: { gte: fromYmd(today) } };
  return {};
}

export function listInvoices(filters: { competence?: string; status?: InvoiceStatus }, today: string = todayYmd()): Promise<Invoice[]> {
  return prisma.invoice.findMany({
    where: {
      ...(filters.competence ? { competence: fromCompetence(filters.competence) } : {}),
      ...statusWhere(filters.status, today),
    },
    orderBy: [{ competence: 'desc' }, { condominiumId: 'asc' }],
  });
}

/** Os mesmos números que a tela de faturamento do front calcula hoje. */
export async function invoiceSummary(competence: string = currentCompetence(), today: string = todayYmd()) {
  const month = fromCompetence(competence);
  const [toReceive, received, overdueTotalCount, missingCount] = await Promise.all([
    prisma.invoice.aggregate({ where: { competence: month, paidAt: null }, _sum: { amountDue: true } }),
    prisma.invoice.aggregate({ where: { competence: month }, _sum: { amountPaid: true } }),
    prisma.invoice.count({ where: statusWhere('overdue', today) }),
    prisma.condominium.count({ where: { status: 'active', invoices: { none: { competence: month } } } }),
  ]);
  return {
    competence,
    toReceive: toReceive._sum.amountDue ? decimalToNumber(toReceive._sum.amountDue) : 0,
    received: received._sum.amountPaid ? decimalToNumber(received._sum.amountPaid) : 0,
    overdueTotalCount,
    missingCount,
  };
}

/**
 * RN-F4: o plano da cobrança mais recente, se ainda ativo; senão o menor plano ativo que
 * comporta as unidades; senão o ativo de maior limite. `activePlans` vem ordenado (comparePlans).
 */
export function choosePlan(currentPlan: Plan | undefined, activePlans: Plan[], unitCount: number, today: string): Plan | undefined {
  if (currentPlan && planStatusOf(currentPlan, today) === 'active') return currentPlan;
  return activePlans.find((plan) => plan.unitLimit >= unitCount) ?? activePlans.at(-1);
}

export interface GenerateResult {
  created: number;
  skipped: { condominiumId: string; reason: 'NO_ACTIVE_PLAN' }[];
}

/** RN-F4/RN-C5: uma cobrança por condomínio ativo sem cobrança na competência. Idempotente. */
export async function generateInvoices(competence: string, today: string = todayYmd()): Promise<GenerateResult> {
  const month = fromCompetence(competence);
  const condominiums = await prisma.condominium.findMany({
    where: { status: 'active', invoices: { none: { competence: month } } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!condominiums.length) return { created: 0, skipped: [] };
  const ids = condominiums.map((condominium) => condominium.id);

  const [plans, latestInvoices, unitCounts] = await Promise.all([
    prisma.plan.findMany(),
    prisma.invoice.findMany({
      where: { condominiumId: { in: ids } },
      distinct: ['condominiumId'],
      orderBy: [{ condominiumId: 'asc' }, { competence: 'desc' }],
      select: { condominiumId: true, planId: true },
    }),
    prisma.unit.groupBy({ by: ['condominiumId'], where: { condominiumId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
  ]);
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const activePlans = plans.filter((plan) => planStatusOf(plan, today) === 'active').sort(comparePlans);
  const currentPlanOf = new Map(latestInvoices.map((row) => [row.condominiumId, plansById.get(row.planId)]));
  const unitsOf = new Map(unitCounts.map((row) => [row.condominiumId, row._count._all]));

  const data: Prisma.InvoiceCreateManyInput[] = [];
  const skipped: GenerateResult['skipped'] = [];
  const dueDate = fromYmd(dueDateYmd(competence));
  for (const id of ids) {
    const plan = choosePlan(currentPlanOf.get(id), activePlans, unitsOf.get(id) ?? 0, today);
    if (!plan) {
      skipped.push({ condominiumId: String(id), reason: 'NO_ACTIVE_PLAN' });
      continue;
    }
    // valor_a_pagar é uma cópia do preço no momento da geração, não uma referência.
    data.push({ condominiumId: id, planId: plan.id, competence: month, amountDue: plan.price, dueDate });
  }

  const { count } = data.length ? await prisma.invoice.createMany({ data, skipDuplicates: true }) : { count: 0 };
  return { created: count, skipped };
}

export async function getInvoice(id: number): Promise<Invoice> {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw invoiceNotFound();
  return invoice;
}

/** RN-F5: valor > 0 (pode diferir do devido) e data até hoje. */
export async function registerPayment(id: number, input: PaymentInput, today: string = todayYmd()): Promise<Invoice> {
  const invoice = await getInvoice(id);
  if (input.paidAt > today) throw validationError({ paidAt: 'A data do pagamento não pode ser no futuro.' });
  const alreadyPaid = () => conflict('ALREADY_PAID', 'Esta cobrança já está paga.');
  if (invoice.paidAt) throw alreadyPaid();
  const { count } = await prisma.invoice.updateMany({
    where: { id, paidAt: null },
    data: { amountPaid: toDecimal(input.amountPaid), paidAt: fromYmd(input.paidAt) },
  });
  if (count === 0) throw alreadyPaid();
  return getInvoice(id);
}

/** RN-F6. */
export async function undoPayment(id: number): Promise<Invoice> {
  await getInvoice(id);
  return prisma.invoice.update({ where: { id }, data: { amountPaid: null, paidAt: null } });
}
