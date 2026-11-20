import { Prisma, type Plan } from '@prisma/client';
import { conflict, notFound } from '../../lib/errors.js';
import { fromYmd, planStatus, todayYmd, toYmd } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import type { PlanInput } from './schemas.js';

const planNotFound = () => notFound('Plano não encontrado.');

export const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

/** Mesma ordem do front: limite de unidades e depois início da vigência. */
export function comparePlans(a: Plan, b: Plan): number {
  return a.unitLimit - b.unitLimit || a.validFrom.getTime() - b.validFrom.getTime() || a.id - b.id;
}

export function planStatusOf(plan: Plan, today: string = todayYmd()) {
  return planStatus({ validFrom: toYmd(plan.validFrom), validUntil: plan.validUntil ? toYmd(plan.validUntil) : null }, today);
}

function planData(input: PlanInput) {
  return {
    description: input.description,
    unitLimit: input.unitLimit,
    price: toDecimal(input.price),
    validFrom: fromYmd(input.validFrom),
    validUntil: input.validUntil ? fromYmd(input.validUntil) : null,
  };
}

/** Planos com inUse (RN-P2: em uso = tem pelo menos uma cobrança). */
export async function listPlans(): Promise<{ plan: Plan; inUse: boolean }[]> {
  const plans = await prisma.plan.findMany({ include: { _count: { select: { invoices: true } } } });
  return plans.sort(comparePlans).map(({ _count, ...plan }) => ({ plan, inUse: _count.invoices > 0 }));
}

export async function getPlan(id: number): Promise<Plan> {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) throw planNotFound();
  return plan;
}

const isInUse = async (id: number) => (await prisma.invoice.count({ where: { planId: id } })) > 0;

export function createPlan(input: PlanInput): Promise<Plan> {
  return prisma.plan.create({ data: planData(input) });
}

/** RN-P2: num plano em uso, preço e limite ficam travados; nome e vigência seguem editáveis. */
export async function updatePlan(id: number, input: PlanInput): Promise<Plan> {
  const plan = await getPlan(id);
  const changesLockedFields = plan.unitLimit !== input.unitLimit || plan.price.toFixed(2) !== input.price.toFixed(2);
  if (changesLockedFields && (await isInUse(id))) {
    throw conflict('PLAN_LOCKED', 'Este plano já tem cobranças: preço e limite de unidades não podem mudar. Crie um plano novo.');
  }
  return prisma.plan.update({ where: { id }, data: planData(input) });
}

/** RN-P3: encerra hoje. Plano agendado não se encerra (exclua-o). */
export async function endPlan(id: number): Promise<Plan> {
  const plan = await getPlan(id);
  const today = todayYmd();
  if (planStatusOf(plan, today) === 'scheduled') {
    throw conflict('PLAN_NOT_STARTED', 'Este plano ainda não começou. Para cancelá-lo, exclua o plano.');
  }
  // Já encerrado (ou encerrando hoje): nada a fazer, para não estender a vigência.
  if (plan.validUntil && toYmd(plan.validUntil) <= today) return plan;
  return prisma.plan.update({ where: { id }, data: { validUntil: fromYmd(today) } });
}

/** RN-P4: só sem cobranças; aí a exclusão é física. */
export async function deletePlan(id: number): Promise<void> {
  await getPlan(id);
  if (await isInUse(id)) throw conflict('PLAN_IN_USE', 'Este plano já tem cobranças e não pode ser excluído. Encerre a vigência.');
  await prisma.plan.delete({ where: { id } });
}
