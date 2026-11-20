// Seed de desenvolvimento: espelha condo-order-hub/src/data/mockData.ts para que os testes
// manuais sejam iguais em modo mock e com a API (handoff, seção 12).
// Senha de todos: 123456 (hash argon2id, trocar_senha = false). Idempotente: o que já
// existe (pelo id/chave) não é recriado nem alterado.
import { pathToFileURL } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { currentCompetence, dueDateYmd, fromCompetence, fromYmd, todayYmd } from '../src/lib/dates.js';
import { unitKey } from '../src/lib/format.js';
import { hashPassword } from '../src/lib/password.js';
import { getStorage } from '../src/storage/index.js';
import { buildKey } from '../src/storage/keys.js';

// ---------- Datas relativas a "agora" (horários de São Paulo, UTC-3) ----------

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

function daysAgoAt(days: number, hours: number, minutes: number): Date {
  const [y, m, d] = todayYmd().split('-').map(Number) as [number, number, number];
  // 03:00 UTC = meia-noite em São Paulo (sem horário de verão desde 2019).
  return new Date(Date.UTC(y, m - 1, d - days, hours + 3, minutes));
}

function competenceMonthsBack(monthsBack: number): string {
  const [y, m] = currentCompetence().split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return date.toISOString().slice(0, 7);
}

// ---------- Dados ----------

const created = daysAgoAt(120, 9, 0);

const condominiums: Prisma.CondominiumCreateManyInput[] = [
  { id: 1, name: 'Residencial Vista Verde', type: 'apartment', slug: 'residencial-vista-verde', address: 'Rua das Flores, 123 - São Paulo/SP' },
  { id: 2, name: 'Condomínio Solar do Bosque', type: 'house', slug: 'solar-do-bosque', address: 'Av. Principal, 456 - Rio de Janeiro/RJ' },
  { id: 3, name: 'Edifício Torre Azul', type: 'apartment', slug: 'torre-azul', address: 'Rua Central, 789 - Belo Horizonte/MG' },
];

const users: Omit<Prisma.UserCreateManyInput, 'passwordHash'>[] = [
  { matricula: 1001, name: 'João Silva', profile: 'admin', condominiumId: 1 },
  { matricula: 1002, name: 'Maria Santos', profile: 'doorman', shift: 'afternoon', condominiumId: 1 },
  { matricula: 1003, name: 'Pedro Santos', profile: 'doorman', shift: 'night', condominiumId: 1 },
  { matricula: 1004, name: 'Carlos Menezes', profile: 'doorman', shift: 'morning', condominiumId: 1 },
  { matricula: 1005, name: 'Roberto Lima', profile: 'manager', condominiumId: 1 },
  { matricula: 2001, name: 'Carlos Oliveira', profile: 'admin', condominiumId: 2 },
  { matricula: 2002, name: 'Ricardo Alves', profile: 'doorman', shift: 'morning', condominiumId: 2 },
  { matricula: 3001, name: 'Ana Costa', profile: 'admin', condominiumId: 3 },
  { matricula: 9001, name: 'Equipe iPackage', profile: 'owner', condominiumId: null },
];

const apt = (id: number, condominiumId: number, block: string, apartment: string): Prisma.UnitCreateManyInput => ({
  id, condominiumId, block, apartment, key: unitKey(block, apartment),
});
const house = (id: number, condominiumId: number, lot: string, number: string, street: string): Prisma.UnitCreateManyInput => ({
  id, condominiumId, lot, house: number, street, key: unitKey(lot, number),
});

const units: Prisma.UnitCreateManyInput[] = [
  apt(1, 1, 'A', '101'),
  apt(2, 1, 'A', '303'),
  apt(3, 1, 'B', '204'),
  apt(4, 1, 'C', '402'),
  apt(5, 1, 'C', '101'),
  apt(6, 1, 'D', '12'),
  house(7, 2, '3', '12', 'Rua dos Ipês'),
  house(8, 2, '1', '5', 'Rua das Acácias'),
  apt(9, 3, 'Único', '801'),
];

const resident = (
  id: number, condominiumId: number, name: string, phone: string, residentType: 'owner' | 'tenant' | 'other', residentTypeDescription?: string,
): Prisma.ResidentCreateManyInput => ({ id, condominiumId, name, phone, residentType, residentTypeDescription });

const residents: Prisma.ResidentCreateManyInput[] = [
  resident(1, 1, 'Lúcia Andrade', '11988881010', 'tenant'),
  resident(2, 1, 'Patrícia Gomes', '11977773030', 'owner'),
  resident(3, 1, 'Mariana Souza', '11999992040', 'owner'),
  resident(4, 1, 'Rafael Souza', '11999992041', 'owner'),
  resident(5, 1, 'Thiago Lima', '11966664020', 'tenant'),
  resident(6, 1, 'Bruna Lima', '11966664021', 'other', 'Familiar'),
  resident(7, 1, 'Sônia Prado', '11955551011', 'owner'),
  resident(8, 1, 'Eduardo Rocha', '11944440012', 'tenant'),
  resident(9, 2, 'João Pereira', '21988880312', 'owner'),
  resident(10, 2, 'Ana Pereira', '21988880313', 'owner'),
  resident(11, 2, 'Felipe Nunes', '21977770105', 'tenant'),
  resident(12, 3, 'Helena Duarte', '31987658010', 'owner'),
];

// Sônia Prado (7) é dona de dois apartamentos: C-101 (5) e A-303 (2). [morador, unidade]
const linkPairs: [number, number][] = [
  [1, 1], [2, 2], [3, 3], [4, 3], [5, 4], [6, 4], [7, 5], [7, 2], [8, 6], [9, 7], [10, 7], [11, 8], [12, 9],
];
const residentUnits: Prisma.ResidentUnitCreateManyInput[] = linkPairs.map(([residentId, unitId], i) => ({ id: i + 1, residentId, unitId }));
const link = (residentId: number, unitId: number) => residentUnits.find((ru) => ru.residentId === residentId && ru.unitId === unitId)!.id!;

interface SeedPackage {
  id: number;
  condominiumId: number;
  residentUnitId: number;
  senderCompany: string;
  trackingCode?: string;
  kind: 'envelope' | 'box' | 'bag' | 'other';
  size: 'small' | 'medium' | 'large';
  notes?: string;
  receivedAt: Date;
  receivedById: number;
  pickup?: { collectedAt: Date; collectedBy: string; deliveredById: number };
}

const packages: SeedPackage[] = [
  { id: 297, condominiumId: 1, residentUnitId: link(1, 1), senderCompany: 'Amazon', trackingCode: 'AMZ987654321', kind: 'box', size: 'large', receivedAt: daysAgoAt(3, 16, 40), receivedById: 1003 },
  { id: 305, condominiumId: 1, residentUnitId: link(5, 4), senderCompany: 'Banco do Brasil', kind: 'envelope', size: 'small', receivedAt: daysAgoAt(1, 10, 15), receivedById: 1004 },
  { id: 311, condominiumId: 1, residentUnitId: link(4, 3), senderCompany: 'Shopee', trackingCode: 'BR2345678901X', kind: 'bag', size: 'medium', receivedAt: daysAgoAt(1, 18, 2), receivedById: 1003 },
  { id: 316, condominiumId: 1, residentUnitId: link(2, 2), senderCompany: 'Magazine Luiza', kind: 'box', size: 'small', receivedAt: minutesAgo(190), receivedById: 1004 },
  { id: 318, condominiumId: 1, residentUnitId: link(3, 3), senderCompany: 'Mercado Livre', trackingCode: 'ML123456789', kind: 'box', size: 'medium', receivedAt: minutesAgo(48), receivedById: 1002 },
  { id: 319, condominiumId: 1, residentUnitId: link(8, 6), senderCompany: 'Leroy Merlin', kind: 'other', size: 'large', notes: 'Duas caixas amarradas', receivedAt: minutesAgo(12), receivedById: 1002 },
  { id: 290, condominiumId: 1, residentUnitId: link(7, 5), senderCompany: 'Correios', kind: 'box', size: 'medium', receivedAt: daysAgoAt(1, 11, 30), receivedById: 1004, pickup: { collectedAt: minutesAgo(300), collectedBy: 'Sônia Prado', deliveredById: 1004 } },
  { id: 302, condominiumId: 1, residentUnitId: link(6, 4), senderCompany: 'Detran', kind: 'envelope', size: 'small', receivedAt: daysAgoAt(2, 14, 10), receivedById: 1002, pickup: { collectedAt: daysAgoAt(1, 19, 47), collectedBy: 'Thiago Lima', deliveredById: 1003 } },
  { id: 280, condominiumId: 1, residentUnitId: link(7, 2), senderCompany: 'Natura', kind: 'box', size: 'small', receivedAt: daysAgoAt(12, 9, 40), receivedById: 1004, pickup: { collectedAt: daysAgoAt(11, 18, 5), collectedBy: 'Sônia Prado', deliveredById: 1002 } },
  { id: 401, condominiumId: 2, residentUnitId: link(9, 7), senderCompany: 'Correios', kind: 'envelope', size: 'small', receivedAt: minutesAgo(95), receivedById: 2002 },
  { id: 402, condominiumId: 2, residentUnitId: link(11, 8), senderCompany: 'Amazon', kind: 'box', size: 'medium', receivedAt: daysAgoAt(1, 9, 5), receivedById: 2002, pickup: { collectedAt: daysAgoAt(1, 18, 30), collectedBy: 'Felipe Nunes', deliveredById: 2002 } },
];

const plans: Prisma.PlanCreateManyInput[] = [
  { id: 1, description: 'Essencial', unitLimit: 50, price: '149.90', validFrom: fromYmd('2026-01-01') },
  { id: 2, description: 'Condomínio', unitLimit: 150, price: '299.90', validFrom: fromYmd('2026-01-01') },
  { id: 3, description: 'Grande', unitLimit: 400, price: '549.90', validFrom: fromYmd('2026-01-01') },
  { id: 4, description: 'Lançamento (promocional)', unitLimit: 50, price: '99.90', validFrom: fromYmd('2025-06-01'), validUntil: fromYmd('2025-12-31') },
];

/** Os 3 condomínios no Essencial nas 2 últimas competências, pagas no dia 8; a da Torre Azul do mês passado fica em aberto. */
function invoices(): Prisma.InvoiceCreateManyInput[] {
  const rows: Prisma.InvoiceCreateManyInput[] = [];
  let id = 1;
  for (const condominiumId of [1, 2, 3]) {
    for (const back of [2, 1]) {
      const competence = competenceMonthsBack(back);
      const paid = !(condominiumId === 3 && back === 1);
      const paidAt = `${competenceMonthsBack(back - 1)}-08`;
      rows.push({
        id: id++,
        condominiumId,
        planId: 1,
        competence: fromCompetence(competence),
        amountDue: '149.90',
        dueDate: fromYmd(dueDateYmd(competence)),
        ...(paid ? { amountPaid: '149.90', paidAt: fromYmd(paidAt) } : {}),
      });
    }
  }
  return rows;
}

/** PNG de "assinatura" para as retiradas do seed (o CHECK exige link_assinatura). */
function signaturePng(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="160">
    <rect width="100%" height="100%" fill="white"/>
    <path d="M30 110 C 80 20, 120 140, 170 70 S 260 40, 300 100 S 400 60, 450 80" stroke="#1f2937" stroke-width="4" fill="none"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Popula o banco com os dados de exemplo. Também usado pelos testes de integração. */
export async function seed(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hashPassword('123456');
  const stamp = { createdAt: created, updatedAt: created };

  await prisma.condominium.createMany({ data: condominiums.map((row) => ({ ...row, ...stamp })), skipDuplicates: true });
  await prisma.user.createMany({
    data: users.map((row) => ({ ...row, passwordHash, mustChangePassword: false, ...stamp })),
    skipDuplicates: true,
  });
  await prisma.unit.createMany({ data: units.map((row) => ({ ...row, ...stamp })), skipDuplicates: true });
  await prisma.resident.createMany({ data: residents.map((row) => ({ ...row, ...stamp })), skipDuplicates: true });
  await prisma.residentUnit.createMany({ data: residentUnits.map((row) => ({ ...row, createdAt: created })), skipDuplicates: true });

  const existing = new Set((await prisma.package.findMany({ select: { id: true } })).map((row) => row.id));
  const storage = getStorage();
  for (const pkg of packages) {
    if (existing.has(pkg.id)) continue;
    let signatureKey: string | undefined;
    if (pkg.pickup) {
      signatureKey = buildKey(pkg.condominiumId, 'signature', 'png', pkg.pickup.collectedAt);
      try {
        await storage.put(signatureKey, await signaturePng(), 'image/png');
      } catch (error) {
        console.warn(`Não foi possível gravar a assinatura de exemplo no storage (${(error as Error).message}).`);
      }
    }
    const { pickup, ...data } = pkg;
    await prisma.package.create({
      data: {
        ...data,
        ...(pickup ? { ...pickup, signatureKey } : {}),
        createdAt: pkg.receivedAt,
        updatedAt: pickup?.collectedAt ?? pkg.receivedAt,
      },
    });
  }

  await prisma.plan.createMany({ data: plans.map((row) => ({ ...row, ...stamp })), skipDuplicates: true });
  await prisma.invoice.createMany({ data: invoices(), skipDuplicates: true });

  // Ids explícitos: acerta as sequências para os próximos registros (seção 12).
  const sequences: [string, string][] = [
    ['condominio', 'id_condominio'],
    ['usuario', 'matricula'],
    ['casa', 'id_casa'],
    ['morador', 'id_morador'],
    ['morador_casa', 'id_morador_casa'],
    ['encomenda', 'id_encomenda'],
    ['precificacao', 'id_precificacao'],
    ['faturamento', 'id_faturamento'],
  ];
  for (const [table, column] of sequences) {
    // Nomes fixos desta lista (nunca entrada externa).
    const t = Prisma.raw(`"${table}"`);
    const col = Prisma.raw(`"${column}"`);
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence(${`"${table}"`}, ${column}), COALESCE((SELECT MAX(${col}) FROM ${t}), 1), (SELECT MAX(${col}) FROM ${t}) IS NOT NULL)`;
  }
}

// Executado direto (prisma db seed / tsx prisma/seed.ts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.NODE_ENV === 'production') {
    console.error('O seed de desenvolvimento não roda com NODE_ENV=production.');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log('Seed concluído. Logins (senha 123456): 1001 admin · 1002 porteiro · 1005 responsável · 2001 admin (casas) · 9001 owner.'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
