const prisma   = require('../config/database');
const moyasar  = require('../services/moyasar.service');

// ── POST /api/payments/webhook  (Moyasar يُرسل هنا) ─
const webhook = async (req, res) => {
  const signature = req.headers['x-moyasar-signature'];

  // التحقق من صحة الـ webhook
  if (signature && !moyasar.verifyWebhook(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event   = req.body;
  const type    = event.type;     // payment_paid | payment_failed | payment_refunded
  const payment = event.data;

  if (!payment?.id) return res.status(400).json({ error: 'Invalid webhook payload' });

  // جلب الـ payment من قاعدة البيانات بـ moyasarId
  const dbPayment = await prisma.payment.findUnique({
    where:   { moyasarId: payment.id },
    include: { subscription: true },
  });

  if (!dbPayment) return res.status(200).json({ received: true }); // تجاهل

  if (type === 'payment_paid') {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: dbPayment.id },
        data:  { status: 'PAID' },
      }),
      prisma.subscription.update({
        where: { id: dbPayment.subscriptionId },
        data:  { status: 'ACTIVE' },
      }),
    ]);
    console.log(`[Webhook] Payment ${payment.id} → PAID`);
  }

  if (type === 'payment_failed') {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: dbPayment.id },
        data:  { status: 'FAILED' },
      }),
      prisma.subscription.update({
        where: { id: dbPayment.subscriptionId },
        data:  { status: 'PAST_DUE' },
      }),
    ]);
    console.log(`[Webhook] Payment ${payment.id} → FAILED`);
  }

  if (type === 'payment_refunded') {
    await prisma.payment.update({
      where: { id: dbPayment.id },
      data:  { status: 'REFUNDED' },
    });
    console.log(`[Webhook] Payment ${payment.id} → REFUNDED`);
  }

  // Moyasar يحتاج 200 دائماً
  res.status(200).json({ received: true });
};

module.exports = { webhook };
