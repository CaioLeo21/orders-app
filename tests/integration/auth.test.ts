import { beforeEach, describe, expect, it } from 'vitest';
import { API, client, expectError, loginAs, prisma, resetDb } from './helpers.js';

beforeEach(resetDb);

describe('Login (RN-A2) — cenário 1', () => {
  it('1002/123456 → 200 com condominium e cookie HttpOnly', async () => {
    const res = await client().post(`${API}/auth/login`).send({ matricula: '1002', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      matricula: '1002', name: 'Maria Santos', profile: 'doorman', shift: 'afternoon', status: 'active', condominiumId: '1', mustChangePassword: false,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.condominium).toMatchObject({ id: '1', type: 'apartment', slug: 'residencial-vista-verde' });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/ipk_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('9001 (owner) → 200 sem condominium e condominiumId null', async () => {
    const res = await client().post(`${API}/auth/login`).send({ matricula: '9001', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('condominium');
    expect(res.body.user.condominiumId).toBeNull();
  });

  it('senha errada e matrícula inexistente têm a mesma resposta 401', async () => {
    const wrong = await client().post(`${API}/auth/login`).send({ matricula: '1002', password: 'errada' });
    const missing = await client().post(`${API}/auth/login`).send({ matricula: '777777', password: 'errada' });
    const garbage = await client().post(`${API}/auth/login`).send({ matricula: 'abc', password: 'errada' });
    expectError(wrong, 401, 'INVALID_CREDENTIALS');
    expect(missing.body).toEqual(wrong.body);
    expect(garbage.body).toEqual(wrong.body);
  });

  it('usuário inativo → 403 USER_INACTIVE (só com a senha certa)', async () => {
    await prisma.user.update({ where: { matricula: 1003 }, data: { status: 'inactive' } });
    expectError(await client().post(`${API}/auth/login`).send({ matricula: '1003', password: '123456' }), 403, 'USER_INACTIVE');
    expectError(await client().post(`${API}/auth/login`).send({ matricula: '1003', password: 'errada' }), 401, 'INVALID_CREDENTIALS');
  });

  it('condomínio inativo → 403 CONDOMINIUM_INACTIVE', async () => {
    await prisma.condominium.update({ where: { id: 2 }, data: { status: 'inactive' } });
    expectError(await client().post(`${API}/auth/login`).send({ matricula: '2002', password: '123456' }), 403, 'CONDOMINIUM_INACTIVE');
  });

  it('a 6ª tentativa errada → 429 com Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      expectError(await client().post(`${API}/auth/login`).send({ matricula: '1004', password: `errada${i}` }), 401, 'INVALID_CREDENTIALS');
    }
    const blocked = await client().post(`${API}/auth/login`).send({ matricula: '1004', password: '123456' });
    expectError(blocked, 429, 'TOO_MANY_ATTEMPTS');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('corpo inválido → 422 VALIDATION_ERROR com os campos', async () => {
    const res = await client().post(`${API}/auth/login`).send({});
    expectError(res, 422, 'VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details.fields)).toEqual(expect.arrayContaining(['matricula', 'password']));
  });
});

describe('Sessão', () => {
  it('GET /me sem cookie → 401; com cookie → mesmo corpo do login', async () => {
    expectError(await client().get(`${API}/me`), 401, 'UNAUTHENTICATED');
    const agent = await loginAs('1001');
    const me = await agent.get(`${API}/me`);
    expect(me.status).toBe(200);
    expect(me.body.user.matricula).toBe('1001');
    expect(me.body.condominium.id).toBe('1');
  });

  it('logout limpa a sessão', async () => {
    const agent = await loginAs('1002');
    expect((await agent.post(`${API}/auth/logout`)).status).toBe(204);
    expectError(await agent.get(`${API}/me`), 401, 'UNAUTHENTICATED');
  });

  it('escrita sem JSON nem X-Requested-With é recusada (CSRF)', async () => {
    const res = await client().post(`${API}/auth/logout`).unset('X-Requested-With');
    expectError(res, 403, 'FORBIDDEN');
  });
});

describe('Senha provisória (RN-A3, RN-A5) — cenário 2', () => {
  it('cria, loga, é barrado até trocar, troca e segue', async () => {
    const admin = await loginAs('1001');
    const created = await admin.post(`${API}/users`).send({ name: 'Ana Lima', profile: 'doorman', shift: 'night' });
    expect(created.status).toBe(201);
    const { matricula } = created.body.user;
    const { temporaryPassword } = created.body;
    expect(temporaryPassword).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    expect(created.body.user.mustChangePassword).toBe(true);

    const user = await loginAs(matricula, temporaryPassword);
    expect((await user.get(`${API}/me`)).body.user.mustChangePassword).toBe(true);
    expectError(await user.get(`${API}/packages`), 403, 'PASSWORD_CHANGE_REQUIRED');

    const wrong = await user.post(`${API}/auth/change-password`).send({ currentPassword: 'xxxxxxxx', newPassword: 'nova-senha' });
    expectError(wrong, 422, 'WRONG_PASSWORD');
    expect(wrong.body.error.details.fields.currentPassword).toBeTruthy();
    expectError(await user.post(`${API}/auth/change-password`).send({ currentPassword: temporaryPassword, newPassword: temporaryPassword }), 422, 'SAME_PASSWORD');
    expectError(await user.post(`${API}/auth/change-password`).send({ currentPassword: temporaryPassword, newPassword: '123' }), 422, 'VALIDATION_ERROR');

    const changed = await user.post(`${API}/auth/change-password`).send({ currentPassword: temporaryPassword, newPassword: 'minhaSenha2026' });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect((await user.get(`${API}/packages`)).status).toBe(200);
    await loginAs(matricula, 'minhaSenha2026');
  });

  it('trocar a senha derruba as outras sessões (versao_token++)', async () => {
    const first = await loginAs('1002');
    const second = await loginAs('1002');
    expect((await first.post(`${API}/auth/change-password`).send({ currentPassword: '123456', newPassword: 'outra-senha' })).status).toBe(200);
    expect((await first.get(`${API}/me`)).status).toBe(200);
    expectError(await second.get(`${API}/me`), 401, 'UNAUTHENTICATED');
  });
});

describe('Inativação e reset derrubam a sessão (RN-A7) — cenário 3', () => {
  it('inativado: a requisição seguinte responde 403', async () => {
    const doorman = await loginAs('1003');
    expect((await doorman.get(`${API}/packages`)).status).toBe(200);
    const admin = await loginAs('1001');
    expect((await admin.patch(`${API}/users/1003/status`).send({ status: 'inactive' })).status).toBe(200);
    expectError(await doorman.get(`${API}/packages`), 403, 'USER_INACTIVE');
  });

  it('senha resetada: a sessão antiga cai e o login exige a troca', async () => {
    const doorman = await loginAs('1004');
    const admin = await loginAs('1001');
    const reset = await admin.post(`${API}/users/1004/reset-password`);
    expect(reset.status).toBe(200);
    expectError(await doorman.get(`${API}/packages`), 401, 'UNAUTHENTICATED');
    const again = await loginAs('1004', reset.body.temporaryPassword);
    expectError(await again.get(`${API}/packages`), 403, 'PASSWORD_CHANGE_REQUIRED');
  });

  it('condomínio inativado derruba as sessões abertas', async () => {
    const doorman = await loginAs('2002');
    await prisma.condominium.update({ where: { id: 2 }, data: { status: 'inactive' } });
    expectError(await doorman.get(`${API}/packages`), 403, 'CONDOMINIUM_INACTIVE');
  });
});
