import { Prisma, type Plan } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { choosePlan } from '../../src/modules/admin/invoices.service.js';
import { comparePlans } from '../../src/modules/admin/plans.service.js';

const plan = (id: number, unitLimit: number, validFrom: string, validUntil?: string): Plan => ({
  id,
  description: `Plano ${id}`,
  unitLimit,
  price: new Prisma.Decimal(unitLimit),
  validFrom: new Date(`${validFrom}T00:00:00Z`),
  validUntil: validUntil ? new Date(`${validUntil}T00:00:00Z`) : null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const today = '2026-10-15';
const essencial = plan(1, 50, '2026-01-01');
const condominio = plan(2, 150, '2026-01-01');
const grande = plan(3, 400, '2026-01-01');
const promo = plan(4, 50, '2025-06-01', '2025-12-31');
const active = [grande, essencial, condominio].sort(comparePlans);

describe('choosePlan (RN-F4)', () => {
  it('mantém o plano da última cobrança se ele segue ativo', () => {
    expect(choosePlan(grande, active, 10, today)).toBe(grande);
  });

  it('plano encerrado cai no menor ativo que comporta as unidades', () => {
    expect(choosePlan(promo, active, 40, today)).toBe(essencial);
    expect(choosePlan(promo, active, 51, today)).toBe(condominio);
  });

  it('sem cobrança anterior usa o menor que comporta', () => {
    expect(choosePlan(undefined, active, 0, today)).toBe(essencial);
    expect(choosePlan(undefined, active, 150, today)).toBe(condominio);
  });

  it('nenhum comporta: o de maior limite', () => {
    expect(choosePlan(undefined, active, 1000, today)).toBe(grande);
  });

  it('sem plano ativo: nenhum', () => {
    expect(choosePlan(promo, [], 10, today)).toBeUndefined();
  });

  it('plano agendado não conta como ativo', () => {
    const futuro = plan(5, 1000, '2027-01-01');
    expect(choosePlan(futuro, active, 10, today)).toBe(essencial);
  });
});
