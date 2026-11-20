import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API, expectError, loginAs, resetDb, type Agent } from './helpers.js';

// Cenário 4 (tenant) e cenário 5 (permissões), seção 7.

describe('Tenant: usuário do condomínio 1 não enxerga o condomínio 2 — cenário 4', () => {
  let admin: Agent;

  beforeAll(async () => {
    await resetDb();
    admin = await loginAs('1001');
  });

  it.each([
    ['get', '/packages/401', undefined],
    ['patch', '/packages/401', { notes: 'x' }],
    ['delete', '/packages/401', { reason: 'teste' }],
    ['post', '/packages/401/delete', { reason: 'teste' }],
    ['post', '/packages/401/pickup', { collectedBy: 'X', signatureUrl: 'condo/1/signature/2026/10/00000000-0000-0000-0000-000000000000.png' }],
    ['put', '/residents/9', { name: 'X', phone: '', residentType: 'owner', units: [{ group: 'A', number: '1' }] }],
    ['patch', '/residents/9/status', { status: 'inactive' }],
    ['delete', '/residents/9', undefined],
    ['put', '/users/2002', { name: 'X', profile: 'doorman', shift: 'night' }],
    ['patch', '/users/2002/status', { status: 'inactive' }],
    ['post', '/users/2002/reset-password', undefined],
    ['put', '/users/9001', { name: 'X', profile: 'manager' }],
  ] as const)('%s %s → 404', async (method, path, body) => {
    const req = admin[method](`${API}${path}`);
    expectError(await (body ? req.send(body) : req), 404, 'NOT_FOUND');
  });

  it('POST /packages com residentUnitId do condomínio 2 → 404', async () => {
    const res = await admin.post(`${API}/packages`).send({ residentUnitId: '10', senderCompany: 'Correios', kind: 'box', size: 'small' });
    expectError(res, 404, 'NOT_FOUND');
  });

  it('listas só trazem o próprio condomínio', async () => {
    const packages = await admin.get(`${API}/packages`);
    expect(packages.body.items.every((p: { condominiumId: string }) => p.condominiumId === '1')).toBe(true);
    expect(packages.body.items.map((p: { id: string }) => p.id)).not.toContain('401');
    for (const path of ['/residents', '/units', '/users']) {
      const res = await admin.get(`${API}${path}`);
      expect(res.status).toBe(200);
      expect(res.body.every((row: { condominiumId: string }) => row.condominiumId === '1')).toBe(true);
    }
  });

  it('id não numérico → 404 (não 500)', async () => {
    expectError(await admin.get(`${API}/packages/abc`), 404, 'NOT_FOUND');
    expectError(await admin.get(`${API}/packages/99999999999`), 404, 'NOT_FOUND');
  });
});

describe('Permissões por perfil — cenário 5', () => {
  beforeEach(resetDb);

  it('doorman: 403 em excluir encomenda, criar morador, usuários e /admin', async () => {
    const doorman = await loginAs('1002');
    expectError(await doorman.delete(`${API}/packages/318`).send({ reason: 'x' }), 403, 'FORBIDDEN');
    expectError(await doorman.post(`${API}/residents`).send({ name: 'X', phone: '', residentType: 'owner', units: [{ group: 'A', number: '1' }] }), 403, 'FORBIDDEN');
    expectError(await doorman.delete(`${API}/residents/1`), 403, 'FORBIDDEN');
    expectError(await doorman.get(`${API}/users`), 403, 'FORBIDDEN');
    expectError(await doorman.get(`${API}/admin/condominiums`), 403, 'FORBIDDEN');
    expect((await doorman.get(`${API}/residents`)).status).toBe(200);
    expect((await doorman.get(`${API}/units`)).status).toBe(200);
  });

  it('manager: 403 ao criar ou editar um admin; cria porteiro', async () => {
    const manager = await loginAs('1005');
    expectError(await manager.post(`${API}/users`).send({ name: 'Novo Admin', profile: 'admin' }), 403, 'FORBIDDEN');
    expectError(await manager.put(`${API}/users/1001`).send({ name: 'João Silva', profile: 'admin' }), 403, 'FORBIDDEN');
    expectError(await manager.put(`${API}/users/1002`).send({ name: 'Maria Santos', profile: 'admin' }), 403, 'FORBIDDEN');
    expectError(await manager.patch(`${API}/users/1001/status`).send({ status: 'inactive' }), 403, 'FORBIDDEN');
    expectError(await manager.post(`${API}/users/1001/reset-password`), 403, 'FORBIDDEN');
    expect((await manager.post(`${API}/users`).send({ name: 'Ana Lima', profile: 'doorman', shift: 'night' })).status).toBe(201);
  });

  it('owner: 403 na portaria', async () => {
    const owner = await loginAs('9001');
    for (const path of ['/packages', '/units', '/residents', '/users']) expectError(await owner.get(`${API}${path}`), 403, 'FORBIDDEN');
    expect((await owner.get(`${API}/admin/condominiums`)).status).toBe(200);
  });

  it('RN-A8: ninguém altera o próprio perfil, status ou senha', async () => {
    const admin = await loginAs('1001');
    expectError(await admin.patch(`${API}/users/1001/status`).send({ status: 'inactive' }), 403, 'CANNOT_CHANGE_SELF');
    expectError(await admin.post(`${API}/users/1001/reset-password`), 403, 'CANNOT_CHANGE_SELF');
    expectError(await admin.put(`${API}/users/1001`).send({ name: 'João Silva', profile: 'manager' }), 403, 'CANNOT_CHANGE_SELF');
    const renamed = await admin.put(`${API}/users/1001`).send({ name: 'João da Silva', profile: 'admin' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('João da Silva');
  });

  it('RN-A11: turno obrigatório para porteiro e zerado nos outros perfis', async () => {
    const admin = await loginAs('1001');
    const missing = await admin.post(`${API}/users`).send({ name: 'Sem Turno', profile: 'doorman' });
    expectError(missing, 422, 'VALIDATION_ERROR');
    expect(missing.body.error.details.fields.shift).toBeTruthy();

    const promoted = await admin.put(`${API}/users/1002`).send({ name: 'Maria Santos', profile: 'manager', shift: 'night' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.profile).toBe('manager');
    expect(promoted.body).not.toHaveProperty('shift');
  });

  it('reativar usuário inativo', async () => {
    const admin = await loginAs('1001');
    expect((await admin.patch(`${API}/users/1003/status`).send({ status: 'inactive' })).body.status).toBe('inactive');
    expect((await admin.patch(`${API}/users/1003/status`).send({ status: 'active' })).body.status).toBe('active');
    await loginAs('1003');
  });
});
