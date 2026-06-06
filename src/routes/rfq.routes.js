const router = require('express').Router();
const {
  createRfq, listRfqs, getRfq,
  respondToRfq, awardRfq,
  createEmergency, getEmergency,
} = require('../controllers/rfq.controller');
const { authenticate, authorize } = require('../middleware/auth');

// ── RFQs ───────────────────────────────────────────
router.get('/',           authenticate, listRfqs);           // GET  /api/rfqs
router.post('/',          authenticate, createRfq);          // POST /api/rfqs
router.get('/:id',        authenticate, getRfq);             // GET  /api/rfqs/:id
router.post('/:id/respond', authenticate,
  authorize('SUPPLIER', 'ADMIN'), respondToRfq);             // POST /api/rfqs/:id/respond
router.put('/:id/award',  authenticate,
  authorize('BUYER', 'ADMIN'), awardRfq);                    // PUT  /api/rfqs/:id/award

// ── Emergency ──────────────────────────────────────
router.post('/emergency',     authenticate, createEmergency); // POST /api/rfqs/emergency
router.get('/emergency/:id',  authenticate, getEmergency);    // GET  /api/rfqs/emergency/:id

module.exports = router;
