import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Condominium, Profile, User } from '@prisma/client';
import { AppError, forbidden, unauthenticated } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { UnitKind } from '../lib/format.js';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie, shouldRenew, verifySession } from './session.js';

export interface AuthContext {
  matricula: number;
  profile: Profile;
  condominiumId: number | null;
  user: User;
  condominium: Condominium | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

interface AuthenticateOptions {
  /** Libera a rota mesmo com trocar_senha = true (RN-A3: /me e /auth/change-password). */
  allowPasswordChange?: boolean;
}

/**
 * Carrega a sessão e confere, a cada requisição, se o usuário segue ativo, se a
 * versao_token bate, se o condomínio está ativo e se a senha provisória já foi trocada.
 * É isso que derruba sessões ao inativar usuário/condomínio ou trocar a senha.
 */
export function authenticate(options: AuthenticateOptions = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const claims = typeof token === 'string' ? await verifySession(token) : null;
    if (!claims) {
      if (token) clearSessionCookie(res);
      throw unauthenticated();
    }

    const user = await prisma.user.findUnique({ where: { matricula: Number(claims.sub) }, include: { condominium: true } });
    if (!user || user.deletedAt) {
      clearSessionCookie(res);
      throw unauthenticated();
    }
    if (user.status !== 'active') throw new AppError(403, 'USER_INACTIVE', 'Seu acesso está inativo. Fale com o responsável.');
    if (claims.tv !== user.tokenVersion) {
      clearSessionCookie(res);
      throw unauthenticated();
    }
    if (user.condominium && user.condominium.status !== 'active') {
      throw new AppError(403, 'CONDOMINIUM_INACTIVE', 'O acesso deste condomínio está suspenso.');
    }
    if (user.mustChangePassword && !options.allowPasswordChange) {
      throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Troque a senha provisória para continuar.');
    }

    if (shouldRenew(claims)) await setSessionCookie(res, user);

    const { condominium, ...plainUser } = user;
    req.auth = {
      matricula: user.matricula,
      profile: user.profile,
      condominiumId: user.condominiumId,
      user: plainUser,
      condominium,
    };
    next();
  };
}

/** 403 FORBIDDEN se o perfil do usuário não estiver na lista. Use depois de authenticate(). */
export function requireProfile(...profiles: Profile[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth || !profiles.includes(req.auth.profile)) throw forbidden();
    next();
  };
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}

export interface TenantContext {
  matricula: number;
  profile: Profile;
  condominiumId: number;
  condominium: Condominium;
  kind: UnitKind;
}

/** Escopo da portaria: o condomínio vem SEMPRE do token, nunca do request (seção 7). */
export function getTenant(req: Request): TenantContext {
  const auth = getAuth(req);
  if (auth.condominiumId === null || !auth.condominium) throw forbidden();
  return {
    matricula: auth.matricula,
    profile: auth.profile,
    condominiumId: auth.condominiumId,
    condominium: auth.condominium,
    kind: auth.condominium.type,
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defesa adicional contra CSRF (handoff 9.1): escrita só com Content-Type JSON ou com
 * o cabeçalho X-Requested-With: ipackage (obrigatório no upload multipart e nas
 * requisições sem corpo).
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get('x-requested-with') === 'ipackage' || req.is('application/json')) return next();
  throw forbidden('Requisição recusada. Envie o cabeçalho X-Requested-With: ipackage.');
};
