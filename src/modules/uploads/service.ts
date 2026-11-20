import sharp from 'sharp';
import { invalidUpload } from '../../lib/errors.js';
import { getStorage } from '../../storage/index.js';
import { buildKey, CONTENT_TYPES, keyBelongsTo, type ImageExtension, type UploadPurpose } from '../../storage/keys.js';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_SIGNATURE_BYTES = 500 * 1024;

/** Tipo real pelo magic number (nunca pela extensão ou pelo Content-Type enviado). */
export function detectImageType(buffer: Buffer): ImageExtension | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const ACCEPTED: Record<UploadPurpose, { types: ImageExtension[]; maxBytes: number; label: string }> = {
  'package-photo': { types: ['jpg', 'png', 'webp'], maxBytes: MAX_PHOTO_BYTES, label: 'A foto deve ser JPEG, PNG ou WebP de até 5 MB.' },
  signature: { types: ['png'], maxBytes: MAX_SIGNATURE_BYTES, label: 'A assinatura deve ser um PNG de até 500 kB.' },
};

/**
 * Valida e prepara o arquivo: tipo pelo magic number, tamanho por propósito e, nas
 * fotos, reencode com sharp aplicando a orientação e removendo o EXIF (localização etc.).
 */
export async function prepareImage(purpose: UploadPurpose, buffer: Buffer): Promise<{ body: Buffer; ext: ImageExtension }> {
  const rules = ACCEPTED[purpose];
  const ext = detectImageType(buffer);
  if (!ext || !rules.types.includes(ext) || buffer.length > rules.maxBytes) throw invalidUpload(rules.label);

  try {
    if (purpose === 'signature') {
      await sharp(buffer).metadata(); // garante que o PNG decodifica
      return { body: buffer, ext };
    }
    const image = sharp(buffer).rotate(); // aplica a orientação do EXIF antes de descartá-lo
    const body =
      ext === 'jpg' ? await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
      : ext === 'png' ? await image.png().toBuffer()
      : await image.webp({ quality: 85 }).toBuffer();
    return { body, ext };
  } catch {
    throw invalidUpload('Não foi possível ler a imagem enviada.');
  }
}

export async function storeUpload(condominiumId: number, purpose: UploadPurpose, buffer: Buffer): Promise<{ key: string; url: string }> {
  const { body, ext } = await prepareImage(purpose, buffer);
  const key = buildKey(condominiumId, purpose, ext);
  const storage = getStorage();
  await storage.put(key, body, CONTENT_TYPES[ext]);
  return { key, url: await storage.signedUrl(key) };
}

/** RN-E3/RN-E5: a chave precisa ser do condomínio do token, do propósito certo e existir. */
export async function assertUploadKey(key: string, condominiumId: number, purpose: UploadPurpose): Promise<void> {
  if (!keyBelongsTo(key, condominiumId, purpose)) throw invalidUpload();
  if (!(await getStorage().exists(key))) throw invalidUpload();
}
