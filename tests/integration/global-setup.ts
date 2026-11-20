import { execSync } from 'node:child_process';

// Prepara o banco de TESTE com as migrations (inclui os CHECKs). Recusa qualquer banco
// cujo nome não tenha "test", para nunca apagar o banco de desenvolvimento — a não ser
// que TEST_DB_CONFIRM repita o nome do banco (ex.: um banco descartável na nuvem).
//   padrão                  → prisma migrate reset (recria do zero)
//   TEST_DB_MIGRATE=deploy  → prisma migrate deploy (banco novo/vazio, ex.: CI)
// Cada arquivo de teste ainda volta os dados ao estado do seed (resetDb).
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://ipackage:ipackage@localhost:5432/ipackage_test?schema=public';
  const database = new URL(url).pathname.slice(1);
  if (!database.includes('test') && process.env.TEST_DB_CONFIRM !== database) {
    throw new Error(
      `TEST_DATABASE_URL precisa apontar para um banco de teste (recebido: "${database}"). ` +
        `Se ele for descartável, confirme com TEST_DB_CONFIRM=${database}.`,
    );
  }
  const command =
    process.env.TEST_DB_MIGRATE === 'deploy'
      ? 'npx prisma migrate deploy'
      : 'npx prisma migrate reset --force --skip-seed --skip-generate';
  execSync(command, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
