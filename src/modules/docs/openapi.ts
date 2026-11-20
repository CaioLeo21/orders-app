import { z } from 'zod';
import * as admin from '../admin/schemas.js';
import * as auth from '../auth/schemas.js';
import * as packages from '../packages/schemas.js';
import * as residents from '../residents/schemas.js';
import { uploadBodySchema } from '../uploads/routes.js';
import * as users from '../users/schemas.js';
import * as c from './contract.js';

// OpenAPI 3.1 gerado dos esquemas zod (request) e do contrato (response).

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Route {
  method: Method;
  path: string;
  summary: string;
  tag: string;
  profiles?: string;
  query?: z.ZodObject;
  body?: z.ZodType;
  multipart?: boolean;
  status?: number;
  response?: z.ZodType;
  errors?: string[];
}

const ref = (id: string) => `#/components/schemas/${id}`;
type Json = Record<string, unknown>;

/** Converte e troca os $defs locais por referências a components.schemas. */
function toSchema(schema: z.ZodType, io: 'input' | 'output'): Json {
  const json = z.toJSONSchema(schema, { metadata: c.registry, io, unrepresentable: 'any' }) as Json;
  delete json.$schema;
  delete json.$defs;
  return JSON.parse(JSON.stringify(json).replaceAll('"#/$defs/', `"${ref('')}`)) as Json;
}

const ARRAY = <T extends z.ZodType>(schema: T) => z.array(schema);

const routes: Route[] = [
  // Autenticação
  { method: 'post', path: '/auth/login', tag: 'Auth', summary: 'Login por matrícula e senha (define o cookie ipk_session)', body: auth.loginSchema, response: c.SessionSchema, errors: ['401 INVALID_CREDENTIALS', '403 USER_INACTIVE', '403 CONDOMINIUM_INACTIVE', '429 TOO_MANY_ATTEMPTS'] },
  { method: 'post', path: '/auth/logout', tag: 'Auth', summary: 'Encerra a sessão (limpa o cookie)', status: 204 },
  { method: 'get', path: '/me', tag: 'Auth', summary: 'Sessão atual (restaura ao recarregar a página)', response: c.SessionSchema, errors: ['401 UNAUTHENTICATED'] },
  { method: 'post', path: '/auth/change-password', tag: 'Auth', summary: 'Troca a própria senha (renova o cookie)', body: auth.changePasswordSchema, response: c.SessionSchema, errors: ['422 WRONG_PASSWORD', '422 SAME_PASSWORD'] },

  // Encomendas
  { method: 'get', path: '/packages', tag: 'Encomendas', profiles: 'doorman, manager, admin', summary: 'Lista com filtros, busca e contagem por aba (pendentes: mais antigas primeiro; retiradas: mais recentes primeiro)', query: packages.listPackagesQuerySchema, response: c.PackageListSchema },
  { method: 'get', path: '/packages/{id}', tag: 'Encomendas', profiles: 'doorman, manager, admin', summary: 'Uma encomenda', response: c.PackageViewSchema, errors: ['404 NOT_FOUND'] },
  { method: 'post', path: '/packages', tag: 'Encomendas', profiles: 'doorman, manager, admin', summary: 'Registra uma encomenda (chegada e porteiro vêm do servidor)', body: packages.newPackageSchema, status: 201, response: c.PackageViewSchema, errors: ['404 NOT_FOUND', '422 RECIPIENT_UNAVAILABLE', '422 INVALID_UPLOAD'] },
  { method: 'patch', path: '/packages/{id}', tag: 'Encomendas', profiles: 'doorman, manager, admin', summary: 'Edita remetente, rastreio, tipo, tamanho e observação', body: packages.packageEditSchema, response: c.PackageViewSchema },
  { method: 'post', path: '/packages/{id}/pickup', tag: 'Encomendas', profiles: 'doorman, manager, admin', summary: 'Registra a retirada (atômica)', body: packages.pickupSchema, response: c.PackageViewSchema, errors: ['409 ALREADY_COLLECTED', '422 INVALID_UPLOAD'] },
  { method: 'delete', path: '/packages/{id}', tag: 'Encomendas', profiles: 'manager, admin', summary: 'Exclui (soft delete) com motivo', body: packages.deletePackageSchema, status: 204 },
  { method: 'post', path: '/packages/{id}/delete', tag: 'Encomendas', profiles: 'manager, admin', summary: 'Alias de DELETE /packages/{id} para proxies que descartam o corpo', body: packages.deletePackageSchema, status: 204 },

  // Unidades e moradores
  { method: 'get', path: '/units', tag: 'Moradores', profiles: 'doorman, manager, admin', summary: 'Unidades do condomínio (sem paginação)', response: ARRAY(c.UnitSchema) },
  { method: 'get', path: '/residents', tag: 'Moradores', profiles: 'doorman, manager, admin', summary: 'Moradores com os vínculos (sem os excluídos)', response: ARRAY(c.ResidentWithLinksSchema) },
  { method: 'post', path: '/residents', tag: 'Moradores', profiles: 'manager, admin', summary: 'Cadastra morador e unidades', body: residents.residentInputSchema, status: 201, response: c.SavedResidentSchema, errors: ['422 RESIDENT_NEEDS_UNIT'] },
  { method: 'put', path: '/residents/{id}', tag: 'Moradores', profiles: 'manager, admin', summary: 'Substitui morador e lista completa de unidades', body: residents.residentInputSchema, response: c.SavedResidentSchema, errors: ['422 RESIDENT_NEEDS_UNIT'] },
  { method: 'patch', path: '/residents/{id}/status', tag: 'Moradores', profiles: 'manager, admin', summary: 'Ativa ou inativa', body: residents.residentStatusSchema, response: c.ResidentWithLinksSchema },
  { method: 'delete', path: '/residents/{id}', tag: 'Moradores', profiles: 'manager, admin', summary: 'Exclui (soft delete)', status: 204 },

  // Usuários
  { method: 'get', path: '/users', tag: 'Usuários', profiles: 'manager, admin', summary: 'Equipe do condomínio', response: ARRAY(c.UserSchema) },
  { method: 'post', path: '/users', tag: 'Usuários', profiles: 'manager, admin', summary: 'Cadastra com senha provisória', body: users.userInputSchema, status: 201, response: z.object({ user: c.UserSchema, temporaryPassword: z.string() }) },
  { method: 'put', path: '/users/{matricula}', tag: 'Usuários', profiles: 'manager, admin', summary: 'Edita nome, perfil e turno', body: users.userInputSchema, response: c.UserSchema, errors: ['403 CANNOT_CHANGE_SELF', '409 LAST_ADMIN'] },
  { method: 'patch', path: '/users/{matricula}/status', tag: 'Usuários', profiles: 'manager, admin', summary: 'Ativa ou inativa (inativar derruba as sessões)', body: users.userStatusSchema, response: c.UserSchema, errors: ['403 CANNOT_CHANGE_SELF', '409 LAST_ADMIN'] },
  { method: 'post', path: '/users/{matricula}/reset-password', tag: 'Usuários', profiles: 'manager, admin', summary: 'Gera nova senha provisória', response: z.object({ temporaryPassword: z.string() }), errors: ['403 CANNOT_CHANGE_SELF'] },

  // Uploads
  { method: 'post', path: '/uploads', tag: 'Uploads', profiles: 'doorman, manager, admin', summary: 'Envia foto (package-photo) ou assinatura (signature)', body: uploadBodySchema, multipart: true, status: 201, response: c.UploadResultSchema, errors: ['422 INVALID_UPLOAD'] },

  // Área do dono
  { method: 'get', path: '/admin/condominiums', tag: 'Admin', profiles: 'owner', summary: 'Condomínios com unitCount e currentPlanId', response: ARRAY(c.AdminCondominiumSchema) },
  { method: 'get', path: '/admin/condominiums/slug-availability', tag: 'Admin', profiles: 'owner', summary: 'Slug disponível?', query: admin.slugAvailabilityQuerySchema, response: z.object({ available: z.boolean() }) },
  { method: 'post', path: '/admin/condominiums', tag: 'Admin', profiles: 'owner', summary: 'Cadastra condomínio e o primeiro admin', body: admin.createCondominiumSchema, status: 201, response: z.object({ condominium: c.AdminCondominiumSchema, admin: z.object({ matricula: z.string(), name: z.string(), temporaryPassword: z.string() }) }), errors: ['409 SLUG_TAKEN'] },
  { method: 'put', path: '/admin/condominiums/{id}', tag: 'Admin', profiles: 'owner', summary: 'Edita condomínio', body: admin.condominiumInputSchema, response: c.AdminCondominiumSchema, errors: ['409 SLUG_TAKEN', '409 TYPE_LOCKED'] },
  { method: 'patch', path: '/admin/condominiums/{id}/status', tag: 'Admin', profiles: 'owner', summary: 'Ativa ou inativa (inativo bloqueia todos os usuários)', body: admin.condominiumStatusSchema, response: c.AdminCondominiumSchema },
  { method: 'get', path: '/admin/plans', tag: 'Admin', profiles: 'owner', summary: 'Planos com inUse e status', response: ARRAY(c.PlanListItemSchema) },
  { method: 'post', path: '/admin/plans', tag: 'Admin', profiles: 'owner', summary: 'Cria plano', body: admin.planInputSchema, status: 201, response: c.PlanSchema },
  { method: 'put', path: '/admin/plans/{id}', tag: 'Admin', profiles: 'owner', summary: 'Edita plano', body: admin.planInputSchema, response: c.PlanSchema, errors: ['409 PLAN_LOCKED'] },
  { method: 'post', path: '/admin/plans/{id}/end', tag: 'Admin', profiles: 'owner', summary: 'Encerra a vigência hoje', response: c.PlanSchema, errors: ['409 PLAN_NOT_STARTED'] },
  { method: 'delete', path: '/admin/plans/{id}', tag: 'Admin', profiles: 'owner', summary: 'Exclui plano sem cobranças', status: 204, errors: ['409 PLAN_IN_USE'] },
  { method: 'get', path: '/admin/invoices', tag: 'Admin', profiles: 'owner', summary: 'Cobranças (filtros opcionais)', query: admin.listInvoicesQuerySchema, response: ARRAY(c.InvoiceSchema) },
  { method: 'get', path: '/admin/invoices/summary', tag: 'Admin', profiles: 'owner', summary: 'Totais do mês', query: admin.invoiceSummaryQuerySchema, response: z.object({ competence: z.string(), toReceive: z.number(), received: z.number(), overdueTotalCount: z.number().int(), missingCount: z.number().int() }) },
  { method: 'post', path: '/admin/invoices/generate', tag: 'Admin', profiles: 'owner', summary: 'Gera as cobranças da competência (idempotente)', body: admin.generateInvoicesSchema, response: z.object({ created: z.number().int(), skipped: z.array(z.object({ condominiumId: z.string(), reason: z.literal('NO_ACTIVE_PLAN') })) }) },
  { method: 'post', path: '/admin/invoices/{id}/payment', tag: 'Admin', profiles: 'owner', summary: 'Registra pagamento manual', body: admin.paymentSchema, response: c.InvoiceSchema, errors: ['409 ALREADY_PAID'] },
  { method: 'delete', path: '/admin/invoices/{id}/payment', tag: 'Admin', profiles: 'owner', summary: 'Desfaz o pagamento', response: c.InvoiceSchema },
];

function operation(route: Route): Json {
  const parameters: Json[] = [];
  for (const [, name] of route.path.matchAll(/\{(\w+)\}/g)) {
    parameters.push({ name, in: 'path', required: true, schema: { type: 'string', pattern: '^\\d+$' } });
  }
  if (route.query) {
    const query = toSchema(route.query, 'input') as { properties?: Record<string, Json>; required?: string[] };
    for (const [name, schema] of Object.entries(query.properties ?? {})) {
      parameters.push({ name, in: 'query', required: query.required?.includes(name) ?? false, schema });
    }
  }

  const status = String(route.status ?? 200);
  const responses: Json = {
    [status]: route.response
      ? { description: 'OK', content: { 'application/json': { schema: toSchema(route.response, 'output') } } }
      : { description: 'Sem corpo' },
  };
  const errorContent = { 'application/json': { schema: { $ref: ref('Error') } } };
  for (const error of ['422 VALIDATION_ERROR', ...(route.errors ?? [])]) {
    const [code, name] = error.split(' ') as [string, string];
    const current = responses[code] as { description: string } | undefined;
    responses[code] = { description: current ? `${current.description}, ${name}` : name, content: errorContent };
  }

  const description = [
    route.profiles ? `Perfis: ${route.profiles}.` : undefined,
    route.method !== 'get' ? 'Escrita: envie Content-Type: application/json ou o cabeçalho X-Requested-With: ipackage.' : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    tags: [route.tag],
    summary: route.summary,
    ...(description ? { description } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(route.body
      ? {
          requestBody: {
            required: true,
            content: route.multipart
              ? {
                  'multipart/form-data': {
                    schema: {
                      type: 'object',
                      required: ['file', 'purpose'],
                      properties: { file: { type: 'string', format: 'binary' }, ...(toSchema(route.body, 'input').properties as Json) },
                    },
                  },
                }
              : { 'application/json': { schema: toSchema(route.body, 'input') } },
          },
        }
      : {}),
    responses,
    ...(route.path.startsWith('/auth/login') ? { security: [] } : {}),
  };
}

let cached: Json | undefined;

export function buildOpenApi(): Json {
  if (cached) return cached;
  const components = z.toJSONSchema(c.registry, { uri: ref, unrepresentable: 'any' }) as { schemas: Record<string, Json> };
  for (const schema of Object.values(components.schemas)) {
    delete schema.$schema;
    delete schema.$id;
  }
  const paths: Record<string, Json> = {};
  for (const route of routes) (paths[route.path] ??= {})[route.method] = operation(route);

  cached = {
    openapi: '3.1.0',
    info: {
      title: 'iPackage API',
      version: '2.0.0',
      description:
        'API da portaria do iPackage. Ids sempre em string, instantes em ISO UTC, datas YYYY-MM-DD, competência YYYY-MM, ' +
        'dinheiro em number e campos opcionais vazios omitidos. Erros: { error: { code, message, details? } }.',
    },
    servers: [{ url: '/api/v1' }],
    security: [{ session: [] }],
    components: {
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'ipk_session' } },
      schemas: components.schemas,
    },
    paths,
  };
  return cached;
}
