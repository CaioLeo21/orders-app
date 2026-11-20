import type { Profile, User } from '@prisma/client';
import type { TenantContext } from '../../auth/middleware.js';
import { canAssign } from '../../auth/permissions.js';
import { AppError, conflict, forbidden, notFound } from '../../lib/errors.js';
import { generateTemporaryPassword, hashPassword } from '../../lib/password.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import type { UserInput } from './schemas.js';

const cannotChangeSelf = () => new AppError(403, 'CANNOT_CHANGE_SELF', 'Você não pode alterar o próprio perfil, status ou senha por aqui.');
const lastAdmin = () => conflict('LAST_ADMIN', 'O condomínio precisa de pelo menos um administrador ativo.');

/** RN-A9: o perfil (atual e novo) precisa estar nos assignableProfiles de quem age. */
function assertCanActOn(actor: Profile, ...targets: Profile[]): void {
  if (!targets.every((target) => canAssign(actor, target))) throw forbidden('Seu perfil não permite gerenciar este usuário.');
}

/**
 * Serializa as alterações de equipe de um condomínio: sem isso, dois admins rebaixando
 * um ao outro ao mesmo tempo deixariam o condomínio sem nenhum (RN-A10).
 */
async function lockCondominiumTeam(tx: Tx, condominiumId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${condominiumId})`;
}

/** RN-A10: tirar este admin ativo deixaria o condomínio sem nenhum? */
async function assertNotLastAdmin(tx: Tx, target: User): Promise<void> {
  if (target.profile !== 'admin' || target.status !== 'active') return;
  const others = await tx.user.count({
    where: { condominiumId: target.condominiumId, profile: 'admin', status: 'active', deletedAt: null, matricula: { not: target.matricula } },
  });
  if (others === 0) throw lastAdmin();
}

export function listUsers(tenant: TenantContext): Promise<User[]> {
  return prisma.user.findMany({ where: { condominiumId: tenant.condominiumId, deletedAt: null }, orderBy: { matricula: 'asc' } });
}

/** Usuário do condomínio do token; senão 404 (inclusive de outro tenant). */
export async function getUser(tenant: TenantContext, matricula: number, db: Tx = prisma): Promise<User> {
  const user = await db.user.findFirst({ where: { matricula, condominiumId: tenant.condominiumId, deletedAt: null } });
  if (!user) throw notFound('Usuário não encontrado.');
  return user;
}

/** RN-A3/RN-A4: nasce com senha provisória, devolvida uma única vez. */
export async function createUser(tenant: TenantContext, input: UserInput): Promise<{ user: User; temporaryPassword: string }> {
  assertCanActOn(tenant.profile, input.profile);
  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.user.create({
    data: {
      name: input.name,
      profile: input.profile,
      shift: input.shift,
      condominiumId: tenant.condominiumId,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
  });
  return { user, temporaryPassword };
}

/** RN-A8 a RN-A11. */
export async function updateUser(tenant: TenantContext, matricula: number, input: UserInput): Promise<User> {
  return prisma.$transaction(async (tx) => {
    await lockCondominiumTeam(tx, tenant.condominiumId);
    const target = await getUser(tenant, matricula, tx);
    if (target.matricula === tenant.matricula && input.profile !== target.profile) throw cannotChangeSelf();
    assertCanActOn(tenant.profile, target.profile, input.profile);
    if (input.profile !== 'admin') await assertNotLastAdmin(tx, target);
    return tx.user.update({ where: { matricula }, data: { name: input.name, profile: input.profile, shift: input.shift } });
  });
}

/** RN-A7: inativar derruba as sessões abertas (versao_token++). */
export async function setUserStatus(tenant: TenantContext, matricula: number, status: User['status']): Promise<User> {
  return prisma.$transaction(async (tx) => {
    await lockCondominiumTeam(tx, tenant.condominiumId);
    const target = await getUser(tenant, matricula, tx);
    if (target.matricula === tenant.matricula) throw cannotChangeSelf();
    assertCanActOn(tenant.profile, target.profile);
    if (status === target.status) return target;
    if (status === 'inactive') await assertNotLastAdmin(tx, target);
    return tx.user.update({
      where: { matricula },
      data: status === 'inactive' ? { status, tokenVersion: { increment: 1 } } : { status },
    });
  });
}

/** RN-A3: nova senha provisória, troca obrigatória e sessões derrubadas. */
export async function resetUserPassword(tenant: TenantContext, matricula: number): Promise<string> {
  const target = await getUser(tenant, matricula);
  if (target.matricula === tenant.matricula) throw cannotChangeSelf();
  assertCanActOn(tenant.profile, target.profile);
  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.update({
    where: { matricula },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, tokenVersion: { increment: 1 } },
  });
  return temporaryPassword;
}
