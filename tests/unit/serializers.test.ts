import { Prisma } from '@prisma/client';
import type { Condominium, Invoice, Plan, Resident, User } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  toCondominiumDto,
  toInvoiceDto,
  toPackageViewDto,
  toPlanListItemDto,
  toResidentWithLinksDto,
  toSessionDto,
  toUnitDto,
  toUserDto,
  type PackageWithRelations,
} from '../../src/lib/serializers.js';

const at = new Date('2026-10-15T13:42:10.123Z');

/** Nenhum null em lugar nenhum do JSON (salvo as exceções explícitas). */
function nullPaths(value: unknown, path = '$'): string[] {
  if (value === null) return [path];
  if (Array.isArray(value)) return value.flatMap((item, i) => nullPaths(item, `${path}[${i}]`));
  if (typeof value === 'object') return Object.entries(value as object).flatMap(([key, item]) => nullPaths(item, `${path}.${key}`));
  return [];
}

const user: User = {
  matricula: 1002,
  passwordHash: 'hash',
  name: 'Maria Santos',
  profile: 'doorman',
  shift: 'afternoon',
  status: 'active',
  mustChangePassword: false,
  tokenVersion: 3,
  passwordChangedAt: null,
  lastLoginAt: null,
  condominiumId: 1,
  createdAt: at,
  updatedAt: at,
  deletedAt: null,
};

const condominium: Condominium = {
  id: 1,
  name: 'Residencial Vista Verde',
  type: 'apartment',
  slug: 'residencial-vista-verde',
  status: 'active',
  address: null,
  createdAt: at,
  updatedAt: at,
};

describe('serializers', () => {
  it('User: ids em string, sem hash, sem null e sem campos internos', () => {
    const dto = toUserDto(user);
    expect(dto).toEqual({
      matricula: '1002',
      name: 'Maria Santos',
      profile: 'doorman',
      shift: 'afternoon',
      status: 'active',
      condominiumId: '1',
      mustChangePassword: false,
      createdAt: '2026-10-15T13:42:10.123Z',
      updatedAt: '2026-10-15T13:42:10.123Z',
    });
    expect(JSON.stringify(dto)).not.toContain('hash');
  });

  it('User do owner: condominiumId sai null (exceção do Anexo A) e sem shift', () => {
    const dto = toUserDto({ ...user, matricula: 9001, profile: 'owner', shift: null, condominiumId: null });
    expect(dto.condominiumId).toBeNull();
    expect('shift' in dto).toBe(false);
  });

  it('Sessão do owner omite condominium', () => {
    expect(toSessionDto({ ...user, profile: 'owner', condominiumId: null }, null)).not.toHaveProperty('condominium');
    expect(toSessionDto(user, condominium).condominium?.id).toBe('1');
  });

  it('Condominium omite address vazio', () => {
    expect(nullPaths(toCondominiumDto(condominium))).toEqual([]);
    expect(toCondominiumDto(condominium)).not.toHaveProperty('address');
  });

  it('Unit inclui kind derivado do condomínio e omite colunas vazias', () => {
    const dto = toUnitDto(
      { id: 3, condominiumId: 1, block: 'B', apartment: '204', lot: null, house: null, street: null, key: 'b|204', createdAt: at, updatedAt: at, deletedAt: null },
      'apartment',
    );
    expect(dto).toEqual({ id: '3', condominiumId: '1', kind: 'apartment', block: 'B', apartment: '204', createdAt: at.toISOString(), updatedAt: at.toISOString() });
  });

  it('Resident: telefone formatado ou "" e vínculos com endedAt', () => {
    const resident: Resident = {
      id: 7, condominiumId: 1, name: 'Sônia Prado', phone: '11955551011', residentType: 'owner', residentTypeDescription: null,
      status: 'active', createdAt: at, updatedAt: at, deletedAt: null,
    };
    const dto = toResidentWithLinksDto({
      ...resident,
      units: [
        { id: 8, residentId: 7, unitId: 2, createdAt: at, endedAt: null },
        { id: 3, residentId: 7, unitId: 9, createdAt: at, endedAt: at },
      ],
    });
    expect(dto.phone).toBe('(11) 95555-1011');
    expect(dto.links).toEqual([
      { id: '3', residentId: '7', unitId: '9', endedAt: at.toISOString() },
      { id: '8', residentId: '7', unitId: '2' },
    ]);
    expect(toResidentWithLinksDto({ ...resident, phone: null, units: [] }).phone).toBe('');
  });

  it('PackageView: status derivado, código e nomes resolvidos, sem null', () => {
    const pkg = {
      id: 318, condominiumId: 1, residentUnitId: 4, senderCompany: 'Mercado Livre', trackingCode: null, kind: 'box', size: 'medium',
      notes: null, photoKey: null, receivedAt: at, receivedById: 1002, collectedAt: null, collectedBy: null, collectedByDocument: null,
      signatureKey: null, deliveredById: null, createdAt: at, updatedAt: at, deletedAt: null, deletionReason: null, deletedById: null,
      residentUnit: {
        id: 4, residentId: 3, unitId: 3, createdAt: at, endedAt: null,
        resident: { id: 3, condominiumId: 1, name: 'Mariana Souza', phone: null, residentType: 'owner', residentTypeDescription: null, status: 'active', createdAt: at, updatedAt: at, deletedAt: null },
        unit: { id: 3, condominiumId: 1, block: 'B', apartment: '204', lot: null, house: null, street: null, key: 'b|204', createdAt: at, updatedAt: at, deletedAt: null },
      },
      receivedBy: { name: 'Maria Santos' },
      deliveredBy: null,
    } satisfies PackageWithRelations;
    const dto = toPackageViewDto(pkg, 'apartment', {});
    expect(dto).toMatchObject({ id: '318', code: '#000318', status: 'pending', recipientName: 'Mariana Souza', recipientUnit: 'Bloco B · Apto 204', receivedBy: '1002', receivedByName: 'Maria Santos', unitId: '3', residentId: '3' });
    expect(nullPaths(dto)).toEqual([]);
    expect(dto).not.toHaveProperty('deletionReason');

    const collected = toPackageViewDto({ ...pkg, collectedAt: at, collectedBy: 'Mariana Souza', deliveredById: 1003, deliveredBy: { name: 'Pedro Santos' } }, 'apartment', { signatureUrl: 'https://x' });
    expect(collected).toMatchObject({ status: 'collected', deliveredBy: '1003', deliveredByName: 'Pedro Santos', signatureUrl: 'https://x' });
  });

  it('Plan e Invoice: Decimal → number, DATE → YYYY-MM-DD, competência YYYY-MM', () => {
    const plan: Plan = {
      id: 1, description: 'Essencial', unitLimit: 50, price: new Prisma.Decimal('149.90'),
      validFrom: new Date('2026-01-01T00:00:00Z'), validUntil: null, createdAt: at, updatedAt: at,
    };
    expect(toPlanListItemDto(plan, true, '2026-10-15')).toEqual({
      id: '1', description: 'Essencial', unitLimit: 50, price: 149.9, validFrom: '2026-01-01', inUse: true, status: 'active',
    });

    const invoice: Invoice = {
      id: 6, condominiumId: 3, planId: 1, competence: new Date('2026-09-01T00:00:00Z'), amountDue: new Prisma.Decimal('149.90'),
      amountPaid: null, paidAt: null, dueDate: new Date('2026-10-10T00:00:00Z'), createdAt: at, updatedAt: at,
    };
    expect(toInvoiceDto(invoice, '2026-10-15')).toEqual({
      id: '6', condominiumId: '3', planId: '1', competence: '2026-09', amountDue: 149.9, dueDate: '2026-10-10', status: 'overdue',
    });
    expect(toInvoiceDto({ ...invoice, amountPaid: new Prisma.Decimal('150.00'), paidAt: new Date('2026-10-08T00:00:00Z') }, '2026-10-15')).toMatchObject({
      amountPaid: 150, paidAt: '2026-10-08', status: 'paid',
    });
  });
});
