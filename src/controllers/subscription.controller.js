const { z }      = require('zod');
const dayjs      = require('dayjs');
const prisma     = require('../config/database');
const moyasar    = require('../services/moyasar.service');
const { calcVat }              = require('../utils/vatCalculator');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');

// ── GET /api/plans  (عرض الخطط) ────────────────────
const listPlans = async (req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    where:   { isActive: true },
    orderBy: { priceMonthly: 'asc' },
  });
  res.json({ data: plans });
};

// ── GET /api/subscriptions/current  (اشتراكي الحالي) ─
const currentSubscription = async (req, res) => {
  const sub = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
    include: {
      plan:    true,
      invoices: { orderBy: { issueDate: 'desc' }, take: 5 },
    },
  });
  res.json({ data: sub || null });
};

// ── POST /api/subscriptions  (اشتراك جديد + دفع) ───
const createSubscription = async (req, res) => {
  const schema = z.object({
    planId:       z.string().uuid(),
    billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
    // Moyasar payment source token (من frontend)
    paymentSource: z.object({
      type:  z.string(),   // creditcard | mada | applepay
      token: z.string().optional(),
    }).optional(),
  });

  const data = schema.parse(req.body);

  // جلب الخطة
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  // جلب الشركة
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  // حساب المبلغ
  const price    = data.billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
  const vatCalc  = calcVat(price);
  const endDate  = data.billingCycle === 'YEARLY'
    ? dayjs().add(1, 'year').toDate()
    : dayjs().add(1, 'month').toDate();

  // ── خطة مجانية — لا دفع مطلوب ─────────────────
  if (price === 0) {
    const sub = await prisma.subscription.upsert({
      where:  { userId: req.user.id },
      create: {
        userId: req.user.id, companyId: company.id,
        planId: plan.id, billingCycle: data.billingCycle,
        status: 'ACTIVE', endDate,
      },
      update: {
        planId: plan.id, status: 'ACTIVE', endDate,
        billingCycle: data.billingCycle,
      },
    });
    return res.json({ message: 'Subscribed to Free plan', data: sub });
  }

  // ── خطة مدفوعة — إنشاء Payment record ──────────
  const invoiceNumber = await generateInvoiceNumber();

  // في بيئة الاختبار — simulate payment (بدون Moyasar API حقيقي)
  let moyasarId = `test_${Date.now()}`;
  let payStatus = 'PAID';

  if (data.paymentSource && process.env.NODE_ENV === 'production') {
    const moyasarRes = await moyasar.createPayment({
      amountHalala: vatCalc.total * 100,
      description:  `TheValveHubs - ${plan.nameEn} (${data.billingCycle})`,
      source:       data.paymentSource,
      callbackUrl:  `${process.env.API_URL}/api/payments/webhook`,
      metadata:     { companyId: company.id, planId: plan.id },
    });
    moyasarId = moyasarRes.id;
    payStatus  = moyasarRes.status === 'paid' ? 'PAID' : 'PENDING';
  }

  // إنشاء Subscription + Payment + Invoice في عملية واحدة
  const [sub, payment, invoice] = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.upsert({
      where:  { userId: req.user.id },
      create: {
        userId: req.user.id, companyId: company.id,
        planId: plan.id, billingCycle: data.billingCycle,
        status: payStatus === 'PAID' ? 'ACTIVE' : 'PAST_DUE', endDate,
      },
      update: {
        planId: plan.id, status: payStatus === 'PAID' ? 'ACTIVE' : 'PAST_DUE',
        endDate, billingCycle: data.billingCycle,
      },
    });

    const payment = await tx.payment.create({
      data: {
        subscriptionId: sub.id,
        moyasarId,
        amount:      vatCalc.subtotal,
        vatAmount:   vatCalc.vatAmount,
        totalAmount: vatCalc.total,
        status:      payStatus,
        method:      data.paymentSource?.type || 'manual',
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        companyId:     company.id,
        subscriptionId: sub.id,
        paymentId:     payment.id,
        invoiceNumber,
        subtotal:      vatCalc.subtotal,
        vatAmount:     vatCalc.vatAmount,
        total:         vatCalc.total,
      },
    });

    return [sub, payment, invoice];
  });

  res.status(201).json({
    message:       'Subscription activated',
    data: { sub, payment, invoice },
    summary: {
      plan:          plan.nameEn,
      cycle:         data.billingCycle,
      subtotal:      `${vatCalc.subtotal} SAR`,
      vat15pct:      `${vatCalc.vatAmount} SAR`,
      total:         `${vatCalc.total} SAR`,
      invoiceNumber,
      validUntil:    dayjs(endDate).format('YYYY-MM-DD'),
    },
  });
};

// ── DELETE /api/subscriptions/:id  (إلغاء) ─────────
const cancelSubscription = async (req, res) => {
  const sub = await prisma.subscription.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  await prisma.subscription.update({
    where: { id: sub.id },
    data:  { status: 'CANCELLED' },
  });

  res.json({ message: 'Subscription cancelled. Access remains until end date.' });
};

// ── GET /api/invoices  (قائمة الفواتير) ────────────
const listInvoices = async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const invoices = await prisma.invoice.findMany({
    where:   { companyId: company.id },
    orderBy: { issueDate: 'desc' },
    include: { payment: { select: { status: true, method: true } } },
  });

  res.json({ data: invoices });
};

module.exports = {
  listPlans,
  currentSubscription,
  createSubscription,
  cancelSubscription,
  listInvoices,
};
