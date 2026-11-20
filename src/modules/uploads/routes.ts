import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getTenant } from '../../auth/middleware.js';
import { AppError, invalidUpload } from '../../lib/errors.js';
import { parse } from '../../lib/validation.js';
import { UPLOAD_PURPOSES } from '../../storage/keys.js';
import { MAX_PHOTO_BYTES, storeUpload } from './service.js';

export const uploadsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5, fieldSize: 1024 },
});

export const uploadBodySchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES, { error: 'Propósito do upload inválido.' }),
});

/** Converte erros do multer (arquivo grande demais, campo inesperado) em INVALID_UPLOAD. */
const singleFile: ReturnType<typeof upload.single> = (req, res, next) => {
  upload.single('file')(req, res, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      next(error.code === 'LIMIT_FILE_SIZE' ? invalidUpload('Arquivo maior que o permitido (5 MB).') : invalidUpload());
      return;
    }
    next(error as Error | undefined);
  });
};

uploadsRouter.post('/uploads', singleFile, async (req, res) => {
  const tenant = getTenant(req);
  const { purpose } = parse(uploadBodySchema, req.body);
  if (!req.file) throw new AppError(422, 'INVALID_UPLOAD', 'Envie o arquivo no campo "file".');
  res.status(201).json(await storeUpload(tenant.condominiumId, purpose, req.file.buffer));
});
