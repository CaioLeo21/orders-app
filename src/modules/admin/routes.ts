import { Router } from 'express';
import { toAdminCondominiumDto, toInvoiceDto, toPlanDto, toPlanListItemDto, toUserDto } from '../../lib/serializers.js';
import { todayYmd } from '../../lib/dates.js';
import { parse, parseId } from '../../lib/validation.js';
import * as condominiums from './condominiums.service.js';
import * as invoices from './invoices.service.js';
import * as plans from './plans.service.js';
import {
  condominiumInputSchema,
  condominiumStatusSchema,
  createCondominiumSchema,
  generateInvoicesSchema,
  invoiceSummaryQuerySchema,
  listInvoicesQuerySchema,
  paymentSchema,
  planInputSchema,
  slugAvailabilityQuerySchema,
} from './schemas.js';

// Área do dono do iPackage (perfil owner, checado ao montar o router).
export const adminRouter = Router();

const summaryDto = (summary: condominiums.CondominiumSummary) =>
  toAdminCondominiumDto(summary.condominium, summary.unitCount, summary.currentPlanId);

// ---------- Condomínios ----------

adminRouter.get('/admin/condominiums', async (_req, res) => {
  res.json((await condominiums.listCondominiums()).map(summaryDto));
});

adminRouter.get('/admin/condominiums/slug-availability', async (req, res) => {
  const { slug, exceptId } = parse(slugAvailabilityQuerySchema, req.query);
  res.json({ available: await condominiums.isSlugAvailable(slug, exceptId) });
});

adminRouter.post('/admin/condominiums', async (req, res) => {
  const input = parse(createCondominiumSchema, req.body);
  const { summary, admin, temporaryPassword } = await condominiums.createCondominium(input.condominium, input.adminName);
  const adminDto = toUserDto(admin);
  res.status(201).json({ condominium: summaryDto(summary), admin: { matricula: adminDto.matricula, name: adminDto.name, temporaryPassword } });
});

adminRouter.put('/admin/condominiums/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await condominiums.getCondominium(id);
  res.json(summaryDto(await condominiums.updateCondominium(id, parse(condominiumInputSchema, req.body))));
});

adminRouter.patch('/admin/condominiums/:id/status', async (req, res) => {
  const id = parseId(req.params.id);
  await condominiums.getCondominium(id);
  const { status } = parse(condominiumStatusSchema, req.body);
  res.json(summaryDto(await condominiums.setCondominiumStatus(id, status)));
});

// ---------- Planos ----------

adminRouter.get('/admin/plans', async (_req, res) => {
  const today = todayYmd();
  res.json((await plans.listPlans()).map(({ plan, inUse }) => toPlanListItemDto(plan, inUse, today)));
});

adminRouter.post('/admin/plans', async (req, res) => {
  res.status(201).json(toPlanDto(await plans.createPlan(parse(planInputSchema, req.body))));
});

adminRouter.put('/admin/plans/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await plans.getPlan(id);
  res.json(toPlanDto(await plans.updatePlan(id, parse(planInputSchema, req.body))));
});

adminRouter.post('/admin/plans/:id/end', async (req, res) => {
  res.json(toPlanDto(await plans.endPlan(parseId(req.params.id))));
});

adminRouter.delete('/admin/plans/:id', async (req, res) => {
  await plans.deletePlan(parseId(req.params.id));
  res.status(204).end();
});

// ---------- Cobranças ----------

adminRouter.get('/admin/invoices', async (req, res) => {
  const filters = parse(listInvoicesQuerySchema, req.query);
  const today = todayYmd();
  res.json((await invoices.listInvoices(filters, today)).map((invoice) => toInvoiceDto(invoice, today)));
});

adminRouter.get('/admin/invoices/summary', async (req, res) => {
  const { competence } = parse(invoiceSummaryQuerySchema, req.query);
  res.json(await invoices.invoiceSummary(competence));
});

adminRouter.post('/admin/invoices/generate', async (req, res) => {
  const { competence } = parse(generateInvoicesSchema, req.body);
  res.json(await invoices.generateInvoices(competence));
});

adminRouter.post('/admin/invoices/:id/payment', async (req, res) => {
  const id = parseId(req.params.id);
  await invoices.getInvoice(id);
  res.json(toInvoiceDto(await invoices.registerPayment(id, parse(paymentSchema, req.body))));
});

adminRouter.delete('/admin/invoices/:id/payment', async (req, res) => {
  res.json(toInvoiceDto(await invoices.undoPayment(parseId(req.params.id))));
});
