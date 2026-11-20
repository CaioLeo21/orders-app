import { z } from 'zod';
import { recordStatus, requiredText } from '../../lib/validation.js';

/** UserInput. Quando profile ≠ doorman, shift é ignorado e gravado como NULL (RN-A11). */
export const userInputSchema = z
  .object({
    name: requiredText(120, 'Informe o nome.'),
    profile: z.enum(['doorman', 'manager', 'admin'], { error: 'Escolha o perfil.' }),
    shift: z.enum(['morning', 'afternoon', 'night'], { error: 'Escolha o turno.' }).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.profile === 'doorman' && !value.shift) ctx.addIssue({ code: 'custom', path: ['shift'], message: 'Escolha o turno do porteiro.' });
  })
  .transform((value) => ({ ...value, shift: value.profile === 'doorman' ? value.shift! : null }));

export const userStatusSchema = z.object({ status: recordStatus });

export type UserInput = z.output<typeof userInputSchema>;
