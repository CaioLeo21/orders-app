import { beforeEach, describe, expect, it } from 'vitest';
import { API, expectError, loginAs, prisma, resetDb, type Agent } from './helpers.js';

// Cenários 6 (N:N) e 7 (unicidade de unidade). Seed: Sônia Prado (7) tem os vínculos
// 7 → C-101 (unidade 5, encomenda 290) e 8 → A-303 (unidade 2, encomenda 280).

let admin: Agent;

beforeEach(async () => {
  await resetDb();
  admin = await loginAs('1001');
});

const sonia = (units: { group?: string; number: string; street?: string }[]) => ({
  name: 'Sônia Prado',
  phone: '(11) 95555-1011',
  residentType: 'owner',
  units,
});

type Link = { id: string; unitId: string; endedAt?: string };
const activeLinks = (links: Link[]) => links.filter((link) => !link.endedAt);

describe('Morador com várias unidades (RN-M2) — cenário 6', () => {
  it('salvar a Sônia com C-101 e A-303 mantém os 2 vínculos', async () => {
    const res = await admin.put(`${API}/residents/7`).send(sonia([{ group: 'C', number: '101' }, { group: 'A', number: '303' }]));
    expect(res.status).toBe(200);
    expect(activeLinks(res.body.resident.links).map((link: Link) => link.id).sort()).toEqual(['7', '8']);
    expect(res.body.units.map((unit: { id: string }) => unit.id).sort()).toEqual(['2', '5']);
  });

  it('tirar A-303 (com encomenda) encerra o vínculo; recolocar reabre o mesmo id', async () => {
    const removed = await admin.put(`${API}/residents/7`).send(sonia([{ group: 'C', number: '101' }]));
    expect(removed.status).toBe(200);
    const ended = removed.body.resident.links.find((link: Link) => link.id === '8');
    expect(ended.endedAt).toBeTruthy();
    expect(removed.body.units.map((unit: { id: string }) => unit.id)).toEqual(['5']);

    const back = await admin.put(`${API}/residents/7`).send(sonia([{ group: 'C', number: '101' }, { group: 'A', number: '303' }]));
    const reopened = back.body.resident.links.find((link: Link) => link.id === '8');
    expect(reopened).toEqual({ id: '8', residentId: '7', unitId: '2' });
  });

  it('tirar uma unidade sem encomenda apaga o vínculo', async () => {
    const added = await admin.put(`${API}/residents/7`).send(sonia([{ group: 'C', number: '101' }, { group: 'A', number: '303' }, { group: 'F', number: '900' }]));
    const newLink = activeLinks(added.body.resident.links).find((link: Link) => !['7', '8'].includes(link.id))!;
    expect(newLink).toBeTruthy();

    const res = await admin.put(`${API}/residents/7`).send(sonia([{ group: 'C', number: '101' }, { group: 'A', number: '303' }]));
    expect(res.body.resident.links.map((link: Link) => link.id)).not.toContain(newLink.id);
    expect(await prisma.residentUnit.findUnique({ where: { id: Number(newLink.id) } })).toBeNull();
  });

  it('GET /residents traz vínculos encerrados com endedAt', async () => {
    await admin.put(`${API}/residents/7`).send(sonia([{ group: 'C', number: '101' }]));
    const list = await admin.get(`${API}/residents`);
    const found = list.body.find((resident: { id: string }) => resident.id === '7');
    expect(found.links).toHaveLength(2);
    expect(found.links.find((link: Link) => link.id === '8').endedAt).toBeTruthy();
  });

  it('RN-M1: sem unidade → 422 RESIDENT_NEEDS_UNIT', async () => {
    expectError(await admin.post(`${API}/residents`).send({ ...sonia([]), name: 'Sem Unidade' }), 422, 'RESIDENT_NEEDS_UNIT');
    expectError(await admin.post(`${API}/residents`).send({ ...sonia([{ group: 'A', number: '  ' }]), name: 'Sem Unidade' }), 422, 'RESIDENT_NEEDS_UNIT');
  });
});

describe('Unicidade de unidade (RN-U1/RN-U2) — cenário 7', () => {
  it('"B"+"204" e " b "+"204 " são a mesma casa; ""+"204" é outra', async () => {
    const first = await admin.post(`${API}/residents`).send({ name: 'Morador Um', phone: '', residentType: 'tenant', units: [{ group: 'B', number: '204' }] });
    const second = await admin.post(`${API}/residents`).send({ name: 'Morador Dois', phone: '', residentType: 'tenant', units: [{ group: ' b ', number: '204 ' }] });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.units[0].id).toBe('3'); // B-204 do seed
    expect(second.body.units[0].id).toBe('3');
    expect(await prisma.unit.count({ where: { condominiumId: 1, key: 'b|204' } })).toBe(1);

    const third = await admin.post(`${API}/residents`).send({ name: 'Morador Três', phone: '', residentType: 'tenant', units: [{ group: '', number: '204' }] });
    expect(third.body.units[0].id).not.toBe('3');
    expect(third.body.units[0]).not.toHaveProperty('block');
    expect((await prisma.unit.findUniqueOrThrow({ where: { id: Number(third.body.units[0].id) } })).key).toBe('|204');
  });

  it('casas: grupo vai para quadra e a rua de uma casa existente não é sobrescrita (RN-U3)', async () => {
    const houseAdmin = await loginAs('2001');
    const res = await houseAdmin.post(`${API}/residents`).send({
      name: 'Nova Moradora', phone: '', residentType: 'tenant', units: [{ group: '3', number: '12', street: 'Outra Rua' }, { group: '9', number: '1', street: 'Rua Nova' }],
    });
    expect(res.status).toBe(201);
    const [existing, created] = res.body.units;
    expect(existing).toMatchObject({ id: '7', kind: 'house', lot: '3', house: '12', street: 'Rua dos Ipês' });
    expect(created).toMatchObject({ kind: 'house', lot: '9', house: '1', street: 'Rua Nova' });
    expect(created).not.toHaveProperty('block');
  });

  it('GET /units devolve as unidades com kind', async () => {
    const res = await admin.get(`${API}/units`);
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toMatchObject({ id: '1', kind: 'apartment', block: 'A', apartment: '101' });
  });
});

describe('Campos do morador', () => {
  it('RN-M4: telefone normalizado, formatado na resposta, inválido → 422, vazio → ""', async () => {
    const ok = await admin.post(`${API}/residents`).send({ name: 'Fone', phone: '11 98888-7777', residentType: 'owner', units: [{ group: 'A', number: '101' }] });
    expect(ok.body.resident.phone).toBe('(11) 98888-7777');
    expect((await prisma.resident.findUniqueOrThrow({ where: { id: Number(ok.body.resident.id) } })).phone).toBe('11988887777');

    const bad = await admin.post(`${API}/residents`).send({ name: 'Fone', phone: '1234', residentType: 'owner', units: [{ group: 'A', number: '101' }] });
    expectError(bad, 422, 'VALIDATION_ERROR');
    expect(bad.body.error.details.fields.phone).toBeTruthy();

    const empty = await admin.post(`${API}/residents`).send({ name: 'Sem Fone', phone: '', residentType: 'owner', units: [{ group: 'A', number: '101' }] });
    expect(empty.body.resident.phone).toBe('');
  });

  it('RN-M3: descrição do tipo só com "other"', async () => {
    const other = await admin.post(`${API}/residents`).send({ name: 'Prima', phone: '', residentType: 'other', residentTypeDescription: 'Familiar', units: [{ group: 'A', number: '101' }] });
    expect(other.body.resident.residentTypeDescription).toBe('Familiar');
    const owner = await admin.post(`${API}/residents`).send({ name: 'Dono', phone: '', residentType: 'owner', residentTypeDescription: 'Ignorada', units: [{ group: 'A', number: '101' }] });
    expect(owner.body.resident).not.toHaveProperty('residentTypeDescription');
  });

  it('RN-M5: excluir some das listas, mas as encomendas mantêm o nome', async () => {
    expect((await admin.delete(`${API}/residents/3`)).status).toBe(204);
    const list = await admin.get(`${API}/residents`);
    expect(list.body.map((resident: { id: string }) => resident.id)).not.toContain('3');
    const pkg = await admin.get(`${API}/packages/318`);
    expect(pkg.body.recipientName).toBe('Mariana Souza');
    expectError(await admin.put(`${API}/residents/3`).send(sonia([{ group: 'B', number: '204' }])), 404, 'NOT_FOUND');
    // Vínculos não são encerrados no soft delete.
    expect((await prisma.residentUnit.findUniqueOrThrow({ where: { id: 3 } })).endedAt).toBeNull();
  });

  it('inativar mantém na lista com status inactive', async () => {
    const res = await admin.patch(`${API}/residents/1/status`).send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: '1', status: 'inactive' });
    expect(Array.isArray(res.body.links)).toBe(true);
    const list = await admin.get(`${API}/residents`);
    expect(list.body.find((resident: { id: string }) => resident.id === '1').status).toBe('inactive');
  });
});
