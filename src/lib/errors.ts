// Erros da API no formato { error: { code, message, details? } } (handoff, seção 8.2).
// `message` é em pt-BR, pronto para o front exibir num toast.

export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetails,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Sessão expirada. Entre novamente.');

export const forbidden = (message = 'Você não tem permissão para esta ação.') => new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Registro não encontrado.') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string) => new AppError(409, code, message);

/** 422 com a mensagem de cada campo em details.fields. */
export const validationError = (fields: Record<string, string>, message = 'Confira os campos destacados.') =>
  new AppError(422, 'VALIDATION_ERROR', message, { fields });

export const unprocessable = (code: string, message: string, fields?: Record<string, string>) =>
  new AppError(422, code, message, fields ? { fields } : undefined);

export const invalidUpload = (message = 'Arquivo enviado inválido. Envie o arquivo novamente.') =>
  new AppError(422, 'INVALID_UPLOAD', message);
