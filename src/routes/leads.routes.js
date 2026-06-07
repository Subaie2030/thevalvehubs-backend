const router = require('express').Router();
const prisma  = require('../config/database');

// POST /api/leads/ivs — IVS 2026 lead capture (public)
router.post('/ivs', async (req, res) => {
  const { name, company, email, phone, role, interest, message, source } = req.body;

  if (!name || !company || !email) {
    return res.status(400).json({ error: 'name, company, email are required' });
  }

  // Store as a notification (reuse existing table) or just log it
  console.log(`\n🎯 IVS LEAD: ${name} | ${company} | ${email} | ${role} | ${interest}`);

  // In production: save to DB or send to CRM
  // For now: save as notification to admin
  try {
    await prisma.notification.create({
      data: {
        userId:  '358f6c83-7d9a-4b01-8ea1-bae017674828', // Abdullah admin ID
        type:    'IVS_LEAD',
        title:   `New IVS Lead: ${name} — ${company}`,
        message: `Email: ${email} | Role: ${role} | Interest: ${interest} | Phone: ${phone || '—'} | Note: ${message || '—'}`,
      }
    });
  } catch(e) {
    console.error('Lead save failed:', e.message);
  }

  res.json({ success: true, message: 'Meeting request received. We will confirm within 24 hours.' });
});

module.exports = router;
