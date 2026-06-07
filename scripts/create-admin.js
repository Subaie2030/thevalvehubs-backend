require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function main() {
  const password = await bcrypt.hash('Subaie@2030', 12);

  const user = await prisma.user.upsert({
    where: { email: 'abdullah@thevalvehubs.com' },
    update: {
      password: password,
      role: 'ADMIN',
    },
    create: {
      email: 'abdullah@thevalvehubs.com',
      password: password,
      role: 'ADMIN',
      company: {
        create: {
          nameEn: 'Abdullah Al-Subaie',
          nameAr: 'عبدالله السبيعي',
        }
      }
    },
    include: { company: true }
  });

  console.log('✅ Admin created successfully!');
  console.log('   Email   :', user.email);
  console.log('   Name    :', user.company?.nameEn);
  console.log('   Role    :', user.role);
  console.log('   Company :', user.company.nameEn);
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
