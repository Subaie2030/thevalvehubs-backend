const { z }  = require('zod');
const prisma = require('../config/database');

// ── IKTVA Formula (Saudi Aramco standard) ──────────
// IKTVA% = (Saudi Labour + Saudi Materials + Saudi Services + Saudi Overhead + Saudi CAPEX)
//          ÷ Total Revenue × 100
//
// Breakdown weights (Aramco guidance):
//   Labour:    × 1.0  (direct)
//   Materials: × 1.0  (if manufactured in KSA)
//   Services:  × 1.0  (if provided by Saudi entity)
//   Overhead:  × 0.8  (partial credit)
//   CAPEX:     × 0.5  (capital investment credit)

const calcIktvaScore = ({
  totalRevenue,
  saudiLabourCost,
  saudiMaterialCost,
  saudiServiceCost,
  saudiOverheadCost,
  saudiCapexCost,
}) => {
  if (totalRevenue <= 0) return { score: 0, amount: 0, breakdown: {} };

  const weighted = {
    labour:   saudiLabourCost   * 1.0,
    material: saudiMaterialCost * 1.0,
    service:  saudiServiceCost  * 1.0,
    overhead: saudiOverheadCost * 0.8,
    capex:    saudiCapexCost    * 0.5,
  };

  const totalSaudi = Object.values(weighted).reduce((a, b) => a + b, 0);
  const score      = parseFloat(((totalSaudi / totalRevenue) * 100).toFixed(2));
  const clipped    = Math.min(score, 100); // لا يتجاوز 100%

  return {
    score:  clipped,
    amount: parseFloat(totalSaudi.toFixed(2)),
    breakdown: {
      labour:   { raw: saudiLabourCost,   weighted: weighted.labour,   pct: pct(weighted.labour, totalRevenue) },
      material: { raw: saudiMaterialCost, weighted: weighted.material, pct: pct(weighted.material, totalRevenue) },
      service:  { raw: saudiServiceCost,  weighted: weighted.service,  pct: pct(weighted.service, totalRevenue) },
      overhead: { raw: saudiOverheadCost, weighted: weighted.overhead, pct: pct(weighted.overhead, totalRevenue) },
      capex:    { raw: saudiCapexCost,    weighted: weighted.capex,    pct: pct(weighted.capex, totalRevenue) },
    },
  };
};

const pct = (val, total) => parseFloat(((val / total) * 100).toFixed(2));

// ── رسالة التقييم ──────────────────────────────────
const getIktvaRating = (score) => {
  if (score >= 60) return { rating: 'Excellent ✅',  color: '#006C35', badge: 'Aramco Preferred' };
  if (score >= 40) return { rating: 'Good 🟡',       color: '#C8973A', badge: 'IKTVA Compliant' };
  if (score >= 20) return { rating: 'Developing 🔶', color: '#E67E22', badge: 'Improvement Needed' };
  return           { rating: 'Low ❌',               color: '#C0392B', badge: 'Below Threshold' };
};

// ── الـ Schema ─────────────────────────────────────
const iktvaSchema = z.object({
  totalRevenue:      z.number().positive('Total revenue must be positive'),
  saudiLabourCost:   z.number().min(0),
  saudiMaterialCost: z.number().min(0),
  saudiServiceCost:  z.number().min(0),
  saudiOverheadCost: z.number().min(0),
  saudiCapexCost:    z.number().min(0),
  notes:             z.string().optional(),
  period:            z.string().optional(),
  saveResult:        z.boolean().default(true),
});

// ── POST /api/iktva/calculate ──────────────────────
const calculate = async (req, res) => {
  const data   = iktvaSchema.parse(req.body);
  const result = calcIktvaScore(data);
  const rating = getIktvaRating(result.score);

  let saved = null;

  // حفظ النتيجة إذا طُلب
  if (data.saveResult) {
    const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
    if (company) {
      saved = await prisma.iktvaCalculation.create({
        data: {
          companyId:         company.id,
          totalRevenue:      data.totalRevenue,
          saudiLabourCost:   data.saudiLabourCost,
          saudiMaterialCost: data.saudiMaterialCost,
          saudiServiceCost:  data.saudiServiceCost,
          saudiOverheadCost: data.saudiOverheadCost,
          saudiCapexCost:    data.saudiCapexCost,
          iktvaScore:        result.score,
          iktvaAmount:       result.amount,
          notes:             data.notes,
          period:            data.period,
        },
      });

      // تحديث IKTVA Score في ملف المورد
      const profile = await prisma.supplierProfile.findUnique({ where: { companyId: company.id } });
      if (profile) {
        await prisma.supplierProfile.update({
          where: { id: profile.id },
          data:  { iktvaScore: result.score },
        });
      }
    }
  }

  res.json({
    result: {
      score:     result.score,
      amount:    result.amount,
      breakdown: result.breakdown,
    },
    rating,
    summary: {
      totalRevenue:  `${data.totalRevenue.toLocaleString()} SAR`,
      saudiContent:  `${result.amount.toLocaleString()} SAR`,
      iktvaScore:    `${result.score}%`,
      rating:        rating.rating,
      badge:         rating.badge,
      tip: result.score < 40
        ? '💡 Increase Saudi labour and local material sourcing to improve your IKTVA score'
        : '✅ Strong IKTVA performance — you qualify for Aramco preferred supplier programs',
    },
    savedId: saved?.id || null,
  });
};

// ── GET /api/iktva/history ─────────────────────────
const history = async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.user.id } });
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const calcs = await prisma.iktvaCalculation.findMany({
    where:   { companyId: company.id },
    orderBy: { createdAt: 'desc' },
    take:    20,
    select: {
      id: true, iktvaScore: true, iktvaAmount: true,
      totalRevenue: true, period: true, notes: true, createdAt: true,
    },
  });

  // حساب الاتجاه (هل يتحسن؟)
  const trend = calcs.length >= 2
    ? calcs[0].iktvaScore > calcs[1].iktvaScore ? '📈 Improving' : '📉 Declining'
    : 'Insufficient data';

  res.json({
    data:         calcs,
    trend,
    latestScore:  calcs[0]?.iktvaScore ?? null,
    totalCalcs:   calcs.length,
  });
};

// ── GET /api/iktva/benchmark ───────────────────────
const benchmark = async (req, res) => {
  // متوسطات السوق السعودي (بيانات ثابتة للمرحلة الأولى)
  res.json({
    benchmarks: {
      aramcoRequirement:   { min: 40, target: 60, label: 'Saudi Aramco IBO' },
      sabicRequirement:    { min: 30, target: 50, label: 'SABIC Procurement' },
      nupcoRequirement:    { min: 25, target: 45, label: 'NUPCO Healthcare' },
      vision2030Target:    { min: 50, target: 75, label: 'Vision 2030 Goal' },
      industryAverage:     { value: 42,           label: 'KSA Industry Average (2025)' },
    },
    tips: [
      'Hire Saudi engineers and technicians (highest weight factor)',
      'Source raw materials from SABIC and local manufacturers',
      'Partner with Saudi service providers (logistics, testing, QA)',
      'Invest in local facilities and equipment (CAPEX credit)',
      'Join IKTVA reporting programs for preferred supplier status',
    ],
  });
};

module.exports = { calculate, history, benchmark };
