require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }     = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding subscription plans...');

  // حذف الخطط القديمة إن وجدت
  await prisma.subscriptionPlan.deleteMany();

  await prisma.subscriptionPlan.createMany({
    data: [
      {
        nameEn:       'Free',
        nameAr:       'مجاني',
        priceMonthly: 0,
        priceYearly:  0,
        features: [
          'Basic supplier profile',
          'Listed in Saudi Market directory',
          'Up to 3 RFQ responses/month',
          'TVH badge (unverified)',
        ],
        maxRfqs:  3,
        isActive: true,
      },
      {
        nameEn:       'Professional',
        nameAr:       'احترافي',
        priceMonthly: 499,
        priceYearly:  4490,   // شهرين مجاناً
        features: [
          'Verified supplier badge ✓',
          'Priority listing in directory',
          'Up to 30 RFQ responses/month',
          'Emergency RFQ notifications',
          'IKTVA score display',
          'Upload certifications (ISO, API...)',
          'WhatsApp project alerts',
        ],
        maxRfqs:  30,
        isActive: true,
      },
      {
        nameEn:       'Enterprise',
        nameAr:       'مؤسسي',
        priceMonthly: 1499,
        priceYearly:  13490,  // شهرين مجاناً
        features: [
          'Everything in Professional',
          'Unlimited RFQ responses',
          'Featured placement (top of directory)',
          'Dedicated account manager',
          'API access for ERP integration',
          'Custom IKTVA reporting',
          'Priority Emergency 24/7 matching',
          'Aramco/SABIC AVL badge display',
        ],
        maxRfqs:  9999,
        isActive: true,
      },
    ],
  });

  const plans = await prisma.subscriptionPlan.findMany();
  console.log(`✅ Created ${plans.length} subscription plans:`);
  plans.forEach(p => console.log(`   - ${p.nameEn}: ${p.priceMonthly} SAR/month`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
