-- Modelagem iPackage v2: baseline nova (sem dados de produção a migrar).
-- Gerada com `prisma migrate diff --from-empty` e completada à mão com a extensão
-- unaccent (busca de encomendas) e os CHECKs do handoff (seção 5).

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "tipo_condominio" AS ENUM ('apartment', 'house');

-- CreateEnum
CREATE TYPE "status_registro" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "perfil_usuario" AS ENUM ('doorman', 'manager', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "turno" AS ENUM ('morning', 'afternoon', 'night');

-- CreateEnum
CREATE TYPE "tipo_morador" AS ENUM ('owner', 'tenant', 'other');

-- CreateEnum
CREATE TYPE "tipo_encomenda" AS ENUM ('envelope', 'box', 'bag', 'other');

-- CreateEnum
CREATE TYPE "tamanho_encomenda" AS ENUM ('small', 'medium', 'large');

-- CreateTable
CREATE TABLE "condominio" (
    "id_condominio" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tipo_condominio" "tipo_condominio" NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "status" "status_registro" NOT NULL DEFAULT 'active',
    "endereco" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "condominio_pkey" PRIMARY KEY ("id_condominio")
);

-- CreateTable
CREATE TABLE "casa" (
    "id_casa" SERIAL NOT NULL,
    "fk_id_condominio" INTEGER NOT NULL,
    "bloco" VARCHAR(30),
    "apartamento" VARCHAR(30),
    "quadra" VARCHAR(30),
    "casa" VARCHAR(30),
    "rua" VARCHAR(120),
    "chave" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "casa_pkey" PRIMARY KEY ("id_casa")
);

-- CreateTable
CREATE TABLE "morador" (
    "id_morador" SERIAL NOT NULL,
    "fk_id_condominio" INTEGER NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "telefone" VARCHAR(11),
    "tipo_morador" "tipo_morador" NOT NULL,
    "tipo_morador_descricao" VARCHAR(60),
    "status" "status_registro" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "morador_pkey" PRIMARY KEY ("id_morador")
);

-- CreateTable
CREATE TABLE "morador_casa" (
    "id_morador_casa" SERIAL NOT NULL,
    "fk_id_morador" INTEGER NOT NULL,
    "fk_id_casa" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrado_em" TIMESTAMPTZ(3),

    CONSTRAINT "morador_casa_pkey" PRIMARY KEY ("id_morador_casa")
);

-- CreateTable
CREATE TABLE "usuario" (
    "matricula" SERIAL NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "perfil" "perfil_usuario" NOT NULL,
    "turno" "turno",
    "status" "status_registro" NOT NULL DEFAULT 'active',
    "trocar_senha" BOOLEAN NOT NULL DEFAULT true,
    "versao_token" INTEGER NOT NULL DEFAULT 0,
    "senha_alterada_em" TIMESTAMPTZ(3),
    "ultimo_acesso_em" TIMESTAMPTZ(3),
    "fk_id_condominio" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("matricula")
);

-- CreateTable
CREATE TABLE "encomenda" (
    "id_encomenda" SERIAL NOT NULL,
    "fk_id_condominio" INTEGER NOT NULL,
    "fk_id_morador_casa" INTEGER NOT NULL,
    "remetente" VARCHAR(120) NOT NULL,
    "codigo_rastreio" VARCHAR(60),
    "tipo" "tipo_encomenda" NOT NULL,
    "tamanho" "tamanho_encomenda" NOT NULL,
    "observacao" VARCHAR(500),
    "link_foto" VARCHAR(500),
    "data_chegada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fk_usuario_matricula" INTEGER NOT NULL,
    "data_retirada" TIMESTAMPTZ(3),
    "recebedor" VARCHAR(120),
    "documento_recebedor" VARCHAR(30),
    "link_assinatura" VARCHAR(500),
    "fk_usuario_retirada" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "motivo_exclusao" VARCHAR(500),
    "fk_usuario_exclusao" INTEGER,

    CONSTRAINT "encomenda_pkey" PRIMARY KEY ("id_encomenda")
);

-- CreateTable
CREATE TABLE "precificacao" (
    "id_precificacao" SERIAL NOT NULL,
    "descricao" VARCHAR(60) NOT NULL,
    "limite_unidade" INTEGER NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "vigencia_fim" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "precificacao_pkey" PRIMARY KEY ("id_precificacao")
);

-- CreateTable
CREATE TABLE "faturamento" (
    "id_faturamento" SERIAL NOT NULL,
    "fk_id_condominio" INTEGER NOT NULL,
    "fk_id_precificacao" INTEGER NOT NULL,
    "competencia" DATE NOT NULL,
    "valor_a_pagar" DECIMAL(10,2) NOT NULL,
    "valor_pago" DECIMAL(10,2),
    "pago_em" DATE,
    "vencimento" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "faturamento_pkey" PRIMARY KEY ("id_faturamento")
);

-- CreateIndex
CREATE UNIQUE INDEX "condominio_slug_key" ON "condominio"("slug");

-- CreateIndex
CREATE INDEX "fk_casa_condominio_idx" ON "casa"("fk_id_condominio");

-- CreateIndex
CREATE UNIQUE INDEX "casa_condominio_chave_key" ON "casa"("fk_id_condominio", "chave");

-- CreateIndex
CREATE INDEX "morador_condominio_status_idx" ON "morador"("fk_id_condominio", "status");

-- CreateIndex
CREATE INDEX "fk_morador_casa_casa_idx" ON "morador_casa"("fk_id_casa");

-- CreateIndex
CREATE UNIQUE INDEX "morador_casa_morador_casa_key" ON "morador_casa"("fk_id_morador", "fk_id_casa");

-- CreateIndex
CREATE INDEX "usuario_condominio_status_idx" ON "usuario"("fk_id_condominio", "status");

-- CreateIndex
CREATE INDEX "encomenda_condominio_retirada_idx" ON "encomenda"("fk_id_condominio", "data_retirada");

-- CreateIndex
CREATE INDEX "encomenda_condominio_chegada_idx" ON "encomenda"("fk_id_condominio", "data_chegada" DESC);

-- CreateIndex
CREATE INDEX "fk_encomenda_morador_casa_idx" ON "encomenda"("fk_id_morador_casa");

-- CreateIndex
CREATE INDEX "fk_encomenda_usuario_idx" ON "encomenda"("fk_usuario_matricula");

-- CreateIndex
CREATE INDEX "fk_encomenda_usuario_retirada_idx" ON "encomenda"("fk_usuario_retirada");

-- CreateIndex
CREATE INDEX "fk_encomenda_usuario_exclusao_idx" ON "encomenda"("fk_usuario_exclusao");

-- CreateIndex
CREATE INDEX "faturamento_competencia_idx" ON "faturamento"("competencia");

-- CreateIndex
CREATE INDEX "fk_faturamento_precificacao_idx" ON "faturamento"("fk_id_precificacao");

-- CreateIndex
CREATE UNIQUE INDEX "faturamento_condominio_competencia_key" ON "faturamento"("fk_id_condominio", "competencia");

-- AddForeignKey
ALTER TABLE "casa" ADD CONSTRAINT "casa_fk_id_condominio_fkey" FOREIGN KEY ("fk_id_condominio") REFERENCES "condominio"("id_condominio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morador" ADD CONSTRAINT "morador_fk_id_condominio_fkey" FOREIGN KEY ("fk_id_condominio") REFERENCES "condominio"("id_condominio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morador_casa" ADD CONSTRAINT "morador_casa_fk_id_morador_fkey" FOREIGN KEY ("fk_id_morador") REFERENCES "morador"("id_morador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morador_casa" ADD CONSTRAINT "morador_casa_fk_id_casa_fkey" FOREIGN KEY ("fk_id_casa") REFERENCES "casa"("id_casa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_fk_id_condominio_fkey" FOREIGN KEY ("fk_id_condominio") REFERENCES "condominio"("id_condominio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_fk_id_condominio_fkey" FOREIGN KEY ("fk_id_condominio") REFERENCES "condominio"("id_condominio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_fk_id_morador_casa_fkey" FOREIGN KEY ("fk_id_morador_casa") REFERENCES "morador_casa"("id_morador_casa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_fk_usuario_matricula_fkey" FOREIGN KEY ("fk_usuario_matricula") REFERENCES "usuario"("matricula") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_fk_usuario_retirada_fkey" FOREIGN KEY ("fk_usuario_retirada") REFERENCES "usuario"("matricula") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_fk_usuario_exclusao_fkey" FOREIGN KEY ("fk_usuario_exclusao") REFERENCES "usuario"("matricula") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturamento" ADD CONSTRAINT "faturamento_fk_id_condominio_fkey" FOREIGN KEY ("fk_id_condominio") REFERENCES "condominio"("id_condominio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturamento" ADD CONSTRAINT "faturamento_fk_id_precificacao_fkey" FOREIGN KEY ("fk_id_precificacao") REFERENCES "precificacao"("id_precificacao") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===========================================================================
-- CHECKs (handoff, seção 5). O Prisma não os declara, mas os preserva.
-- A consistência de tenant entre encomenda e a casa do vínculo (RN-E2) é
-- garantida no serviço, na mesma transação (sem trigger nesta versão).
-- ===========================================================================

-- ---------- casa ----------
-- Prédio usa bloco/apartamento; casas usam quadra/casa/rua. Exatamente um número preenchido.
ALTER TABLE "casa" ADD CONSTRAINT "casa_numero_ck"
  CHECK ((("apartamento" IS NOT NULL) <> ("casa" IS NOT NULL)));
ALTER TABLE "casa" ADD CONSTRAINT "casa_apto_sem_quadra_ck"
  CHECK ("apartamento" IS NULL OR ("quadra" IS NULL AND "casa" IS NULL AND "rua" IS NULL));
ALTER TABLE "casa" ADD CONSTRAINT "casa_casa_sem_bloco_ck"
  CHECK ("casa" IS NULL OR ("bloco" IS NULL AND "apartamento" IS NULL));
ALTER TABLE "casa" ADD CONSTRAINT "casa_chave_ck" CHECK ("chave" = lower("chave") AND "chave" LIKE '%|%');

-- ---------- morador ----------
ALTER TABLE "morador" ADD CONSTRAINT "morador_telefone_ck"
  CHECK ("telefone" IS NULL OR "telefone" ~ '^[0-9]{10,11}$');
ALTER TABLE "morador" ADD CONSTRAINT "morador_tipo_descricao_ck"
  CHECK ("tipo_morador" = 'other' OR "tipo_morador_descricao" IS NULL);

-- ---------- usuario ----------
-- owner ⇔ sem condomínio
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_owner_condominio_ck"
  CHECK (("perfil" = 'owner') = ("fk_id_condominio" IS NULL));
-- turno ⇔ porteiro
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_turno_ck"
  CHECK (("perfil" = 'doorman') = ("turno" IS NOT NULL));

-- ---------- encomenda ----------
-- Retirada é tudo ou nada: data, nome de quem retirou, assinatura e porteiro que entregou.
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_retirada_ck" CHECK (
  ("data_retirada" IS NULL AND "recebedor" IS NULL AND "link_assinatura" IS NULL
     AND "fk_usuario_retirada" IS NULL AND "documento_recebedor" IS NULL)
  OR
  ("data_retirada" IS NOT NULL AND "recebedor" IS NOT NULL AND "link_assinatura" IS NOT NULL
     AND "fk_usuario_retirada" IS NOT NULL)
);
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_retirada_depois_chegada_ck"
  CHECK ("data_retirada" IS NULL OR "data_retirada" >= "data_chegada");
-- Exclusão sempre com motivo e autor
ALTER TABLE "encomenda" ADD CONSTRAINT "encomenda_exclusao_ck" CHECK (
  ("deleted_at" IS NULL AND "motivo_exclusao" IS NULL AND "fk_usuario_exclusao" IS NULL)
  OR ("deleted_at" IS NOT NULL AND length(trim("motivo_exclusao")) > 0 AND "fk_usuario_exclusao" IS NOT NULL)
);

-- ---------- precificacao ----------
ALTER TABLE "precificacao" ADD CONSTRAINT "precificacao_limite_ck" CHECK ("limite_unidade" > 0);
ALTER TABLE "precificacao" ADD CONSTRAINT "precificacao_preco_ck" CHECK ("preco" > 0);
ALTER TABLE "precificacao" ADD CONSTRAINT "precificacao_vigencia_ck"
  CHECK ("vigencia_fim" IS NULL OR "vigencia_fim" >= "vigencia_inicio");

-- ---------- faturamento ----------
ALTER TABLE "faturamento" ADD CONSTRAINT "faturamento_competencia_dia1_ck"
  CHECK (EXTRACT(DAY FROM "competencia") = 1);
ALTER TABLE "faturamento" ADD CONSTRAINT "faturamento_valor_ck" CHECK ("valor_a_pagar" > 0);
ALTER TABLE "faturamento" ADD CONSTRAINT "faturamento_pagamento_ck"
  CHECK ((("valor_pago" IS NULL) = ("pago_em" IS NULL)) AND ("valor_pago" IS NULL OR "valor_pago" > 0));
