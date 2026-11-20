import type { Profile } from '@prisma/client';

// Réplica exata de derivePermissions (condo-order-hub/src/hooks/usePermissions.ts), seção 7.

export type AssignableProfile = Exclude<Profile, 'owner'>;

export interface Permissions {
  /** Dono do iPackage: só acessa a área /admin. */
  isOwner: boolean;
  /** Cadastrar, editar, inativar e excluir moradores. */
  canManageResidents: boolean;
  /** Excluir encomendas (com motivo). */
  canDeletePackages: boolean;
  /** Tela Usuários: listar e cadastrar. */
  canManageUsers: boolean;
  /** Perfis que este usuário pode dar a outros (e sobre os quais pode agir). */
  assignableProfiles: AssignableProfile[];
}

export function derivePermissions(profile: Profile | undefined): Permissions {
  const manages = profile === 'manager' || profile === 'admin';
  return {
    isOwner: profile === 'owner',
    canManageResidents: manages,
    canDeletePackages: manages,
    canManageUsers: manages,
    assignableProfiles: profile === 'admin' ? ['doorman', 'manager', 'admin'] : profile === 'manager' ? ['doorman', 'manager'] : [],
  };
}

/** Perfis da portaria (tudo menos owner). */
export const DOORMAN_AREA: Profile[] = ['doorman', 'manager', 'admin'];
/** Perfis que gerenciam o condomínio (moradores, usuários, exclusão de encomenda). */
export const MANAGERS: Profile[] = ['manager', 'admin'];
export const OWNER: Profile[] = ['owner'];

export function canAssign(actor: Profile, target: Profile): boolean {
  return (derivePermissions(actor).assignableProfiles as Profile[]).includes(target);
}
