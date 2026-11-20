import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// unit: sem banco. integration: Postgres real (docker compose up -d db), nunca SQLite —
// enums, CHECKs e ON CONFLICT se comportam diferente (handoff, seção 15).
const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-com-pelo-menos-32-caracteres!!',
  FRONTEND_ORIGIN: 'http://localhost:8080',
  PUBLIC_API_URL: 'http://localhost:3000',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: path.join(os.tmpdir(), 'ipackage-test-storage'),
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          env: { ...baseEnv, DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused' },
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          env: {
            ...baseEnv,
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://ipackage:ipackage@localhost:5432/ipackage_test?schema=public',
          },
          globalSetup: ['tests/integration/global-setup.ts'],
          // Um arquivo por vez: todos compartilham o mesmo banco e o seed.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
