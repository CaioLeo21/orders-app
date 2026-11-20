import { z } from 'zod';
import { SLUG_PATTERN } from '../../lib/format.js';
import { competenceString, idString, money, optionalText, recordStatus, requiredText, ymdString } from '../../lib/validation.js';

export const slugSchema = z
  .string({ error: 'Informe o slug.' })
  .trim()
  .min(1, 'Informe o slug.')
  .max(60, 'Slug com no máximo 60 caracteres.')
  .regex(SLUG_PATTERN, 'Use só letras minúsculas, números e hífens (ex.: residencial-vista-verde).');

export const condominiumInputSchema = z.object({
  name: requiredText(120, 'Informe o nome do condomínio.'),
  type: z.enum(['apartment', 'house'], { error: 'Escolha o tipo do condomínio.' }),
  slug: slugSchema,
  address: optionalText(255),
});

export const createCondominiumSchema = z.object({
  condominium: condominiumInputSchema,
  adminName: requiredText(120, 'Informe o nome do administrador.'),
});

export const slugAvailabilityQuerySchema = z.object({
  slug: slugSchema,
  exceptId: idString().optional(),
});

export const condominiumStatusSchema = z.object({ status: recordStatus });

export const planInputSchema = z
  .object({
    description: requiredText(60, 'Informe o nome do plano.'),
    unitLimit: z.number({ error: 'Informe o limite de unidades.' }).int('O limite deve ser um número inteiro.').positive('O limite deve ser maior que zero.').max(1_000_000),
    price: money('Preço'),
    validFrom: ymdString('Início da vigência inválido (use AAAA-MM-DD).'),
    validUntil: ymdString('Fim da vigência inválido (use AAAA-MM-DD).').nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.validUntil && value.validUntil < value.validFrom) {
      ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'O fim da vigência não pode ser antes do início.' });
    }
  });

const invoiceStatusEnum = z.enum(['open', 'overdue', 'paid'], { error: 'Status inválido.' });

export const listInvoicesQuerySchema = z.object({
  competence: competenceString().optional(),
  status: invoiceStatusEnum.optional(),
});

export const invoiceSummaryQuerySchema = z.object({ competence: competenceString().optional() });

export const generateInvoicesSchema = z.object({ competence: competenceString() });

export const paymentSchema = z.object({
  amountPaid: money('Valor pago'),
  paidAt: ymdString('Data do pagamento inválida (use AAAA-MM-DD).'),
});

export type CondominiumInput = z.output<typeof condominiumInputSchema>;
export type PlanInput = z.output<typeof planInputSchema>;
export type PaymentInput = z.output<typeof paymentSchema>;
