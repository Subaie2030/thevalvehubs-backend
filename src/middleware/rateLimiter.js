const rateLimit = require('express-rate-limit');

// عام — 100 طلب/دقيقة
const general = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth — 10 محاولات/دقيقة (حماية من brute force)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { general, authLimiter };
