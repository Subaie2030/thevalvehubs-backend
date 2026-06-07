/**
 * Seed subscription plans into the database
 * Run: node scripts/seed-plans.js
 */
require('dotenv').config();
const prisma = require('../src/config/database');

const PLANS = [
  {
    nameEn:       'Free',
    nameAr:       'مجاني',
    priceMonthly: 0,
    priceYearly:  0,
    maxRfqs:      0,
    isActive:     true,
    features:     ['Basic company listing','Up to 3 products','Public profile page','Contact form visible'],
  },
  {
    nameEn:       'Basic',
    nameAr:       'أساسي',
    priceMonthly: 490,
    priceYearly:  470,
    maxRfqs:      5,
    isActive:     true,
    features:     ['Full company profile','Up to 20 products/services','Receive RFQs (up to 5/month)','IKTVA score display','Email support'],
  },
  {
    nameEn:       'Pro',
    nameAr:       'احترافي',
    priceMonthly: 1490,
    priceYearly:  1190,
    maxRfqs:      -1,
    isActive:     true,
    features:     ['Everything in Basic','Unlimited products','Unlimited RFQ access','Verified supplier badge','Priority search placement','IKTVA consulting session (1hr)','WhatsApp RFQ alerts'],
  },
  {
    nameEn:       'Enterprise',
    nameAr:       'مؤسسي',
    priceMonthly: 3990,
    priceYearly:  3190,
    maxRfqs:      -1,
    isActive:     true,
    features:     ['Everything in Pro','Aramco Preferred Supplier tag','Dedicated account manager','ZATCA e-invoice setup','Custom IKTVA report','Featured homepage placement','Arabic profile translation','Priority emergency RFQ'],
  },
];

async function main() {
  console.log('🌱 Seeding subscription plans...\n');

  for (const plan of PLANS) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { nameEn: plan.nameEn },
    }).catch(() => null);

    if (existing) {
      await prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: plan,
      });
      console.log(`  ✅ Updated: ${plan.nameEn} (SAR ${plan.priceMonthly}/mo)`);
    } else {
      await prisma.subscriptionPlan.create({ data: plan });
      console.log(`  ✅ Created: ${plan.nameEn} (SAR ${plan.priceMonthly}/mo)`);
    }
  }

  const count = await prisma.subscriptionPlan.count();
  console.log(`\n✅ Done — ${count} plans in database`);
  console.log('\nPlans seeded:');
  console.log('  Free     → SAR 0/mo');
  console.log('  Basic    → SAR 490/mo  | SAR 470/mo (annual)');
  console.log('  Pro      → SAR 1,490/mo| SAR 1,190/mo (annual)  ← most popular');
  console.log('  Enterprise → SAR 3,990/mo| SAR 3,190/mo (annual)');
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
