import { describe, expect, it } from 'vitest';
import { canAssign, derivePermissions } from '../../src/auth/permissions.js';

// Tabela da seção 7 — precisa bater com derivePermissions do front.
describe('derivePermissions', () => {
  it.each([
    ['doorman', { isOwner: false, canManageResidents: false, canDeletePackages: false, canManageUsers: false, assignableProfiles: [] }],
    ['manager', { isOwner: false, canManageResidents: true, canDeletePackages: true, canManageUsers: true, assignableProfiles: ['doorman', 'manager'] }],
    ['admin', { isOwner: false, canManageResidents: true, canDeletePackages: true, canManageUsers: true, assignableProfiles: ['doorman', 'manager', 'admin'] }],
    ['owner', { isOwner: true, canManageResidents: false, canDeletePackages: false, canManageUsers: false, assignableProfiles: [] }],
  ] as const)('%s', (profile, expected) => {
    expect(derivePermissions(profile)).toEqual(expected);
  });

  it('sem perfil, nada', () => {
    expect(derivePermissions(undefined).assignableProfiles).toEqual([]);
  });
});

describe('canAssign (RN-A9)', () => {
  it('manager não mexe em admin', () => {
    expect(canAssign('manager', 'doorman')).toBe(true);
    expect(canAssign('manager', 'manager')).toBe(true);
    expect(canAssign('manager', 'admin')).toBe(false);
  });

  it('admin mexe em todos da portaria, ninguém dá owner', () => {
    expect(canAssign('admin', 'admin')).toBe(true);
    expect(canAssign('admin', 'owner')).toBe(false);
    expect(canAssign('doorman', 'doorman')).toBe(false);
  });
});
