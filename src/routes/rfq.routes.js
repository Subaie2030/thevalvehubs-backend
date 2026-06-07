const router = require('express').Router();
const {
  createRfq, listRfqs, listMyRfqs, listInboxRfqs,
  getRfq, respondToRfq, awardRfq,
  createEmergency, getEmergency,
} = require('../controllers/rfq.controller');
const { authenticate, authorize } = require('../middleware/auth');

// ── RFQ Marketplace ─────────────────────────────────────
router.get ('/',              authenticate, listRfqs);          // GET  /api/rfqs         (open market)
router.post('/',              authenticate, createRfq);         // POST /api/rfqs         (buyer creates)

// ── My RFQs / Inbox ─────────────────────────────────────
router.get ('/my',            authenticate, listMyRfqs);        // GET  /api/rfqs/my      (buyer's own)
router.get ('/inbox',         authenticate, listInboxRfqs);     // GET  /api/rfqs/inbox   (supplier inbox)

// ── Emergency ───────────────────────────────────────────
router.post('/emergency',     authenticate, createEmergency);   // POST /api/rfqs/emergency
router.get ('/emergency/:id', authenticate, getEmergency);      // GET  /api/rfqs/emergency/:id

// ── Single RFQ ──────────────────────────────────────────
router.get ('/:id',           authenticate, getRfq);            // GET  /api/rfqs/:id
router.post('/:id/respond',   authenticate, authorize('SUPPLIER','ADMIN'), respondToRfq); // POST
router.put ('/:id/award',     authenticate, authorize('BUYER','ADMIN'),    awardRfq);     // PUT

module.exports = router;
