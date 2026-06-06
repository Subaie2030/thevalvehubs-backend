const router = require('express').Router();
const { calculate, history, benchmark } = require('../controllers/iktva.controller');
const { authenticate } = require('../middleware/auth');

router.get('/benchmark',  benchmark);                    // GET  /api/iktva/benchmark (public)
router.post('/calculate', authenticate, calculate);      // POST /api/iktva/calculate
router.get('/history',    authenticate, history);        // GET  /api/iktva/history

module.exports = router;
