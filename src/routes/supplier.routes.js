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

module.exports = router;
