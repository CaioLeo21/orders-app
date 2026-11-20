import sharp from 'sharp';
import request from 'supertest';
import { expect } from 'vitest';
import { seed } from '../../prisma/seed.js';
import { createApp } from '../../src/app.js';
import { loginLimiters } from '../../src/auth/rate-limit.js';
import { prisma } from '../../src/lib/prisma.js';

export { prisma };

export const app = createApp();
export const API = '/api/v1';

/** Volta o banco ao estado do seed (e zera o rate limit de login). */
export async function resetDb(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE "encomenda", "faturamento", "precificacao", "morador_casa", "morador", "casa", "usuario", "condominio" RESTART IDENTITY CASCADE`;
  await seed(prisma);
  loginLimiters.byMatricula.reset();
  loginLimiters.byIp.reset();
}

export type Agent = ReturnType<typeof request.agent>;

/** Cliente com cookie jar e o cabeçalho anti-CSRF que o front envia. */
export function client(): Agent {
  return request.agent(app).set('X-Requested-With', 'ipackage');
}

export async function loginAs(matricula: string, password = '123456'): Promise<Agent> {
  const agent = client();
  const res = await agent.post(`${API}/auth/login`).send({ matricula, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return agent;
}

/** Caminhos com null no JSON. O único null permitido é User.condominiumId (owner). */
export function nullPaths(value: unknown, path = '$'): string[] {
  if (value === null) return path.endsWith('.condominiumId') ? [] : [path];
  if (Array.isArray(value)) return value.flatMap((item, i) => nullPaths(item, `${path}[${i}]`));
  if (typeof value === 'object' && value) return Object.entries(value).flatMap(([key, item]) => nullPaths(item, `${path}.${key}`));
  return [];
}

export function expectError(res: request.Response, status: number, code: string): void {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  expect(res.body.error?.code).toBe(code);
  expect(typeof res.body.error?.message).toBe('string');
}

export const pngBuffer = () => sharp({ create: { width: 120, height: 40, channels: 3, background: '#ffffff' } }).png().toBuffer();
export const jpegBuffer = () => sharp({ create: { width: 64, height: 64, channels: 3, background: '#3366cc' } }).jpeg().toBuffer();

export async function upload(agent: Agent, purpose: 'package-photo' | 'signature', file?: Buffer, filename = 'file.png') {
  return agent
    .post(`${API}/uploads`)
    .field('purpose', purpose)
    .attach('file', file ?? (purpose === 'signature' ? await pngBuffer() : await jpegBuffer()), filename);
}

export async function uploadKey(agent: Agent, purpose: 'package-photo' | 'signature'): Promise<string> {
  const res = await upload(agent, purpose);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.key as string;
}

/** "hoje" em São Paulo, para comparar com as regras de data. */
export { todayYmd } from '../../src/lib/dates.js';
