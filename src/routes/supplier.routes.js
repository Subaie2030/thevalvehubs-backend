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
    const { isVerified } = req.body;
    const company = await require('../config/database').company.update({
      where: { id: req.params.id },
      data:  { isVerified: Boolean(isVerified) },
    });
    res.json({ company });
  });

module.exports = router;
