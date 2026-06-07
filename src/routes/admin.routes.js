const router = require('express').Router();
const prisma  = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const ADMIN = [authenticate, authorize('ADMIN')];

// GET /api/admin/users
router.get('/users', ...ADMIN, async (req, res) => {
  const users = await prisma.user.findMany({
    include: { company: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users, total: users.length });
});

// PATCH /api/admin/users/:id/suspend
router.patch('/users/:id/suspend', ...ADMIN, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data:  { isActive: false },
  });
  res.json({ user });
});

// GET /api/admin/subscriptions
router.get('/subscriptions', ...ADMIN, async (req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: { plan: true, company: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ subscriptions, total: subscriptions.length });
});

// GET /api/admin/stats
router.get('/stats', ...ADMIN, async (req, res) => {
  const [users, suppliers, rfqs, subscriptions, invoices] = await Promise.all([
    prisma.user.count(),
    prisma.company.count({ where: { supplierProfile: { isNot: null } } }),
    prisma.rfq.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.invoice.aggregate({ _sum: { total: true } }),
  ]);
  res.json({
    users,
    suppliers,
    rfqs,
    activeSubscriptions: subscriptions,
    totalRevenue: invoices._sum.total || 0,
  });
});

module.exports = router;
