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

// GET /api/admin/notifications
router.get('/notifications', ...ADMIN, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where:   { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take:    50,
  });
  res.json({ notifications, unread: notifications.filter(n => !n.isRead).length });
});

// PATCH /api/admin/notifications/read-all
router.patch('/notifications/read-all', ...ADMIN, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data:  { isRead: true },
  });
  res.json({ success: true });
});

// GET /api/admin/invoices
router.get('/invoices', ...ADMIN, async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { company: { select: { nameEn: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ invoices, total: invoices.length });
});

module.exports = router;
