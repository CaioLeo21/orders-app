import { z } from 'zod';
import { notFound, validationError } from './errors.js';

z.config(z.locales.ptBR());

/**
 * Valida com zod; em caso de erro lança 422 VALIDATION_ERROR com details.fields.
 * Corpo ausente (req.body undefined no Express 5) é tratado como objeto vazio.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join('.') || '_';
    fields[path] ??= issue.message;
  }
  throw validationError(fields);
}

const INT4_MAX = 2_147_483_647;

/** Id de rota (`:id`, `:matricula`). Qualquer coisa que não seja um inteiro válido vira 404. */
export function parseId(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) throw notFound();
  const id = Number(value);
  if (id < 1 || id > INT4_MAX) throw notFound();
  return id;
}

// ---------------------------------------------------------------------------
// Blocos reutilizáveis
// ---------------------------------------------------------------------------

/** Texto obrigatório: aparado, de 1 a `max` caracteres. */
export const requiredText = (max: number, emptyMessage: string) =>
  z
    .string({ error: emptyMessage })
    .trim()
    .min(1, emptyMessage)
    .max(max, `Use no máximo ${max} caracteres.`);

/** Texto opcional: aparado; vazio vira undefined. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Id vindo do front (sempre string no JSON). */
export const idString = (message = 'Identificador inválido.') =>
  z
    .string({ error: message })
    .regex(/^\d{1,10}$/, message)
    .transform(Number)
    .refine((value) => value >= 1 && value <= INT4_MAX, message);

/** Data de calendário "YYYY-MM-DD" válida. */
export const ymdString = (message = 'Data inválida (use AAAA-MM-DD).') =>
  z
    .string({ error: message })
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, message);

/** Competência "YYYY-MM". */
export const competenceString = (message = 'Competência inválida (use AAAA-MM).') =>
  z.string({ error: message }).regex(/^\d{4}-(0[1-9]|1[0-2])$/, message);

/** Valor em reais: positivo, no máximo 2 casas decimais, cabe em DECIMAL(10,2). */
export const money = (label = 'Valor') =>
  z
    .number({ error: `${label} inválido.` })
    .positive(`${label} deve ser maior que zero.`)
    .max(99_999_999.99, `${label} acima do permitido.`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, `${label} com no máximo 2 casas decimais.`);

export const recordStatus = z.enum(['active', 'inactive'], { error: 'Status inválido.' });
