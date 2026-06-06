const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { z }   = require('zod');
const prisma  = require('../config/database');
const { BCRYPT_ROUNDS } = require('../config/constants');

// ── Zod Schemas ────────────────────────────────────
const registerSchema = z.object({
  email:    z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role:     z.enum(['BUYER', 'SUPPLIER', 'INVESTOR']).default('BUYER'),
  nameEn:   z.string().min(2, 'Company name required'),
});

const loginSchema = z.object({
  email:    z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

// ── Token Generator ────────────────────────────────
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ── POST /api/auth/register ────────────────────────
const register = async (req, res) => {
  const data = registerSchema.parse(req.body);

  // تحقق من عدم تكرار الإيميل
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // تشفير كلمة المرور
  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // إنشاء المستخدم والشركة في عملية واحدة
  const user = await prisma.user.create({
    data: {
      email:    data.email,
      password: hashedPassword,
      role:     data.role,
      company: {
        create: {
          nameEn:  data.nameEn,
          country: 'SA',
        },
      },
    },
    select: {
      id:        true,
      email:     true,
      role:      true,
      createdAt: true,
      company:   { select: { id: true, nameEn: true } },
    },
  });

  const token = generateToken(user.id, user.role);

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user,
  });
};

// ── POST /api/auth/login ───────────────────────────
const login = async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where:  { email: data.email },
    select: { id: true, email: true, password: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(data.password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user.id, user.role);

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
};

// ── GET /api/auth/me ───────────────────────────────
const me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: {
      id:        true,
      email:     true,
      role:      true,
      isVerified: true,
      createdAt: true,
      company: {
        select: {
          id:       true,
          nameEn:   true,
          nameAr:   true,
          crNumber: true,
          vatNumber: true,
          city:     true,
          region:   true,
          supplierProfile: {
            select: { iktvaScore: true, isVerified: true, tier: true },
          },
        },
      },
    },
  });

  res.json({ user });
};

// ── POST /api/auth/logout ──────────────────────────
const logout = (req, res) => {
  // JWT stateless — client يحذف الـ token
  res.json({ message: 'Logged out successfully' });
};

module.exports = { register, login, me, logout };
