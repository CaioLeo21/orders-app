import { beforeEach, describe, expect, it } from 'vitest';
import { API, app, client, expectError, loginAs, nullPaths, prisma, resetDb, upload, uploadKey, type Agent } from './helpers.js';
import request from 'supertest';

// Cenário 8. Seed do condomínio 1: pendentes 297, 305, 311, 316, 318, 319; retiradas 290, 302, 280.

let doorman: Agent;

beforeEach(async () => {
  await resetDb();
  doorman = await loginAs('1002');
});

const ids = (res: request.Response) => res.body.items.map((item: { id: string }) => item.id);

describe('GET /packages', () => {
  it('counts por aba e ordenação', async () => {
    const all = await doorman.get(`${API}/packages`);
    expect(all.status).toBe(200);
    expect(all.body.counts).toEqual({ pending: 6, collected: 3 });
    expect(all.body).toMatchObject({ total: 9, page: 1, pageSize: 50 });

    const pending = await doorman.get(`${API}/packages`).query({ status: 'pending' });
    expect(pending.body.total).toBe(6);
    expect(ids(pending)).toEqual(['297', '305', '311', '316', '318', '319']); // mais antigas primeiro
    expect(pending.body.items.every((p: { status: string }) => p.status === 'pending')).toBe(true);
    expect(pending.body.counts).toEqual({ pending: 6, collected: 3 });

    const collected = await doorman.get(`${API}/packages`).query({ status: 'collected' });
    expect([...ids(collected)].sort()).toEqual(['280', '290', '302']);
    const times = collected.body.items.map((p: { collectedAt: string }) => Date.parse(p.collectedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a)); // retirada mais recente primeiro
  });

  it('PackageView com nomes resolvidos e sem null', async () => {
    const res = await doorman.get(`${API}/packages/302`);
    expect(res.body).toMatchObject({
      id: '302', code: '#000302', status: 'collected', residentUnitId: '6', unitId: '4', residentId: '6',
      recipientName: 'Bruna Lima', recipientUnit: 'Bloco C · Apto 402', receivedBy: '1002', receivedByName: 'Maria Santos',
      collectedBy: 'Thiago Lima', deliveredBy: '1003', deliveredByName: 'Pedro Santos',
    });
    expect(res.body.signatureUrl).toMatch(/^http/);
    expect(nullPaths(res.body)).toEqual([]);
  });

  it('busca q sem acento nem maiúsculas, nos campos do front', async () => {
    const search = async (q: string) => ids(await doorman.get(`${API}/packages`).query({ q }));
    expect(await search('mariana')).toEqual(['318']);
    expect((await search('B-204')).sort()).toEqual(['311', '318']);
    expect(await search('#000318')).toEqual(['318']);
    expect((await search('sonia')).sort()).toEqual(['280', '290']);
    expect((await search('bloco c')).sort()).toEqual(['290', '302', '305']);
    expect((await search('pedro')).sort()).toEqual(['297', '302', '311']);
    expect(await search('ml123')).toEqual(['318']);
    expect(await search('100%')).toEqual([]);

    const counted = await doorman.get(`${API}/packages`).query({ q: 'sonia' });
    expect(counted.body.counts).toEqual({ pending: 0, collected: 2 });
  });

  it('from/to filtram chegada das pendentes e retirada das retiradas', async () => {
    const from = new Date(Date.now() - 60 * 60_000).toISOString();
    const res = await doorman.get(`${API}/packages`).query({ from });
    expect(ids(res).sort()).toEqual(['318', '319']);
    expect(res.body.counts).toEqual({ pending: 2, collected: 0 });
  });

  it('paginação', async () => {
    const page = await doorman.get(`${API}/packages`).query({ page: 2, pageSize: 4 });
    expect(page.body).toMatchObject({ page: 2, pageSize: 4, total: 9 });
    expect(page.body.items).toHaveLength(4);
    expectError(await doorman.get(`${API}/packages`).query({ pageSize: 500 }), 422, 'VALIDATION_ERROR');
  });
});

describe('POST /packages (RN-E1/RN-E2/RN-E3)', () => {
  it('receivedBy e condomínio vêm do token, ignorando o body', async () => {
    const res = await doorman.post(`${API}/packages`).send({
      residentUnitId: '3', senderCompany: 'Mercado Livre', trackingCode: 'ML999', kind: 'box', size: 'medium',
      receivedBy: '1001', condominiumId: '2', receivedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: '403', code: '#000403', status: 'pending', receivedBy: '1002', condominiumId: '1', recipientName: 'Mariana Souza' });
    expect(Date.now() - Date.parse(res.body.receivedAt)).toBeLessThan(60_000);
  });

  it('com foto: aceita a chave do próprio condomínio e devolve URL assinada', async () => {
    const photo = await uploadKey(doorman, 'package-photo');
    const res = await doorman.post(`${API}/packages`).send({ residentUnitId: '3', senderCompany: 'Amazon', kind: 'box', size: 'small', photoUrl: photo });
    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toMatch(/\/api\/v1\/files\/condo\/1\/package-photo\//);

    const url = new URL(res.body.photoUrl);
    const file = await request(app).get(url.pathname + url.search);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
  });

  it('destinatário inativo, excluído ou vínculo encerrado → 422 RECIPIENT_UNAVAILABLE', async () => {
    await prisma.resident.update({ where: { id: 3 }, data: { status: 'inactive' } });
    expectError(await doorman.post(`${API}/packages`).send({ residentUnitId: '3', senderCompany: 'X', kind: 'box', size: 'small' }), 422, 'RECIPIENT_UNAVAILABLE');
    await prisma.residentUnit.update({ where: { id: 4 }, data: { endedAt: new Date() } });
    expectError(await doorman.post(`${API}/packages`).send({ residentUnitId: '4', senderCompany: 'X', kind: 'box', size: 'small' }), 422, 'RECIPIENT_UNAVAILABLE');
  });

  it('validação', async () => {
    const res = await doorman.post(`${API}/packages`).send({ residentUnitId: '3', senderCompany: '  ', kind: 'caixa', size: 'small' });
    expectError(res, 422, 'VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details.fields)).toEqual(expect.arrayContaining(['senderCompany', 'kind']));
  });
});

describe('PATCH /packages/:id (RN-E4)', () => {
  it('edita só os campos permitidos e "" limpa rastreio/observação', async () => {
    const res = await doorman.patch(`${API}/packages/318`).send({ trackingCode: '', notes: 'Na prateleira 2', kind: 'bag', collectedAt: '2020-01-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('trackingCode');
    expect(res.body).toMatchObject({ notes: 'Na prateleira 2', kind: 'bag', status: 'pending' });
  });
});

describe('Retirada (RN-E5)', () => {
  it('registra com assinatura, e a segunda tentativa → 409', async () => {
    const signature = await uploadKey(doorman, 'signature');
    const res = await doorman.post(`${API}/packages/318/pickup`).send({ collectedBy: 'Rafael Souza', collectedByDocument: '12.345.678-9', signatureUrl: signature });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'collected', collectedBy: 'Rafael Souza', collectedByDocument: '12.345.678-9', deliveredBy: '1002', deliveredByName: 'Maria Santos' });
    expect(res.body.signatureUrl).toMatch(/^http/);

    const again = await doorman.post(`${API}/packages/318/pickup`).send({ collectedBy: 'Outro', signatureUrl: signature });
    expectError(again, 409, 'ALREADY_COLLECTED');
  });

  it('duas retiradas simultâneas: uma 200 e uma 409', async () => {
    const signature = await uploadKey(doorman, 'signature');
    const other = await loginAs('1003');
    const [a, b] = await Promise.all([
      doorman.post(`${API}/packages/319/pickup`).send({ collectedBy: 'Eduardo Rocha', signatureUrl: signature }),
      other.post(`${API}/packages/319/pickup`).send({ collectedBy: 'Eduardo Rocha', signatureUrl: signature }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it('assinatura obrigatória, do propósito certo e existente', async () => {
    expectError(await doorman.post(`${API}/packages/318/pickup`).send({ collectedBy: 'X' }), 422, 'VALIDATION_ERROR');
    const photo = await uploadKey(doorman, 'package-photo');
    expectError(await doorman.post(`${API}/packages/318/pickup`).send({ collectedBy: 'X', signatureUrl: photo }), 422, 'INVALID_UPLOAD');
    const ghost = 'condo/1/signature/2026/10/00000000-0000-4000-8000-000000000000.png';
    expectError(await doorman.post(`${API}/packages/318/pickup`).send({ collectedBy: 'X', signatureUrl: ghost }), 422, 'INVALID_UPLOAD');
  });
});

describe('Exclusão (RN-E7)', () => {
  it('sem motivo → 422; com motivo → 204, some e vira 404', async () => {
    const manager = await loginAs('1005');
    expectError(await manager.delete(`${API}/packages/316`), 422, 'VALIDATION_ERROR');
    expectError(await manager.delete(`${API}/packages/316`).send({ reason: '   ' }), 422, 'VALIDATION_ERROR');
    expect((await manager.delete(`${API}/packages/316`).send({ reason: 'Registrada em duplicidade' })).status).toBe(204);

    expectError(await manager.get(`${API}/packages/316`), 404, 'NOT_FOUND');
    expect(ids(await manager.get(`${API}/packages`))).not.toContain('316');
    expectError(await manager.delete(`${API}/packages/316`).send({ reason: 'De novo' }), 404, 'NOT_FOUND');
    const signature = await uploadKey(manager, 'signature');
    expectError(await manager.post(`${API}/packages/316/pickup`).send({ collectedBy: 'X', signatureUrl: signature }), 404, 'NOT_FOUND');

    const row = await prisma.package.findUniqueOrThrow({ where: { id: 316 } });
    expect(row).toMatchObject({ deletionReason: 'Registrada em duplicidade', deletedById: 1005 });
  });

  it('alias POST /packages/:id/delete', async () => {
    const admin = await loginAs('1001');
    expect((await admin.post(`${API}/packages/305/delete`).send({ reason: 'Teste' })).status).toBe(204);
  });
});

describe('Uploads (seção 10)', () => {
  it('rejeita MIME falso, propósito inválido e falta de arquivo', async () => {
    expectError(await upload(doorman, 'package-photo', Buffer.from('não sou imagem'), 'foto.jpg'), 422, 'INVALID_UPLOAD');
    expectError(await doorman.post(`${API}/uploads`).field('purpose', 'avatar').attach('file', Buffer.from('x'), 'x.png'), 422, 'VALIDATION_ERROR');
    expectError(await doorman.post(`${API}/uploads`).field('purpose', 'signature'), 422, 'INVALID_UPLOAD');
  });

  it('multipart sem X-Requested-With → 403', async () => {
    const res = await doorman.post(`${API}/uploads`).unset('X-Requested-With').field('purpose', 'signature').attach('file', Buffer.from('x'), 'x.png');
    expectError(res, 403, 'FORBIDDEN');
  });

  it('chave de outro condomínio é rejeitada', async () => {
    const otherCondo = await loginAs('2002');
    const foreign = await uploadKey(otherCondo, 'signature');
    expect(foreign.startsWith('condo/2/signature/')).toBe(true);
    expectError(await doorman.post(`${API}/packages/318/pickup`).send({ collectedBy: 'X', signatureUrl: foreign }), 422, 'INVALID_UPLOAD');
  });

  it('owner não faz upload', async () => {
    const owner = await loginAs('9001');
    expectError(await upload(owner, 'signature'), 403, 'FORBIDDEN');
  });

  it('URL assinada adulterada → 404', async () => {
    const res = await upload(doorman, 'signature');
    const url = new URL(res.body.url);
    url.searchParams.set('sig', 'x');
    expect((await client().get(url.pathname + url.search)).status).toBe(404);
  });
});
