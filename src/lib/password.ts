import { randomInt } from 'node:crypto';
import argon2 from 'argon2';

// RN-A1: argon2id com os parâmetros mínimos da OWASP (19 MiB, 2 iterações, 1 thread).
const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Verificação contra um hash fictício, para a resposta de "matrícula inexistente"
 * levar o mesmo tempo que a de "senha errada" (handoff 9.2).
 */
export async function verifyDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('ipackage-dummy-password');
  await verifyPassword(await dummyHash, password);
  return false;
}

// RN-A4: 8 caracteres de um alfabeto sem 0/O/1/l/I, com CSPRNG.
const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTemporaryPassword(length = 8): string {
  let password = '';
  for (let i = 0; i < length; i++) password += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return password;
}
