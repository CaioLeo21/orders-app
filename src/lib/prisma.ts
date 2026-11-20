import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type Tx = Prisma.TransactionClient;

/** Violação de unicidade (P2002), opcionalmente num campo/índice específico. */
export function isUniqueViolation(error: unknown, target?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  if (!target) return true;
  const meta = error.meta?.target;
  return Array.isArray(meta) ? meta.includes(target) : String(meta ?? '').includes(target);
}
