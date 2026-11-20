import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentCompetence, dueDateYmd, invoiceStatus, planStatus, todayYmd } from '../../src/lib/dates.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('todayYmd em America/Sao_Paulo', () => {
  it('às 23:30 de São Paulo ainda é o mesmo dia, embora em UTC já seja o seguinte', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T02:30:00Z')); // 10/11 23:30 em São Paulo
    expect(todayYmd()).toBe('2026-11-10');
    expect(currentCompetence()).toBe('2026-11');
  });

  it('vira o mês pelo fuso de São Paulo', () => {
    expect(todayYmd(new Date('2026-11-01T02:59:00Z'))).toBe('2026-10-31');
    expect(todayYmd(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01');
  });
});

describe('dueDateYmd (RN-F2)', () => {
  it('dia 10 do mês seguinte', () => {
    expect(dueDateYmd('2026-10')).toBe('2026-11-10');
    expect(dueDateYmd('2026-12')).toBe('2027-01-10');
  });
});

describe('planStatus (RN-P1)', () => {
  it.each([
    [{ validFrom: '2026-11-01' }, 'scheduled'],
    [{ validFrom: '2026-01-01' }, 'active'],
    [{ validFrom: '2026-01-01', validUntil: '2026-10-15' }, 'active'],
    [{ validFrom: '2025-06-01', validUntil: '2025-12-31' }, 'ended'],
  ] as const)('%j → %s', (plan, status) => {
    expect(planStatus(plan, '2026-10-15')).toBe(status);
  });
});

describe('invoiceStatus (RN-F3)', () => {
  const invoice = { dueDate: '2026-11-10' };

  it('paga quando há pago_em', () => {
    expect(invoiceStatus({ ...invoice, paidAt: '2026-11-08' }, '2026-12-01')).toBe('paid');
  });

  it('em aberto até o dia do vencimento, atrasada depois', () => {
    expect(invoiceStatus(invoice, '2026-11-10')).toBe('open');
    expect(invoiceStatus(invoice, '2026-11-11')).toBe('overdue');
  });

  it('com relógio às 23:30 de São Paulo do dia 10, ainda não está atrasada', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T02:30:00Z'));
    expect(invoiceStatus(invoice)).toBe('open');
    vi.setSystemTime(new Date('2026-11-11T03:30:00Z')); // 11/11 00:30 em São Paulo
    expect(invoiceStatus(invoice)).toBe('overdue');
  });
});
