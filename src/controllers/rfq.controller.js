const { z }    = require('zod');
const dayjs    = require('dayjs');
const prisma   = require('../config/database');
const { sendEmail } = require('../services/email.service');

// ─────────────────────────────────────────────────────────
//  PILLAR LABELS
// ─────────────────────────────────────────────────────────
const PILLAR_LABELS = {
  1: 'Valves Supply',
  2: 'Spare Parts',
  3: 'Machining & Fabrication',
  4: '3D Printing',
  5: 'TPI & Inspection',
  6: 'Rental Equipment',
};

const PILLAR_FIELDS = {
  1: 'pillar1Valves',
  2: 'pillar2Parts',
  3: 'pillar3Machining',
  4: 'pillar4Print',
  5: 'pillar5TPI',
  6: 'pillar6Rental',
};

// ─────────────────────────────────────────────────────────
//  INVOICE NUMBER GENERATOR  TVH-RFQ-2026-000001
// ─────────────────────────────────────────────────────────
async function nextInvoiceNumber() {
  const year  = new Date().getFullYear();
  const last  = await prisma.invoice.findFirst({
    where:   { invoiceNumber: { startsWith: `TVH-${year}-` } },
    orderBy: { issueDate: 'desc' },
  });
  const seq   = last
    ? parseInt(last.invoiceNumber.split('-').pop(), 10) + 1
    : 1;
  return `TVH-${year}-${String(seq).padStart(6, '0')}`;
}

// ─────────────────────────────────────────────────────────
//  NOTIFY MATCHING SUPPLIERS
// ─────────────────────────────────────────────────────────
async function notifySuppliers(rfq, buyerName) {
  const pillarField = PILLAR_FIELDS[rfq.pillar];
  if (!pillarField) return;

  // جلب الموردين المطابقين
  const profiles = await prisma.supplierProfile.findMany({
    where:   { [pillarField]: true, isActive: true },
    include: {
      company: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });

  const pillarLabel = PILLAR_LABELS[rfq.pillar] || `Pillar ${rfq.pillar}`;

  await Promise.allSettled(
    profiles.map(async (p) => {
      const user = p.company?.user;
      if (!user) return;

      // إشعار داخلي
      await prisma.notification.create({
        data: {
          userId: user.id,
          title:  `New RFQ — ${pillarLabel}`,
          body:   `"${rfq.title}" from ${buyerName}. Respond before ${
            rfq.deliveryDate ? dayjs(rfq.deliveryDate).format('DD MMM YYYY') : 'deadline'
          }`,
          type:   'rfq',
          link:   `/rfq-detail.html?id=${rfq.id}`,
        },
      });

      // إيميل
      if (user.email) {
        await sendEmail({
          to:      user.email,
          subject: `[TheValveHubs] New RFQ — ${pillarLabel}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#006C35;padding:24px 32px;">
    <h2 style="color:#fff;margin:0;">New RFQ on TheValveHubs</h2>
  </div>
  <div style="padding:32px;border:1px solid #e8f0eb;border-top:none;">
    <p style="color:#5A6B62;font-size:14px;">Dear Supplier,</p>
    <p style="color:#1A2A1A;font-size:15px;">A new Request for Quotation matching your service category has been posted:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:10px;background:#F8FAF9;font-weight:700;color:#1A2A1A;width:140px;">RFQ Title</td><td style="padding:10px;background:#F8FAF9;color:#1A2A1A;">${rfq.title}</td></tr>
      <tr><td style="padding:10px;font-weight:700;color:#1A2A1A;">Category</td><td style="padding:10px;color:#1A2A1A;">${pillarLabel}</td></tr>
      <tr><td style="padding:10px;background:#F8FAF9;font-weight:700;color:#1A2A1A;">Buyer</td><td style="padding:10px;background:#F8FAF9;color:#1A2A1A;">${buyerName}</td></tr>
      ${rfq.quantity ? `<tr><td style="padding:10px;font-weight:700;color:#1A2A1A;">Quantity</td><td style="padding:10px;color:#1A2A1A;">${rfq.quantity} ${rfq.unit || ''}</td></tr>` : ''}
      ${rfq.region  ? `<tr><td style="padding:10px;background:#F8FAF9;font-weight:700;color:#1A2A1A;">Region</td><td style="padding:10px;background:#F8FAF9;color:#1A2A1A;">${rfq.region}</td></tr>` : ''}
      ${rfq.deliveryDate ? `<tr><td style="padding:10px;font-weight:700;color:#1A2A1A;">Delivery</td><td style="padding:10px;color:#1A2A1A;">${dayjs(rfq.deliveryDate).format('DD MMM YYYY')}</td></tr>` : ''}
    </table>
    <a href="https://thevalvehubs.netlify.app/rfq-detail.html?id=${rfq.id}"
       style="display:inline-block;background:#006C35;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
      View RFQ &amp; Submit Quote →
    </a>
    <p style="color:#9CAA9C;font-size:12px;margin-top:24px;">You are receiving this because your company is registered on TheValveHubs as a supplier in this category.</p>
  </div>
</div>`,
        }).catch(() => {}); // لا نوقف العملية إذا فشل الإيميل
      }
    })
  );

  return profiles.length;
}

// ─────────────────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────────────────
const createRfqSchema = z.object({
  title:        z.string().min(5,  'Title too short'),
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
  priceTotal:    z.number().positive('Price must be positive'),
  currency:      z.string().default('SAR'),
  leadTimeDays:  z.number().int().positive().optional(),
  notes:         z.string().optional(),
  attachmentUrl: z.string().url().optional().or(z.literal('')).transform(v => v || undefined),
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

// ─────────────────────────────────────────────────────────
//  POST /api/rfqs  — إنشاء RFQ
// ─────────────────────────────────────────────────────────
const createRfq = async (req, res) => {
  const data    = createRfqSchema.parse(req.body);
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company profile not found. Please complete your profile first.' });

  const rfq = await prisma.rfq.create({
    data: {
      buyerCompanyId: company.id,
      ...data,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
    },
  });

  // إشعار الموردين المطابقين (async — لا ننتظر)
  const notified = await notifySuppliers(rfq, company.nameEn).catch(() => 0);

  res.status(201).json({
    message:  'RFQ created successfully',
    data:     rfq,
    notified: `${notified} matching suppliers notified`,
  });
};

// ─────────────────────────────────────────────────────────
//  GET /api/rfqs  — قائمة عامة (للموردين)
// ─────────────────────────────────────────────────────────
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
  where.status = q.status || 'OPEN';
  if (q.region) where.region = { contains: q.region, mode: 'insensitive' };

  const [total, rfqs] = await Promise.all([
    prisma.rfq.count({ where }),
    prisma.rfq.findMany({
      where, skip, take: q.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, pillar: true, quantity: true,
        unit: true, region: true, deliveryDate: true, status: true,
        createdAt: true,
        _count:      { select: { responses: true } },
        buyerCompany: { select: { nameEn: true, city: true } },
      },
    }),
  ]);

  res.json({
    data:       rfqs,
    pagination: { total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) },
  });
};

// ─────────────────────────────────────────────────────────
//  GET /api/rfqs/my  — طلباتي (للمشترين)
// ─────────────────────────────────────────────────────────
const listMyRfqs = async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.json({ data: [] });

  const rfqs = await prisma.rfq.findMany({
    where:   { buyerCompanyId: company.id },
    orderBy: { createdAt: 'desc' },
    include: {
      responses: {
        select: {
          id: true, priceTotal: true, currency: true, leadTimeDays: true,
          isAwarded: true, createdAt: true,
          supplier: { select: { company: { select: { nameEn: true } } } },
        },
        orderBy: { priceTotal: 'asc' },
      },
      _count: { select: { responses: true } },
    },
  });

  res.json({ data: rfqs });
};

// ─────────────────────────────────────────────────────────
//  GET /api/rfqs/inbox  — صندوق الوارد (للموردين)
// ─────────────────────────────────────────────────────────
const listInboxRfqs = async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const profile = company
    ? await prisma.supplierProfile.findUnique({ where: { companyId: company.id } })
    : null;

  if (!profile) return res.json({ data: [] });

  // أبنِ فلتر الـ pillars حسب ما يقدمه المورد
  const pillarWhere = [];
  if (profile.pillar1Valves)    pillarWhere.push(1);
  if (profile.pillar2Parts)     pillarWhere.push(2);
  if (profile.pillar3Machining) pillarWhere.push(3);
  if (profile.pillar4Print)     pillarWhere.push(4);
  if (profile.pillar5TPI)       pillarWhere.push(5);
  if (profile.pillar6Rental)    pillarWhere.push(6);

  const where = {
    status: 'OPEN',
    ...(pillarWhere.length ? { pillar: { in: pillarWhere } } : {}),
  };

  const rfqs = await prisma.rfq.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      buyerCompany: { select: { nameEn: true, city: true, region: true } },
      _count:        { select: { responses: true } },
      // هل ردّ هذا المورد؟
      responses: {
        where:  { supplierId: profile.id },
        select: { id: true, priceTotal: true, isAwarded: true },
      },
    },
  });

  res.json({ data: rfqs, supplierId: profile.id });
};

// ─────────────────────────────────────────────────────────
//  GET /api/rfqs/:id  — تفاصيل RFQ
// ─────────────────────────────────────────────────────────
const getRfq = async (req, res) => {
  const rfq = await prisma.rfq.findUnique({
    where:   { id: req.params.id },
    include: {
      buyerCompany: { select: { nameEn: true, city: true, region: true, phone: true, email: true } },
      responses: {
        orderBy: { priceTotal: 'asc' },
        select: {
          id: true, priceTotal: true, currency: true,
          leadTimeDays: true, notes: true, isAwarded: true, createdAt: true,
          supplier: {
            select: {
              id: true, iktvaScore: true, aramcoApproved: true, isVerified: true,
              company: { select: { nameEn: true, city: true, phone: true } },
            },
          },
        },
      },
    },
  });

  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
  res.json({ data: rfq });
};

// ─────────────────────────────────────────────────────────
//  POST /api/rfqs/:id/respond  — رد مورد بعرض السعر
// ─────────────────────────────────────────────────────────
const respondToRfq = async (req, res) => {
  const data    = respondSchema.parse(req.body);
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const profile = company
    ? await prisma.supplierProfile.findUnique({ where: { companyId: company.id } })
    : null;
  if (!profile) return res.status(403).json({ error: 'Supplier profile required' });

  const rfq = await prisma.rfq.findUnique({
    where:   { id: req.params.id },
    include: { buyerCompany: { include: { user: { select: { id: true, email: true } } } } },
  });
  if (!rfq)               return res.status(404).json({ error: 'RFQ not found' });
  if (rfq.status !== 'OPEN') return res.status(400).json({ error: 'RFQ is no longer open' });

  // حد الاشتراك
  const sub = await prisma.subscription.findUnique({
    where:   { userId: req.user.id },
    include: { plan: true },
  });
  const maxRfqs       = sub?.plan?.maxRfqs ?? 3;
  const startOfMonth  = dayjs().startOf('month').toDate();
  const thisMonthCount = await prisma.rfqResponse.count({
    where: { supplierId: profile.id, createdAt: { gte: startOfMonth } },
  });
  if (thisMonthCount >= maxRfqs) {
    return res.status(403).json({
      error: `RFQ response limit reached (${maxRfqs}/month). Upgrade your plan.`,
    });
  }

  const response = await prisma.rfqResponse.upsert({
    where:  { rfqId_supplierId: { rfqId: rfq.id, supplierId: profile.id } },
    create: { rfqId: rfq.id, supplierId: profile.id, ...data },
    update: data,
  });

  // إشعار المشتري
  const buyerUser = rfq.buyerCompany?.user;
  if (buyerUser) {
    await prisma.notification.create({
      data: {
        userId: buyerUser.id,
        title:  `New Quote Received — ${rfq.title}`,
        body:   `${company.nameEn} submitted a quote: SAR ${data.priceTotal.toLocaleString()} | ${data.leadTimeDays || '—'} days`,
        type:   'rfq',
        link:   `/rfq-detail.html?id=${rfq.id}`,
      },
    }).catch(() => {});

    if (buyerUser.email) {
      await sendEmail({
        to:      buyerUser.email,
        subject: `[TheValveHubs] New Quote on Your RFQ — ${rfq.title}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#006C35;padding:24px 32px;">
    <h2 style="color:#fff;margin:0;">You received a new quote</h2>
  </div>
  <div style="padding:32px;border:1px solid #e8f0eb;border-top:none;">
    <p style="color:#1A2A1A;font-size:15px;"><strong>${company.nameEn}</strong> has submitted a quotation for your RFQ:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:10px;background:#F8FAF9;font-weight:700;width:140px;">RFQ</td><td style="padding:10px;background:#F8FAF9;">${rfq.title}</td></tr>
      <tr><td style="padding:10px;font-weight:700;">Supplier</td><td style="padding:10px;">${company.nameEn}</td></tr>
      <tr><td style="padding:10px;background:#F8FAF9;font-weight:700;">Price</td><td style="padding:10px;background:#F8FAF9;color:#006C35;font-weight:700;">SAR ${data.priceTotal.toLocaleString()}</td></tr>
      <tr><td style="padding:10px;font-weight:700;">Lead Time</td><td style="padding:10px;">${data.leadTimeDays ? data.leadTimeDays + ' days' : 'To be confirmed'}</td></tr>
      ${data.notes ? `<tr><td style="padding:10px;background:#F8FAF9;font-weight:700;">Notes</td><td style="padding:10px;background:#F8FAF9;">${data.notes}</td></tr>` : ''}
    </table>
    <a href="https://thevalvehubs.netlify.app/rfq-detail.html?id=${rfq.id}"
       style="display:inline-block;background:#006C35;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;">
      Review All Quotes →
    </a>
  </div>
</div>`,
      }).catch(() => {});
    }
  }

  res.status(201).json({ message: 'Quotation submitted successfully', data: response });
};

// ─────────────────────────────────────────────────────────
//  PUT /api/rfqs/:id/award  — إرساء العطاء + توليد فاتورة
// ─────────────────────────────────────────────────────────
const awardRfq = async (req, res) => {
  const { responseId } = z.object({ responseId: z.string().uuid() }).parse(req.body);

  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const rfq     = await prisma.rfq.findFirst({
    where: { id: req.params.id, buyerCompanyId: company?.id },
  });
  if (!rfq) return res.status(404).json({ error: 'RFQ not found or not yours' });

  const response = await prisma.rfqResponse.findFirst({
    where:   { id: responseId, rfqId: rfq.id },
    include: {
      supplier: {
        include: {
          company: { include: { user: { select: { id: true, email: true } } } },
        },
      },
    },
  });
  if (!response) return res.status(404).json({ error: 'Response not found' });

  // حساب الفاتورة (VAT 15%)
  const subtotal  = response.priceTotal;
  const vatAmount = parseFloat((subtotal * 0.15).toFixed(2));
  const total     = parseFloat((subtotal + vatAmount).toFixed(2));
  const invoiceNo = await nextInvoiceNumber();

  const [,, updatedRfq, invoice] = await prisma.$transaction([
    // إلغاء كل الإرساءات السابقة
    prisma.rfqResponse.updateMany({
      where: { rfqId: rfq.id },
      data:  { isAwarded: false },
    }),
    // تحديد الفائز
    prisma.rfqResponse.update({
      where: { id: responseId },
      data:  { isAwarded: true },
    }),
    // تحديث حالة RFQ
    prisma.rfq.update({
      where: { id: rfq.id },
      data:  { status: 'AWARDED', awardedTo: response.supplierId, closedAt: new Date() },
    }),
    // إنشاء الفاتورة تلقائياً
    prisma.invoice.create({
      data: {
        companyId:     company.id,
        invoiceNumber: invoiceNo,
        subtotal,
        vatAmount,
        total,
      },
    }),
  ]);

  // إشعار المورد الفائز
  const supplierUser = response.supplier?.company?.user;
  if (supplierUser) {
    await prisma.notification.create({
      data: {
        userId: supplierUser.id,
        title:  '🏆 You Won an RFQ!',
        body:   `Your quote for "${rfq.title}" has been awarded. Invoice ${invoiceNo} generated.`,
        type:   'rfq',
        link:   `/rfq-detail.html?id=${rfq.id}`,
      },
    }).catch(() => {});

    if (supplierUser.email) {
      await sendEmail({
        to:      supplierUser.email,
        subject: `[TheValveHubs] Congratulations — Your Quote Was Awarded`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#006C35;padding:24px 32px;">
    <h2 style="color:#fff;margin:0;">🏆 Quote Awarded!</h2>
  </div>
  <div style="padding:32px;border:1px solid #e8f0eb;border-top:none;">
    <p style="color:#1A2A1A;font-size:15px;">Your quotation for <strong>${rfq.title}</strong> has been selected.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:10px;background:#F8FAF9;font-weight:700;width:140px;">Invoice No.</td><td style="padding:10px;background:#F8FAF9;color:#006C35;font-weight:700;">${invoiceNo}</td></tr>
      <tr><td style="padding:10px;font-weight:700;">Subtotal</td><td style="padding:10px;">SAR ${subtotal.toLocaleString()}</td></tr>
      <tr><td style="padding:10px;background:#F8FAF9;font-weight:700;">VAT (15%)</td><td style="padding:10px;background:#F8FAF9;">SAR ${vatAmount.toLocaleString()}</td></tr>
      <tr><td style="padding:10px;font-weight:700;font-size:16px;">Total</td><td style="padding:10px;color:#006C35;font-weight:900;font-size:16px;">SAR ${total.toLocaleString()}</td></tr>
    </table>
    <a href="https://thevalvehubs.netlify.app/rfq-detail.html?id=${rfq.id}"
       style="display:inline-block;background:#006C35;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;">
      View Details & Invoice →
    </a>
  </div>
</div>`,
      }).catch(() => {});
    }
  }

  res.json({
    message:  'RFQ awarded successfully',
    invoice:  { invoiceNumber: invoiceNo, subtotal, vatAmount, total, id: invoice.id },
  });
};

// ─────────────────────────────────────────────────────────
//  POST /api/rfqs/emergency
// ─────────────────────────────────────────────────────────
const createEmergency = async (req, res) => {
  const data    = emergencySchema.parse(req.body);
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const emergency = await prisma.emergencyRfq.create({
    data: { companyId: company.id, ...data },
  });

  const responseTime = data.urgency === 'CRITICAL' ? '2 hours'
                     : data.urgency === 'HIGH'     ? '24 hours'
                     : '72 hours';

  res.status(201).json({
    message:      'Emergency request submitted',
    data:         emergency,
    responseTime: `Expected response within ${responseTime}`,
    nextStep:     'Our team will contact you shortly via WhatsApp and phone',
  });
};

// ─────────────────────────────────────────────────────────
//  GET /api/rfqs/emergency/:id
// ─────────────────────────────────────────────────────────
const getEmergency = async (req, res) => {
  const company   = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const emergency = await prisma.emergencyRfq.findFirst({
    where: { id: req.params.id, companyId: company?.id },
  });
  if (!emergency) return res.status(404).json({ error: 'Emergency request not found' });
  res.json({ data: emergency });
};

module.exports = {
  createRfq, listRfqs, listMyRfqs, listInboxRfqs,
  getRfq, respondToRfq, awardRfq,
  createEmergency, getEmergency,
};
