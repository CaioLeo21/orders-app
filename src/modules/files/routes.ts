import { Router } from 'express';
import { notFound } from '../../lib/errors.js';
import { getStorage, LocalStorage } from '../../storage/index.js';
import { contentTypeOf } from '../../storage/keys.js';

// Só com STORAGE_DRIVER=local: serve as "URLs assinadas" do driver de disco.
// Com S3 o front baixa direto do bucket e esta rota responde 404.
export const filesRouter = Router();

filesRouter.get('/files/*key', async (req, res) => {
  const storage = getStorage();
  if (!(storage instanceof LocalStorage)) throw notFound();

  const segments = req.params.key as unknown as string[];
  const key = segments.join('/');
  const { exp, sig } = req.query;
  if (typeof exp !== 'string' || typeof sig !== 'string' || !storage.verify(key, exp, sig)) throw notFound();
  if (!(await storage.exists(key))) throw notFound();

  res.set({
    'Content-Type': contentTypeOf(key),
    'Cache-Control': 'private, max-age=900',
    // A URL já é assinada; o <img> do front (outra origem) precisa conseguir carregar.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  storage.read(key).pipe(res);
});
