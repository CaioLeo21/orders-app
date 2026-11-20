import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApi } from './openapi.js';

// Só fora de produção (montado em app.ts): /api/v1/docs e /api/v1/docs/openapi.json.
export const docsRouter = Router();

docsRouter.get('/docs/openapi.json', (_req, res) => {
  res.json(buildOpenApi());
});
docsRouter.use('/docs', swaggerUi.serveFiles(undefined, { swaggerUrl: './openapi.json' }), swaggerUi.setup(undefined, { swaggerUrl: './openapi.json' }));
