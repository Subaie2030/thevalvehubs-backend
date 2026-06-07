const router = require('express').Router();
const {
  listSuppliers,
  getSupplier,
  upsertProfile,
  myProfile,
  addCertification,
  deleteCertification,
} = require('../controllers/supplier.controller');
const { authenticate, authorize } = require('../middleware/auth');

// ── Public ─────────────────────────────────────────
router.get('/',    listSuppliers);          // GET /api/suppliers?pillar=1&tier=P1_SAUDI
router.get('/:id', getSupplier);           // GET /api/suppliers/:id

// ── Protected (Supplier only) ──────────────────────
router.get('/me/profile',
  authenticate, authorize('SUPPLIER', 'ADMIN'),
  myProfile);

router.post('/profile',
  authenticate, authorize('SUPPLIER', 'ADMIN'),
  upsertProfile);

router.post('/certs',
  authenticate, authorize('SUPPLIER', 'ADMIN'),
  addCertification);

router.delete('/certs/:certId',
  authenticate, authorize('SUPPLIER', 'ADMIN'),
  deleteCertification);

// ── Admin: verify supplier ─────────────────────────
router.patch('/:id/verify',
  authenticate, authorize('ADMIN'),
  async (req, res) => {
    const prisma = require('../config/database');
    const { sendVerificationEmail } = require('../services/email.service');
    const { isVerified } = req.body;

    // :id is the Company ID
    const company = await prisma.company.update({
      where:   { id: req.params.id },
      data:    { isVerified: Boolean(isVerified) },
      include: { user: { select: { email: true } } },
    });

    // Send verification email when verified
    if (isVerified && company.user?.email) {
      sendVerificationEmail({
        email:       company.user.email,
        nameEn:      company.nameEn,
        companyName: company.nameEn,
      }).catch(e => console.error('Verify email failed:', e.message));
    }

    res.json({ company });
  });

module.exports = router;
