import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from './errors.js';
import { logger } from './logger.js';

function send(res: Parameters<ErrorRequestHandler>[2], error: AppError) {
  if (error.headers) res.set(error.headers);
  res.status(error.status).json({
    error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
  });
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.'));
};

/** Converte qualquer erro no formato { error: { code, message, details? } } (handoff 8.2). */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof AppError) return send(res, error);

  // Erros do body-parser (express.json).
  const type = (error as { type?: string }).type;
  if (type === 'entity.parse.failed') return send(res, new AppError(422, 'VALIDATION_ERROR', 'JSON inválido no corpo da requisição.'));
  if (type === 'entity.too.large') return send(res, new AppError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição grande demais.'));

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return send(res, new AppError(409, 'CONFLICT', 'Registro duplicado. Atualize a tela e tente de novo.'));
    if (error.code === 'P2025') return send(res, new AppError(404, 'NOT_FOUND', 'Registro não encontrado.'));
  }

  (req.log ?? logger).error({ err: error }, 'erro não tratado');
  return send(res, new AppError(500, 'INTERNAL_ERROR', 'Erro inesperado. Tente novamente em instantes.'));
};
