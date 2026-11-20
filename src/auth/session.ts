import type { Response } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { Profile, User } from '@prisma/client';
import { env } from '../config/env.js';

// Sessão = JWT HS256 num cookie HttpOnly (handoff 9.1). Dura 12 h (um turno) e é
// renovada quando faltar menos de 4 h.

export const SESSION_COOKIE = 'ipk_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const RENEW_BELOW_SECONDS = 4 * 60 * 60;

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface SessionClaims {
  /** Matrícula */
  sub: string;
  /** Condomínio (null para owner) */
  cid: number | null;
  /** Perfil */
  prf: Profile;
  /** versao_token no momento da emissão */
  tv: number;
  iat: number;
  exp: number;
}

type SessionUser = Pick<User, 'matricula' | 'condominiumId' | 'profile' | 'tokenVersion'>;

export function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ cid: user.condominiumId, prf: user.profile, tv: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.matricula))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) return null;
    if (typeof payload.tv !== 'number' || typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null;
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export function shouldRenew(claims: SessionClaims, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  return claims.exp - nowSeconds < RENEW_BELOW_SECONDS;
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
});

export async function setSessionCookie(res: Response, user: SessionUser): Promise<void> {
  const token = await signSession(user);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}
