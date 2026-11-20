import { z } from 'zod';
import { idString, optionalText, requiredText } from '../../lib/validation.js';

const packageKind = z.enum(['envelope', 'box', 'bag', 'other'], { error: 'Escolha o tipo da encomenda.' });
const packageSize = z.enum(['small', 'medium', 'large'], { error: 'Escolha o tamanho da encomenda.' });

const instant = (label: string) =>
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label}: data/hora inválida (use ISO 8601).`)
    .transform((value) => new Date(value));

export const listPackagesQuerySchema = z.object({
  status: z.enum(['pending', 'collected'], { error: 'Status inválido.' }).optional(),
  /** Início do período (inclusive). Filtra receivedAt das pendentes e collectedAt das retiradas. */
  from: instant('from').optional(),
  /** Fim do período (inclusive). */
  to: instant('to').optional(),
  q: z.string().trim().max(100, 'Busca com no máximo 100 caracteres.').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200, 'pageSize máximo é 200.').default(50),
});

export const newPackageSchema = z.object({
  residentUnitId: idString('Escolha o morador da unidade.'),
  senderCompany: requiredText(120, 'Informe o remetente.'),
  trackingCode: optionalText(60),
  kind: packageKind,
  size: packageSize,
  notes: optionalText(500),
  /** Chave devolvida por POST /uploads (purpose = package-photo). */
  photoUrl: optionalText(500),
});

/** RN-E4: só estes campos. "" em trackingCode/notes limpa o campo. */
export const packageEditSchema = z.object({
  senderCompany: requiredText(120, 'Informe o remetente.').optional(),
  trackingCode: z.string().trim().max(60, 'Use no máximo 60 caracteres.').optional(),
  kind: packageKind.optional(),
  size: packageSize.optional(),
  notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional(),
});

export const pickupSchema = z.object({
  collectedBy: requiredText(120, 'Informe quem retirou.'),
  collectedByDocument: optionalText(30),
  /** Chave devolvida por POST /uploads (purpose = signature). */
  signatureUrl: requiredText(500, 'A assinatura é obrigatória.'),
});

export const deletePackageSchema = z.object({
  reason: requiredText(500, 'Informe o motivo da exclusão.'),
});

export type ListPackagesQuery = z.output<typeof listPackagesQuerySchema>;
export type NewPackageInput = z.output<typeof newPackageSchema>;
export type PackageEditInput = z.output<typeof packageEditSchema>;
export type PickupInput = z.output<typeof pickupSchema>;
