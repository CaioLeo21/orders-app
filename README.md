# orders-app — API do iPackage

Backend do iPackage (portaria de condomínios): encomendas, moradores e unidades, equipe,
planos e faturamento. Implementa o contrato de `condo-order-hub/docs/backend-handoff.md`
(modelagem v2), consumido pelo front `condo-order-hub`.

**Stack:** Node ≥ 22 · Express 5 · TypeScript (ESM) · Prisma 6 + PostgreSQL · zod 4 ·
argon2id · JWT em cookie HttpOnly · sharp · S3 ou disco local · Vitest + Supertest.

## Subindo localmente

```bash
npm install
cp .env.example .env              # ajuste JWT_SECRET e DATABASE_URL
docker compose up -d db           # Postgres 16 com os bancos ipackage e ipackage_test
npx prisma migrate reset          # aplica a migration (com os CHECKs) e roda o seed
npm run dev                       # http://localhost:3000/api/v1
```

- Documentação OpenAPI 3.1 (só fora de produção): `http://localhost:3000/api/v1/docs`
  (JSON em `/api/v1/docs/openapi.json`).
- Logins do seed (senha `123456`): `1001` admin · `1002` porteiro · `1005` responsável ·
  `2001` admin do condomínio de casas · `9001` dono do iPackage (owner).

> Se o banco `ordersapp` antigo (tabelas `condo/house/person/doorman/order`) ainda existir,
> o `prisma migrate reset` apaga essas tabelas: esta versão é uma **baseline nova**, sem
> migração de dados (decisão registrada no PR).

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | API com reload (tsx watch) |
| `npm run build` / `npm start` | Compila para `dist/` e roda |
| `npm run typecheck` | `tsc --noEmit` em tudo (código, seed e testes) |
| `npm test` | Testes unitários (sem banco) |
| `npm run test:integration` | Testes de integração num Postgres real (`ipackage_test`) |
| `npm run db:migrate` / `db:deploy` / `db:reset` / `db:seed` | Prisma Migrate e seed |

Os testes de integração usam `TEST_DATABASE_URL` (padrão: `ipackage_test` do docker-compose)
e recusam qualquer banco cujo nome não contenha `test`. Por padrão o setup roda
`prisma migrate reset`; com `TEST_DB_MIGRATE=deploy` ele só aplica as migrations (banco
vazio, ex.: CI).

## Estrutura

```
prisma/
  schema.prisma                 banco em português snake_case, código em inglês (@map)
  migrations/…/migration.sql    baseline + extensão unaccent + CHECKs (seção 5)
  seed.ts                       espelha src/data/mockData.ts do front
src/
  app.ts, server.ts             Express (helmet, CORS, pino, escopo por perfil)
  config/env.ts                 variáveis de ambiente validadas
  auth/                         sessão JWT, middleware, permissions.ts, rate limit
  lib/                          erros, validação, serializers, datas (America/Sao_Paulo)
  storage/                      drivers local e S3, chaves de upload
  modules/                      auth, packages, units, residents, users, uploads, admin, files, docs
tests/unit, tests/integration
```

## Contrato e convenções

- Base `/api/v1`, JSON em camelCase. Ids sempre string; instantes ISO UTC; datas
  `YYYY-MM-DD`; competência `YYYY-MM`; dinheiro em `number`; campos opcionais vazios são
  **omitidos** (exceções: `User.condominiumId` é `null` para o owner e `Resident.phone`
  é `""` quando vazio).
- Erros: `{ "error": { "code", "message", "details"? } }`, com mensagem em pt-BR.
  Validação → 422 `VALIDATION_ERROR` com `details.fields`.
- **Sessão:** cookie `ipk_session` (HttpOnly, SameSite=Lax, 12 h, renovado quando faltar
  menos de 4 h). O front deve usar `credentials: 'include'`.
- **CSRF:** toda escrita precisa de `Content-Type: application/json` **ou** do cabeçalho
  `X-Requested-With: ipackage`. O upload (multipart) e as rotas sem corpo (logout, reset de
  senha, encerrar plano…) exigem o cabeçalho; o mais simples é o front enviá-lo sempre.
- **Tenant:** o condomínio vem sempre do token. Ids de outro condomínio respondem 404.
- **Uploads:** `POST /uploads` (multipart: `file` + `purpose`) devolve `{ key, url }`. O front
  envia a `key` em `photoUrl`/`signatureUrl`; as respostas trazem URLs GET assinadas de 15 min.
  Com `STORAGE_DRIVER=local`, as URLs apontam para `/api/v1/files/...` (HMAC); com `s3`,
  direto para o bucket privado.

## Variáveis de ambiente

Veja `.env.example`. Obrigatórias: `DATABASE_URL`, `JWT_SECRET` (≥ 32 caracteres). Para S3:
`STORAGE_DRIVER=s3`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` (e
`STORAGE_ENDPOINT` para MinIO/R2). Em produção, rode atrás de HTTPS e defina `TRUST_PROXY`.
