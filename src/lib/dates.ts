// Datas de calendário e regras que dependem de "hoje" no fuso de São Paulo (handoff 8.1).
// Colunas @db.Date chegam do Prisma como Date à meia-noite UTC.

export const TIME_ZONE = 'America/Sao_Paulo';

/** Dia do mês em que a cobrança vence, no mês seguinte à competência (RN-F2). */
export const DUE_DAY = 10;

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-10-15" de hoje em São Paulo. */
export function todayYmd(now: Date = new Date()): string {
  const parts = Object.fromEntries(ymdFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** "2026-10" do mês corrente em São Paulo. */
export function currentCompetence(now: Date = new Date()): string {
  return todayYmd(now).slice(0, 7);
}

/** Date (meia-noite UTC) → "YYYY-MM-DD". */
export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date (meia-noite UTC), o formato que o Prisma espera em @db.Date. */
export function fromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Date (dia 1, meia-noite UTC) → "YYYY-MM". */
export function toCompetence(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** "YYYY-MM" → Date do dia 1 (meia-noite UTC). */
export function fromCompetence(competence: string): Date {
  return fromYmd(`${competence}-01`);
}

/** Vencimento: dia 10 do mês seguinte à competência ("2026-10" → "2026-11-10"). */
export function dueDateYmd(competence: string): string {
  const [year, month] = competence.split('-').map(Number) as [number, number];
  const next = new Date(Date.UTC(year, month, DUE_DAY));
  return toYmd(next);
}

export type PlanStatus = 'active' | 'scheduled' | 'ended';

/** RN-P1. Datas em "YYYY-MM-DD". */
export function planStatus(plan: { validFrom: string; validUntil?: string | null }, today: string = todayYmd()): PlanStatus {
  if (plan.validFrom > today) return 'scheduled';
  if (plan.validUntil && plan.validUntil < today) return 'ended';
  return 'active';
}

export type InvoiceStatus = 'open' | 'overdue' | 'paid';

/** RN-F3. Datas em "YYYY-MM-DD". */
export function invoiceStatus(invoice: { paidAt?: string | null; dueDate: string }, today: string = todayYmd()): InvoiceStatus {
  if (invoice.paidAt) return 'paid';
  return invoice.dueDate < today ? 'overdue' : 'open';
}
