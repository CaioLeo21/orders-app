import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FailureLimiter } from '../../src/auth/rate-limit.js';
import { generateTemporaryPassword, hashPassword, verifyDummy, verifyPassword } from '../../src/lib/password.js';
import { LocalStorage } from '../../src/storage/local.js';
import { buildKey, keyBelongsTo } from '../../src/storage/keys.js';

describe('senhas (RN-A1, RN-A4)', () => {
  it('argon2id: verifica a certa, recusa a errada', async () => {
    const hash = await hashPassword('123456');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=19456,p=1,t=2');
    expect(await verifyPassword(hash, '123456')).toBe(true);
    expect(await verifyPassword(hash, '1234567')).toBe(false);
    expect(await verifyPassword('não-é-hash', '123456')).toBe(false);
    expect(await verifyDummy('qualquer')).toBe(false);
  });

  it('senha provisória: 8 caracteres do alfabeto sem 0/O/1/l/I', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    }
  });
});

describe('FailureLimiter', () => {
  it('bloqueia na 6ª tentativa errada e libera depois da janela', () => {
    const limiter = new FailureLimiter(5, 60_000);
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(limiter.retryAfter('1002', now)).toBe(0);
      limiter.fail('1002', now);
    }
    expect(limiter.retryAfter('1002', now)).toBe(60);
    expect(limiter.retryAfter('1003', now)).toBe(0);
    expect(limiter.retryAfter('1002', now + 60_000)).toBe(0);
  });

  it('clear zera a chave (login certo)', () => {
    const limiter = new FailureLimiter(1, 60_000);
    limiter.fail('x');
    expect(limiter.retryAfter('x')).toBeGreaterThan(0);
    limiter.clear('x');
    expect(limiter.retryAfter('x')).toBe(0);
  });
});

describe('chaves de upload (RN-E3, RN-E5)', () => {
  it('pertence ao condomínio e ao propósito', () => {
    const key = buildKey(1, 'signature', 'png', new Date('2026-10-15T12:00:00Z'));
    expect(key).toMatch(/^condo\/1\/signature\/2026\/10\/[0-9a-f-]{36}\.png$/);
    expect(keyBelongsTo(key, 1, 'signature')).toBe(true);
    expect(keyBelongsTo(key, 2, 'signature')).toBe(false);
    expect(keyBelongsTo(key, 1, 'package-photo')).toBe(false);
    expect(keyBelongsTo('condo/1/signature/../../etc/passwd', 1, 'signature')).toBe(false);
    expect(keyBelongsTo('condo/11/signature/2026/10/x.png', 1, 'signature')).toBe(false);
  });
});

describe('LocalStorage', () => {
  it('URL assinada: válida, adulterada e expirada', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ipk-storage-'));
    const storage = new LocalStorage(dir, 'segredo-de-teste-com-32-caracteres!!', 'http://api.test');
    const key = buildKey(1, 'package-photo', 'jpg');
    await storage.put(key, Buffer.from('x'));
    expect(await storage.exists(key)).toBe(true);

    const url = new URL(await storage.signedUrl(key));
    expect(url.pathname).toBe(`/api/v1/files/${key}`);
    const exp = url.searchParams.get('exp')!;
    const sig = url.searchParams.get('sig')!;
    expect(storage.verify(key, exp, sig)).toBe(true);
    expect(storage.verify(key, exp, `${sig.slice(0, -1)}x`)).toBe(false);
    expect(storage.verify(buildKey(1, 'package-photo', 'jpg'), exp, sig)).toBe(false);

    const expired = new URL(await storage.signedUrl(key, -10));
    expect(storage.verify(key, expired.searchParams.get('exp')!, expired.searchParams.get('sig')!)).toBe(false);
    expect(() => storage.read('../segredo')).toThrow();
  });
});
