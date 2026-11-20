import { existsSync } from 'node:fs';
import { z } from 'zod';

// Variáveis de ambiente validadas na subida. Nos testes, o .env.test (ou o próprio
// ambiente) define tudo antes de importar a aplicação.
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) process.loadEnvFile('.env');

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().min(1),
    /** HS256: pelo menos 32 bytes. */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
    /** Origens do front liberadas no CORS, separadas por vírgula. */
    FRONTEND_ORIGIN: z.string().default('http://localhost:8080'),
    /** Cookie de sessão com Secure. Padrão: só em produção. */
    COOKIE_SECURE: booleanish.optional(),
    /** Valor de `trust proxy` do Express (ex.: 1 atrás de um proxy reverso). */
    TRUST_PROXY: z.string().optional(),
    /** URL pública da API, usada nas URLs assinadas do storage local. */
    PUBLIC_API_URL: z.url().default('http://localhost:3000'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('storage'),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_ENDPOINT: z.url().optional(),
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER !== 's3') return;
    for (const key of ['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'] as const) {
      if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} é obrigatório com STORAGE_DRIVER=s3` });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Variáveis de ambiente inválidas:\n${lines.join('\n')}`);
}

export const env = {
  ...parsed.data,
  COOKIE_SECURE: parsed.data.COOKIE_SECURE ?? parsed.data.NODE_ENV === 'production',
  FRONTEND_ORIGINS: parsed.data.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
};

export type Env = typeof env;
