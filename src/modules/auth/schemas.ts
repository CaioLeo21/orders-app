import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../lib/password.js';

export const loginSchema = z.object({
  matricula: z.string({ error: 'Informe a matrícula.' }).trim().min(1, 'Informe a matrícula.').max(20, 'Matrícula inválida.'),
  password: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.').max(1024, 'Senha inválida.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'Informe a senha atual.' }).min(1, 'Informe a senha atual.').max(1024, 'Senha inválida.'),
  newPassword: z
    .string({ error: 'Informe a nova senha.' })
    .min(PASSWORD_MIN_LENGTH, `A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(PASSWORD_MAX_LENGTH, `A nova senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`),
});

export type LoginInput = z.output<typeof loginSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
