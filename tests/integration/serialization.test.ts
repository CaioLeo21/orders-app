import { beforeAll, describe, expect, it } from 'vitest';
import { API, loginAs, nullPaths, resetDb } from './helpers.js';

// Cenário 11: nenhum null no JSON (fora User.condominiumId do owner), ids string,
// dinheiro number, competência "YYYY-MM".

beforeAll(resetDb);

describe('Serialização', () => {
  it('portaria: sem null e ids em string', async () => {
    const admin = await loginAs('1001');
    for (const path of ['/me', '/packages', '/packages/290', '/units', '/residents', '/users']) {
      const res = await admin.get(`${API}${path}`);
      expect(res.status, path).toBe(200);
      expect(nullPaths(res.body), path).toEqual([]);
    }
    const pkg = (await admin.get(`${API}/packages/290`)).body;
    for (const key of ['id', 'condominiumId', 'residentUnitId', 'unitId', 'residentId', 'receivedBy', 'deliveredBy']) {
      expect(typeof pkg[key], key).toBe('string');
    }
  });

  it('owner: dinheiro em number e competência YYYY-MM', async () => {
    const owner = await loginAs('9001');
    for (const path of ['/me', '/admin/condominiums', '/admin/plans', '/admin/invoices', '/admin/invoices/summary']) {
      const res = await owner.get(`${API}${path}`);
      expect(res.status, path).toBe(200);
      expect(nullPaths(res.body), path).toEqual([]);
    }
    expect((await owner.get(`${API}/me`)).body.user.condominiumId).toBeNull();
    const plans = (await owner.get(`${API}/admin/plans`)).body;
    expect(typeof plans[0].price).toBe('number');
    const invoices = (await owner.get(`${API}/admin/invoices`)).body;
    expect(invoices[0].competence).toMatch(/^\d{4}-\d{2}$/);
    expect(typeof invoices[0].amountDue).toBe('number');
    expect(invoices[0].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
