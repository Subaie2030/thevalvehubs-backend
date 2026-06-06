const { z }  = require('zod');
const prisma = require('../config/database');

// ── Zod Schemas ────────────────────────────────────
const profileSchema = z.object({
  // Company info
  nameAr:          z.string().optional(),
  crNumber:        z.string().optional(),
  vatNumber:       z.string().optional(),
  phone:           z.string().optional(),
  website:         z.string().url().optional().or(z.literal('')),
  city:            z.string().optional(),
  region:          z.string().optional(),
  country:         z.string().default('SA'),

  // Supplier pillars (true/false)
  pillar1Valves:   z.boolean().default(false),
  pillar2Parts:    z.boolean().default(false),
  pillar3Machining: z.boolean().default(false),
  pillar4Print:    z.boolean().default(false),
  pillar5TPI:      z.boolean().default(false),
  pillar6Rental:   z.boolean().default(false),

  // Saudi-specific
  iktvaScore:      z.number().min(0).max(100).optional(),
  aramcoApproved:  z.boolean().default(false),
  sabicApproved:   z.boolean().default(false),
  saudizationPct:  z.number().min(0).max(100).optional(),
  tier:            z.enum(['P1_SAUDI', 'P2_GLOBAL', 'EMERGENCY']).default('P1_SAUDI'),
});

const certSchema = z.object({
  name:        z.string().min(1, 'Certification name required'),
  issuedBy:    z.string().optional(),
  expiryDate:  z.string().optional(),
  documentUrl: z.string().url().optional(),
});

const listSchema = z.object({
  page:     z.coerce.number().default(1),
  limit:    z.coerce.number().max(50).default(20),
  pillar:   z.enum(['1','2','3','4','5','6']).optional(),
  tier:     z.enum(['P1_SAUDI','P2_GLOBAL','EMERGENCY']).optional(),
  region:   z.string().optional(),
  aramco:   z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  search:   z.string().optional(),
});

// ── GET /api/suppliers  (قائمة الموردين مع فلترة) ──
const listSuppliers = async (req, res) => {
  const q = listSchema.parse(req.query);
  const skip = (q.page - 1) * q.limit;

  // بناء شرط الفلترة ديناميكياً
  const where = { isActive: true };

  if (q.verified !== undefined) where.isVerified = q.verified;
  if (q.tier)     where.tier = q.tier;
  if (q.aramco)   where.aramcoApproved = true;

  if (q.pillar) {
    const pillarMap = {
      '1': 'pillar1Valves',
      '2': 'pillar2Parts',
      '3': 'pillar3Machining',
      '4': 'pillar4Print',
      '5': 'pillar5TPI',
      '6': 'pillar6Rental',
    };
    where[pillarMap[q.pillar]] = true;
  }

  if (q.region || q.search) {
    where.company = {};
    if (q.region) where.company.region = { contains: q.region, mode: 'insensitive' };
    if (q.search) where.company.nameEn = { contains: q.search, mode: 'insensitive' };
  }

  const [total, suppliers] = await Promise.all([
    prisma.supplierProfile.count({ where }),
    prisma.supplierProfile.findMany({
      where,
      skip,
      take: q.limit,
      orderBy: [{ isVerified: 'desc' }, { iktvaScore: 'desc' }],
      select: {
        id:              true,
        tier:            true,
        isVerified:      true,
        iktvaScore:      true,
        aramcoApproved:  true,
        pillar1Valves:   true,
        pillar2Parts:    true,
        pillar3Machining: true,
        pillar4Print:    true,
        pillar5TPI:      true,
        pillar6Rental:   true,
        company: {
          select: {
            nameEn: true,
            nameAr: true,
            city:   true,
            region: true,
            country: true,
            website: true,
          },
        },
        certifications: {
          select: { name: true },
          take: 5,
        },
      },
    }),
  ]);

  res.json({
    data:       suppliers,
    pagination: {
      total,
      page:  q.page,
      limit: q.limit,
      pages: Math.ceil(total / q.limit),
    },
  });
};

// ── GET /api/suppliers/:id  (ملف مورد كامل) ────────
const getSupplier = async (req, res) => {
  const supplier = await prisma.supplierProfile.findUnique({
    where: { id: req.params.id },
    include: {
      company: true,
      certifications: true,
    },
  });

  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  res.json({ data: supplier });
};

// ── POST /api/suppliers/profile  (إنشاء/تحديث ملف المورد) ─
const upsertProfile = async (req, res) => {
  const data = profileSchema.parse(req.body);

  // جلب companyId من المستخدم الحالي
  const company = await prisma.company.findUnique({
    where: { userId: req.user.id },
  });
  if (!company) return res.status(404).json({ error: 'Company not found. Complete registration first.' });

  const { nameAr, crNumber, vatNumber, phone, website, city, region, country, ...profileData } = data;

  // تحديث بيانات الشركة + إنشاء/تحديث ملف المورد في عملية واحدة
  const [, profile] = await prisma.$transaction([
    prisma.company.update({
      where: { id: company.id },
      data:  { nameAr, crNumber, vatNumber, phone, website, city, region, country },
    }),
    prisma.supplierProfile.upsert({
      where:  { companyId: company.id },
      create: { companyId: company.id, ...profileData },
      update: profileData,
    }),
  ]);

  res.json({ message: 'Supplier profile saved', data: profile });
};

// ── GET /api/suppliers/me  (ملفي كمورد) ────────────
const myProfile = async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { userId: req.user.id },
    include: {
      supplierProfile: { include: { certifications: true } },
    },
  });

  if (!company) return res.status(404).json({ error: 'Company not found' });

  res.json({ data: company });
};

// ── POST /api/suppliers/certs  (إضافة شهادة) ───────
const addCertification = async (req, res) => {
  const data = certSchema.parse(req.body);

  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const profile = await prisma.supplierProfile.findUnique({ where: { companyId: company.id } });
  if (!profile) return res.status(404).json({ error: 'Create your supplier profile first' });

  const cert = await prisma.supplierCertification.create({
    data: {
      supplierId:  profile.id,
      name:        data.name,
      issuedBy:    data.issuedBy,
      expiryDate:  data.expiryDate ? new Date(data.expiryDate) : null,
      documentUrl: data.documentUrl,
    },
  });

  res.status(201).json({ message: 'Certification added', data: cert });
};

// ── DELETE /api/suppliers/certs/:certId  (حذف شهادة) ─
const deleteCertification = async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  const profile = await prisma.supplierProfile.findUnique({ where: { companyId: company.id } });

  await prisma.supplierCertification.deleteMany({
    where: { id: req.params.certId, supplierId: profile.id },
  });

  res.json({ message: 'Certification removed' });
};

module.exports = {
  listSuppliers,
  getSupplier,
  upsertProfile,
  myProfile,
  addCertification,
  deleteCertification,
};
