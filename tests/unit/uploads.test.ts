import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors.js';
import { detectImageType, prepareImage } from '../../src/modules/uploads/service.js';

const image = (format: 'jpeg' | 'png' | 'webp', size = 64) =>
  sharp({ create: { width: size, height: size, channels: 3, background: '#3366cc' } })[format]().toBuffer();

async function expectInvalidUpload(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ status: 422, code: 'INVALID_UPLOAD' });
}

describe('detectImageType (magic number)', () => {
  it('reconhece JPEG, PNG e WebP pelo conteúdo', async () => {
    expect(detectImageType(await image('jpeg'))).toBe('jpg');
    expect(detectImageType(await image('png'))).toBe('png');
    expect(detectImageType(await image('webp'))).toBe('webp');
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg></svg>'))).toBeNull();
  });
});

describe('prepareImage', () => {
  it('rejeita MIME falso (texto com cara de .png)', async () => {
    await expectInvalidUpload(prepareImage('package-photo', Buffer.from('isto não é uma imagem')));
  });

  it('assinatura só aceita PNG de até 500 kB', async () => {
    await expectInvalidUpload(prepareImage('signature', await image('jpeg')));
    const big = Buffer.concat([await image('png'), Buffer.alloc(600 * 1024)]);
    await expectInvalidUpload(prepareImage('signature', big));
    await expect(prepareImage('signature', await image('png'))).resolves.toMatchObject({ ext: 'png' });
  });

  it('PNG truncado não passa', async () => {
    const png = await image('png');
    await expectInvalidUpload(prepareImage('signature', png.subarray(0, 20)));
  });

  it('remove o EXIF das fotos', async () => {
    const withExif = await sharp(await image('jpeg', 128))
      .withExif({ IFD0: { Copyright: 'iPackage', ImageDescription: 'Rua das Flores, 123' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const { body, ext } = await prepareImage('package-photo', withExif);
    expect(ext).toBe('jpg');
    expect((await sharp(body).metadata()).exif).toBeUndefined();
  });
});
