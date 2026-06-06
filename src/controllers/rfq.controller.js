const { z }  = require('zod');
const dayjs  = require('dayjs');
const prisma = require('../config/database');

// ── Schemas ────────────────────────────────────────
const createRfqSchema = z.object({
  title:        z.string().min(5, 'Title too short'),
  description:  z.string().min(10, 'Describe your requirement'),
  pillar:       z.number().int().min(1).max(6),
  quantity:     z.string().optional(),
  unit:         z.string().optional(),
  specs:        z.string().optional(),
  deliveryDate: z.string().optional(),
  deliveryCity: z.string().optional(),
  region:       z.string().optional(),
});

const respondSchema = z.object({
  priceTotal:   z.number().positive('Price must be positive'),
  currency:     z.string().default('SAR'),
  leadTimeDays: z.number().int().positive().optional(),
  notes:        z.string().optional(),
  attachmentUrl: z.string().url().optional(),
});

const emergencySchema = z.object({
  title:        z.string().min(5),
  description:  z.string().min(10),
  pillar:       z.number().int().min(1).max(6),
  urgency:      z.enum(['CRITICAL', 'HIGH', 'MEDIUM']).default('HIGH'),
  plantDown:    z.boolean().default(false),
  location:     z.string().optional(),
  contactPhone: z.string().optional(),
});

// ── POST /api/rfqs  (إنشاء RFQ) ───────────────────
const createRfq = async (req, res) => {
  const data    = createRfqSchema.parse(req.body);
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const rfq = await prisma.rfq.create({
    data: {
      buyerCompanyId: company.id,
      ...data,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
    },
  });

  res.status(201).json({ message: 'RFQ created', data: rfq });
};

// ── GET /api/rfqs  (قائمة الـ RFQs) ───────────────
const listRfqs = async (req, res) => {
  const schema = z.object({
    page:   z.coerce.number().default(1),
    limit:  z.coerce.number().max(50).default(20),
    pillar: z.coerce.number().int().min(1).max(6).optional(),
    status: z.enum(['OPEN','AWARDED','CLOSED','CANCELLED']).optional(),
    region: z.string().optional(),
  });

  const q    = schema.parse(req.query);
  const skip = (q.page - 1) * q.limit;

  const where = {};
  if (q.pillar) where.pillar = q.pillar;
  if (q.status) where.status = q.status;
  else          where.status = 'OPEN';
  if (q.region) where.region = { contains: q.region, mode: 'insensitive' };

  const [total, rfqs] = await Promise.all([
    prisma.rfq.count({ where }),
    prisma.rfq.findMany({
      where, skip, take: q.limit,
      orderBy:  { createdAt: 'desc' },
      select: {
        id: true, title: true, pillar: true, quantity: true,
        unit: true, region: true, deliveryDate: true, status: true,
        createdAt: true,
        _count: { select: { responses: true } },
        buyerCompany: { select: { nameEn: true, city: true } },
      },
    }),
  ]);

  res.json({
    data: rfqs,
    pagination: { total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) },
  });
};

// ── GET /api/rfqs/:id  (تفاصيل RFQ) ───────────────
const getRfq = async (req, res) => {
  const rfq = await prisma.rfq.findUnique({
    where:   { id: req.params.id },
    include: {
      buyerCompany: { select: { nameEn: true, city: true, region: true } },
      responses: {
        select: {
          id: true, priceTotal: true, currency: true,
          leadTimeDays: true, notes: true, isAwarded: true, createdAt: true,
          supplier: {
            select: {
              id: true, iktvaScore: true, aramcoApproved: true, isVerified: true,
              company: { select: { nameEn: true, city: true } },
            },
          },
        },
      },
    },
  });

  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
  res.json({ data: rfq });
};

// ── POST /api/rfqs/:id/respond  (رد مورد) ─────────
const respondToRfq = async (req, res) => {
  const data = respondSchema.parse(req.body);

  // تحقق أن المستخدم مورد ولديه ملف
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const profile = company
    ? await prisma.supplierProfile.findUnique({ where: { companyId: company.id } })
    : null;
  if (!profile) return res.status(403).json({ error: 'Supplier profile required' });

  // تحقق أن الـ RFQ مفتوح
  const rfq = await prisma.rfq.findUnique({ where: { id: req.params.id } });
  if (!rfq)              return res.status(404).json({ error: 'RFQ not found' });
  if (rfq.status !== 'OPEN') return res.status(400).json({ error: 'RFQ is no longer open' });

  // تحقق من حد RFQs حسب الاشتراك
  const sub  = await prisma.subscription.findUnique({
    where:   { userId: req.user.id },
    include: { plan: true },
  });
  const maxRfqs = sub?.plan?.maxRfqs ?? 3;
  const startOfMonth = dayjs().startOf('month').toDate();
  const thisMonthCount = await prisma.rfqResponse.count({
    where: { supplierId: profile.id, createdAt: { gte: startOfMonth } },
  });
  if (thisMonthCount >= maxRfqs) {
    return res.status(403).json({
      error: `RFQ limit reached (${maxRfqs}/month). Upgrade your plan to respond to more RFQs.`,
    });
  }

  const response = await prisma.rfqResponse.upsert({
    where:  { rfqId_supplierId: { rfqId: rfq.id, supplierId: profile.id } },
    create: { rfqId: rfq.id, supplierId: profile.id, ...data },
    update: data,
  });

  res.status(201).json({ message: 'Response submitted', data: response });
};

// ── PUT /api/rfqs/:id/award  (إرساء العطاء) ────────
const awardRfq = async (req, res) => {
  const { responseId } = z.object({ responseId: z.string().uuid() }).parse(req.body);

  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const rfq     = await prisma.rfq.findFirst({
    where: { id: req.params.id, buyerCompanyId: company?.id },
  });
  if (!rfq) return res.status(404).json({ error: 'RFQ not found or not yours' });

  const response = await prisma.rfqResponse.findFirst({
    where: { id: responseId, rfqId: rfq.id },
  });
  if (!response) return res.status(404).json({ error: 'Response not found' });

  await prisma.$transaction([
    prisma.rfqResponse.updateMany({
      where: { rfqId: rfq.id },
      data:  { isAwarded: false },
    }),
    prisma.rfqResponse.update({
      where: { id: responseId },
      data:  { isAwarded: true },
    }),
    prisma.rfq.update({
      where: { id: rfq.id },
      data:  { status: 'AWARDED', awardedTo: response.supplierId, closedAt: new Date() },
    }),
  ]);

  res.json({ message: 'RFQ awarded successfully' });
};

// ── POST /api/emergency  (طلب طارئ) ───────────────
const createEmergency = async (req, res) => {
  const data    = emergencySchema.parse(req.body);
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const emergency = await prisma.emergencyRfq.create({
    data: { companyId: company.id, ...data },
  });

  // في Production: إرسال WhatsApp/SMS للموردين المناسبين
  const responseTime = data.urgency === 'CRITICAL' ? '2 hours' : data.urgency === 'HIGH' ? '24 hours' : '72 hours';
  console.log(`[EMERGENCY] ${data.urgency} — Pillar ${data.pillar} — Plant Down: ${data.plantDown}`);

  res.status(201).json({
    message:      'Emergency request submitted',
    data:         emergency,
    responseTime: `Expected response within ${responseTime}`,
    nextStep:     'Our team will contact you shortly via WhatsApp and phone',
  });
};

// ── GET /api/emergency/:id ─────────────────────────
const getEmergency = async (req, res) => {
  const company   = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const emergency = await prisma.emergencyRfq.findFirst({
    where: { id: req.params.id, companyId: company?.id },
  });
  if (!emergency) return res.status(404).json({ error: 'Emergency request not found' });
  res.json({ data: emergency });
};

module.exports = { createRfq, listRfqs, getRfq, respondToRfq, awardRfq, createEmergency, getEmergency };
