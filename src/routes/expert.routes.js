const router  = require('express').Router();
const { z }   = require('zod');
const prisma  = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const submitSchema = z.object({
  fullName:       z.string().min(2),
  jobTitle:       z.string().min(2),
  email:          z.string().email(),
  phone:          z.string().min(7),
  nationality:    z.string().optional(),
  location:       z.string().min(2),
  yearsExp:       z.string(),
  availability:   z.string(),
  iqamaStatus:    z.string().optional(),
  linkedIn:       z.string().optional(),
  specialisation: z.string(),
  skills:         z.array(z.string()).default([]),
  summary:        z.string().min(20),
  certifications: z.string().optional(),
  oemTraining:    z.string().optional(),
});

// POST /api/experts  — تقديم طلب خبير (public)
router.post('/', async (req, res) => {
  const data    = submitSchema.parse(req.body);
  const expert  = await prisma.expertProfile.create({ data });
  res.status(201).json({ message: 'Expert profile submitted successfully', data: { id: expert.id } });
});

// GET /api/experts  — قائمة الخبراء (admin + authenticated)
router.get('/', authenticate, async (req, res) => {
  const isAdmin  = req.user.role === 'ADMIN';
  const status   = req.query.status || (isAdmin ? undefined : 'APPROVED');
  const where    = status ? { status } : {};

  // Build select dynamically — Prisma v7 does not accept false values in select
  const baseSelect = {
    id: true, fullName: true, jobTitle: true, specialisation: true,
    location: true, yearsExp: true, availability: true, skills: true,
    status: true, createdAt: true, nationality: true,
    certifications: true, oemTraining: true, summary: true,
  };
  const adminSelect = { email: true, phone: true, linkedIn: true, reviewNotes: true, reviewedAt: true };
  const select = isAdmin ? { ...baseSelect, ...adminSelect } : baseSelect;

  const experts = await prisma.expertProfile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select,
  });
  res.json({ data: experts, total: experts.length });
});

// GET /api/experts/:id  — تفاصيل خبير (admin only)
router.get('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  const expert = await prisma.expertProfile.findUnique({ where: { id: req.params.id } });
  if (!expert) return res.status(404).json({ error: 'Expert not found' });
  res.json({ data: expert });
});

// PATCH /api/experts/:id/review  — مراجعة (admin only)
router.patch('/:id/review', authenticate, authorize('ADMIN'), async (req, res) => {
  const { status, reviewNotes } = z.object({
    status:      z.enum(['APPROVED', 'REJECTED']),
    reviewNotes: z.string().optional(),
  }).parse(req.body);

  const expert = await prisma.expertProfile.update({
    where: { id: req.params.id },
    data:  { status, reviewNotes, reviewedAt: new Date() },
  });
  res.json({ message: `Expert ${status.toLowerCase()}`, data: expert });
});

module.exports = router;
