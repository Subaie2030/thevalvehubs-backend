const router  = require('express').Router();
const { register, login, me, logout } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter }  = require('../middleware/rateLimiter');

// Public
router.post('/register', authLimiter, register);
router.post('/login',    authLimiter, login);
router.post('/logout',   logout);

// Protected
router.get('/me', authenticate, me);

module.exports = router;
