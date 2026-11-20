import { beforeEach, describe, expect, it } from 'vitest';
import { currentCompetence } from '../../src/lib/dates.js';
import { API, client, expectError, loginAs, prisma, resetDb, todayYmd, type Agent } from './helpers.js';

// Cenários 9 (faturamento) e 10 (planos), mais condomínios (RN-C*).

let owner: Agent;

beforeEach(async () => {
  await resetDb();
  owner = await loginAs('9001');
});

function shiftCompetence(competence: string, months: number): string {
  const [y, m] = competence.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Condomínios', () => {
  it('lista com unitCount e currentPlanId', async () => {
    const res = await owner.get(`${API}/admin/condominiums`);
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: string; unitCount: number; currentPlanId?: string }) => [c.id, c.unitCount, c.currentPlanId])).toEqual([
      ['1', 6, '1'],
      ['2', 2, '1'],
      ['3', 1, '1'],
    ]);
  });

  it('slug-availability', async () => {
    expect((await owner.get(`${API}/admin/condominiums/slug-availability`).query({ slug: 'torre-azul' })).body).toEqual({ available: false });
    expect((await owner.get(`${API}/admin/condominiums/slug-availability`).query({ slug: 'torre-azul', exceptId: '3' })).body).toEqual({ available: true });
    expect((await owner.get(`${API}/admin/condominiums/slug-availability`).query({ slug: 'novo-condominio' })).body).toEqual({ available: true });
    expectError(await owner.get(`${API}/admin/condominiums/slug-availability`).query({ slug: 'Com Espaço' }), 422, 'VALIDATION_ERROR');
  });

  it('RN-C2: cria condomínio + primeiro admin com senha provisória; slug repetido → 409', async () => {
    const body = { condominium: { name: 'Residencial Novo', type: 'house', slug: 'residencial-novo' }, adminName: 'Paula Reis' };
    const res = await owner.post(`${API}/admin/condominiums`).send(body);
    expect(res.status).toBe(201);
    expect(res.body.condominium).toMatchObject({ name: 'Residencial Novo', type: 'house', status: 'active', unitCount: 0 });
    expect(res.body.condominium).not.toHaveProperty('address');
    expect(res.body.condominium).not.toHaveProperty('currentPlanId');
    expect(res.body.admin).toMatchObject({ name: 'Paula Reis' });

    const admin = await loginAs(res.body.admin.matricula, res.body.admin.temporaryPassword);
    const me = await admin.get(`${API}/me`);
    expect(me.body.user).toMatchObject({ profile: 'admin', mustChangePassword: true, condominiumId: res.body.condominium.id });

    expectError(await owner.post(`${API}/admin/condominiums`).send(body), 409, 'SLUG_TAKEN');
  });

  it('RN-C3: tipo travado com unidades; RN-C1: slug em uso → 409', async () => {
    expectError(await owner.put(`${API}/admin/condominiums/1`).send({ name: 'Residencial Vista Verde', type: 'house', slug: 'residencial-vista-verde' }), 409, 'TYPE_LOCKED');
    expectError(await owner.put(`${API}/admin/condominiums/1`).send({ name: 'Residencial Vista Verde', type: 'apartment', slug: 'torre-azul' }), 409, 'SLUG_TAKEN');
    const ok = await owner.put(`${API}/admin/condominiums/1`).send({ name: 'Vista Verde', type: 'apartment', slug: 'vista-verde' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ name: 'Vista Verde', slug: 'vista-verde', unitCount: 6 });
    expect(ok.body).not.toHaveProperty('address');
  });

  it('RN-C4: inativar bloqueia o login dos usuários; reativar devolve', async () => {
    expect((await owner.patch(`${API}/admin/condominiums/3/status`).send({ status: 'inactive' })).body.status).toBe('inactive');
    expectError(await client().post(`${API}/auth/login`).send({ matricula: '3001', password: '123456' }), 403, 'CONDOMINIUM_INACTIVE');
    await owner.patch(`${API}/admin/condominiums/3/status`).send({ status: 'active' });
    await loginAs('3001');
  });
});

describe('Planos — cenário 10', () => {
  it('lista ordenada por limite e vigência, com inUse e status', async () => {
    const res = await owner.get(`${API}/admin/plans`);
    expect(res.body.map((p: { id: string; inUse: boolean; status: string }) => [p.id, p.inUse, p.status])).toEqual([
      ['4', false, 'ended'],
      ['1', true, 'active'],
      ['2', false, 'active'],
      ['3', false, 'active'],
    ]);
    expect(res.body[1]).toMatchObject({ description: 'Essencial', unitLimit: 50, price: 149.9, validFrom: '2026-01-01' });
  });

  it('RN-P2: preço e limite travados em plano em uso; nome e vigência editáveis', async () => {
    const base = { description: 'Essencial', unitLimit: 50, price: 149.9, validFrom: '2026-01-01' };
    expectError(await owner.put(`${API}/admin/plans/1`).send({ ...base, price: 159.9 }), 409, 'PLAN_LOCKED');
    expectError(await owner.put(`${API}/admin/plans/1`).send({ ...base, unitLimit: 60 }), 409, 'PLAN_LOCKED');
    const renamed = await owner.put(`${API}/admin/plans/1`).send({ ...base, description: 'Essencial 2026' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.description).toBe('Essencial 2026');
    expect((await owner.put(`${API}/admin/plans/2`).send({ description: 'Condomínio', unitLimit: 160, price: 319.9, validFrom: '2026-01-01' })).body).toMatchObject({ unitLimit: 160, price: 319.9 });
  });

  it('RN-P3: encerrar grava validUntil = hoje; agendado → 409', async () => {
    const ended = await owner.post(`${API}/admin/plans/2/end`);
    expect(ended.status).toBe(200);
    expect(ended.body.validUntil).toBe(todayYmd());

    const future = await owner.post(`${API}/admin/plans`).send({ description: 'Futuro', unitLimit: 10, price: 9.9, validFrom: addDays(todayYmd(), 30) });
    expect(future.status).toBe(201);
    expectError(await owner.post(`${API}/admin/plans/${future.body.id}/end`), 409, 'PLAN_NOT_STARTED');
  });

  it('RN-P4: plano em uso não é excluído; sem cobranças, sim', async () => {
    expectError(await owner.delete(`${API}/admin/plans/1`), 409, 'PLAN_IN_USE');
    expect((await owner.delete(`${API}/admin/plans/4`)).status).toBe(204);
    expectError(await owner.delete(`${API}/admin/plans/4`), 404, 'NOT_FOUND');
  });

  it('validação: fim antes do início e preço com 3 casas', async () => {
    const res = await owner.post(`${API}/admin/plans`).send({ description: 'X', unitLimit: 10, price: 9.999, validFrom: '2026-02-01', validUntil: '2026-01-01' });
    expectError(res, 422, 'VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details.fields)).toEqual(expect.arrayContaining(['price', 'validUntil']));
  });
});

describe('Cobranças — cenário 9', () => {
  const competence = currentCompetence();

  it('gerar duas vezes não duplica (idempotente)', async () => {
    const first = await owner.post(`${API}/admin/invoices/generate`).send({ competence });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ created: 3, skipped: [] });
    expect((await owner.post(`${API}/admin/invoices/generate`).send({ competence })).body).toEqual({ created: 0, skipped: [] });

    const list = await owner.get(`${API}/admin/invoices`).query({ competence });
    expect(list.body).toHaveLength(3);
    const [y, m] = competence.split('-').map(Number) as [number, number];
    const due = new Date(Date.UTC(y, m, 10)).toISOString().slice(0, 10);
    expect(list.body[0]).toMatchObject({ competence, planId: '1', amountDue: 149.9, dueDate: due, status: 'open' });
  });

  it('condomínio inativo é pulado (RN-C5)', async () => {
    await prisma.condominium.update({ where: { id: 2 }, data: { status: 'inactive' } });
    const res = await owner.post(`${API}/admin/invoices/generate`).send({ competence });
    expect(res.body.created).toBe(2);
    const list = await owner.get(`${API}/admin/invoices`).query({ competence });
    expect(list.body.map((i: { condominiumId: string }) => i.condominiumId).sort()).toEqual(['1', '3']);
  });

  it('plano encerrado faz cair no menor plano ativo que comporta as unidades', async () => {
    const yesterday = addDays(todayYmd(), -1);
    await owner.put(`${API}/admin/plans/1`).send({ description: 'Essencial', unitLimit: 50, price: 149.9, validFrom: '2025-01-01', validUntil: yesterday });
    // Condomínio 1 passa a ter 156 unidades: só o Grande (400) comporta. Os outros cabem no Condomínio (150).
    await prisma.unit.createMany({ data: Array.from({ length: 150 }, (_, i) => ({ condominiumId: 1, block: 'Z', apartment: String(i + 1), key: `z|${i + 1}` })) });

    const next = shiftCompetence(competence, 1);
    expect((await owner.post(`${API}/admin/invoices/generate`).send({ competence: next })).body.created).toBe(3);
    const list = await owner.get(`${API}/admin/invoices`).query({ competence: next });
    const byCondo = Object.fromEntries(list.body.map((i: { condominiumId: string; planId: string; amountDue: number }) => [i.condominiumId, [i.planId, i.amountDue]]));
    expect(byCondo).toEqual({ '1': ['3', 549.9], '2': ['2', 299.9], '3': ['2', 299.9] });
  });

  it('sem plano ativo: o condomínio é reportado em skipped', async () => {
    await prisma.plan.updateMany({ data: { validUntil: new Date('2025-12-31T00:00:00Z'), validFrom: new Date('2025-01-01T00:00:00Z') } });
    const res = await owner.post(`${API}/admin/invoices/generate`).send({ competence });
    expect(res.body).toEqual({
      created: 0,
      skipped: [
        { condominiumId: '1', reason: 'NO_ACTIVE_PLAN' },
        { condominiumId: '2', reason: 'NO_ACTIVE_PLAN' },
        { condominiumId: '3', reason: 'NO_ACTIVE_PLAN' },
      ],
    });
  });

  it('RN-F5/RN-F6: pagamento futuro → 422; registrar; repetir → 409; desfazer', async () => {
    const torreAzul = await prisma.invoice.findFirstOrThrow({ where: { condominiumId: 3, paidAt: null } });
    const url = `${API}/admin/invoices/${torreAzul.id}/payment`;

    const future = await owner.post(url).send({ amountPaid: 149.9, paidAt: addDays(todayYmd(), 1) });
    expectError(future, 422, 'VALIDATION_ERROR');
    expect(future.body.error.details.fields.paidAt).toBeTruthy();

    const paid = await owner.post(url).send({ amountPaid: 150, paidAt: todayYmd() });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ amountPaid: 150, amountDue: 149.9, paidAt: todayYmd(), status: 'paid' });
    expectError(await owner.post(url).send({ amountPaid: 150, paidAt: todayYmd() }), 409, 'ALREADY_PAID');

    const undone = await owner.delete(url);
    expect(undone.status).toBe(200);
    expect(undone.body).not.toHaveProperty('paidAt');
    expect(undone.body).not.toHaveProperty('amountPaid');
    expect(['open', 'overdue']).toContain(undone.body.status);
  });

  it('status calculado bate com o filtro e com o vencimento', async () => {
    const all = await owner.get(`${API}/admin/invoices`);
    const today = todayYmd();
    for (const invoice of all.body as { status: string; paidAt?: string; dueDate: string }[]) {
      const expected = invoice.paidAt ? 'paid' : invoice.dueDate < today ? 'overdue' : 'open';
      expect(invoice.status).toBe(expected);
    }
    for (const status of ['open', 'overdue', 'paid']) {
      const filtered = await owner.get(`${API}/admin/invoices`).query({ status });
      expect(filtered.body.every((invoice: { status: string }) => invoice.status === status)).toBe(true);
      expect(filtered.body).toHaveLength(all.body.filter((invoice: { status: string }) => invoice.status === status).length);
    }
  });

  it('resumo do mês', async () => {
    const last = shiftCompetence(competence, -1);
    const res = await owner.get(`${API}/admin/invoices/summary`).query({ competence: last });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ competence: last, toReceive: 149.9, received: 299.8, missingCount: 0 });
    const current = await owner.get(`${API}/admin/invoices/summary`).query({ competence });
    expect(current.body).toMatchObject({ toReceive: 0, received: 0, missingCount: 3 });
  });
});
