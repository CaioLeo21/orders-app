import { z } from 'zod';
import { phoneDigits } from '../../lib/format.js';
import { optionalText, recordStatus, requiredText } from '../../lib/validation.js';

/** Unidade como digitada no formulário: bloco/quadra + número (+ rua em casas). */
export const unitInputSchema = z.object({
  group: z.string().trim().max(30, 'Bloco/quadra com no máximo 30 caracteres.').optional(),
  number: z.string({ error: 'Informe o número da unidade.' }).trim().max(30, 'Número com no máximo 30 caracteres.'),
  street: z.string().trim().max(120, 'Rua com no máximo 120 caracteres.').optional(),
});

export const residentInputSchema = z.object({
  name: requiredText(120, 'Informe o nome do morador.'),
  // RN-M4: opcional; se vier, só dígitos, 10 ou 11 (com DDD).
  phone: z
    .string()
    .nullish()
    .transform((value) => phoneDigits(value ?? ''))
    .refine((digits) => digits.length === 0 || digits.length === 10 || digits.length === 11, 'Telefone com DDD, ex.: (11) 99999-9999.'),
  residentType: z.enum(['owner', 'tenant', 'other'], { error: 'Escolha o tipo de morador.' }),
  residentTypeDescription: optionalText(60),
  units: z.array(unitInputSchema, { error: 'Informe pelo menos uma unidade.' }).max(50, 'Unidades demais para um morador.'),
});

export const residentStatusSchema = z.object({ status: recordStatus });

export type UnitInput = z.output<typeof unitInputSchema>;
export type ResidentInput = z.output<typeof residentInputSchema>;
