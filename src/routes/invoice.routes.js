const router  = require('express').Router();
const prisma  = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/invoices/my  — فواتير المستخدم الحالي
router.get('/my', authenticate, async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.json({ data: [] });

  const invoices = await prisma.invoice.findMany({
    where:   { companyId: company.id },
    orderBy: { issueDate: 'desc' },
    take:    20,
  });

  res.json({ data: invoices });
});

// GET /api/invoices/:id  — تفاصيل فاتورة
router.get('/:id', authenticate, async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, companyId: company?.id },
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ data: invoice });
});

module.exports = router;
