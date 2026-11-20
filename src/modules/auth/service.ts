import type { Condominium, User } from '@prisma/client';
import { loginLimiters } from '../../auth/rate-limit.js';
import { AppError, unprocessable } from '../../lib/errors.js';
import { hashPassword, verifyDummy, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import type { ChangePasswordInput, LoginInput } from './schemas.js';

const INT4_MAX = 2_147_483_647;

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Matrícula ou senha incorretas.');

function tooManyAttempts(retryAfter: number) {
  return new AppError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', undefined, {
    'Retry-After': String(retryAfter),
  });
}

/** Matrícula só com dígitos e dentro do INT; senão é tratada como inexistente. */
function toMatricula(value: string): number | null {
  if (!/^\d{1,10}$/.test(value)) return null;
  const matricula = Number(value);
  return matricula >= 1 && matricula <= INT4_MAX ? matricula : null;
}

/**
 * RN-A2. Inexistente e senha errada têm a mesma resposta e o mesmo custo (verify num
 * hash fictício). Inativo e condomínio inativo só aparecem com a senha certa.
 */
export async function login(input: LoginInput, ip: string): Promise<{ user: User; condominium: Condominium | null }> {
  const matriculaKey = input.matricula;
  const retryAfter = Math.max(loginLimiters.byMatricula.retryAfter(matriculaKey), loginLimiters.byIp.retryAfter(ip));
  if (retryAfter > 0) throw tooManyAttempts(retryAfter);

  const matricula = toMatricula(input.matricula);
  const found = matricula ? await prisma.user.findUnique({ where: { matricula }, include: { condominium: true } }) : null;
  const user = found && !found.deletedAt ? found : null;
  const ok = user ? await verifyPassword(user.passwordHash, input.password) : await verifyDummy(input.password);

  if (!user || !ok) {
    loginLimiters.byMatricula.fail(matriculaKey);
    loginLimiters.byIp.fail(ip);
    throw invalidCredentials();
  }
  loginLimiters.byMatricula.clear(matriculaKey);

  if (user.status !== 'active') throw new AppError(403, 'USER_INACTIVE', 'Seu acesso está inativo. Fale com o responsável.');
  if (user.condominium && user.condominium.status !== 'active') {
    throw new AppError(403, 'CONDOMINIUM_INACTIVE', 'O acesso deste condomínio está suspenso.');
  }

  const { condominium, ...updated } = await prisma.user.update({
    where: { matricula: user.matricula },
    data: { lastLoginAt: new Date() },
    include: { condominium: true },
  });
  return { user: updated, condominium };
}

/** RN-A5: confere a atual, exige uma nova diferente e invalida as outras sessões. */
export async function changePassword(user: User, input: ChangePasswordInput): Promise<User> {
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw unprocessable('WRONG_PASSWORD', 'A senha atual não confere.', { currentPassword: 'A senha atual não confere.' });
  }
  if (input.newPassword === input.currentPassword) {
    throw unprocessable('SAME_PASSWORD', 'A nova senha precisa ser diferente da atual.', {
      newPassword: 'A nova senha precisa ser diferente da atual.',
    });
  }
  return prisma.user.update({
    where: { matricula: user.matricula },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      tokenVersion: { increment: 1 },
    },
  });
}
