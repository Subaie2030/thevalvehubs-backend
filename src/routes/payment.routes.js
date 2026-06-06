const router  = require('express').Router();
const { webhook } = require('../controllers/payment.controller');

// Moyasar يرسل هنا — بدون authentication (webhook عام)
router.post('/webhook', webhook);

module.exports = router;
