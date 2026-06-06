const router = require('express').Router();
const {
  listPlans, currentSubscription,
  createSubscription, cancelSubscription, listInvoices,
} = require('../controllers/subscription.controller');
const { authenticate } = require('../middleware/auth');

// Public
router.get('/plans', listPlans);

// Protected
router.get('/subscriptions/current', authenticate, currentSubscription);
router.post('/subscriptions',        authenticate, createSubscription);
router.delete('/subscriptions/:id',  authenticate, cancelSubscription);
router.get('/invoices',              authenticate, listInvoices);

module.exports = router;
