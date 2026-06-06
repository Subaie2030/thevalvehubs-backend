const prisma = require('../config/database');

// توليد رقم فاتورة تسلسلي: TVH-2026-000001
const generateInvoiceNumber = async () => {
  const year  = new Date().getFullYear();
  const count = await prisma.invoice.count();
  const seq   = String(count + 1).padStart(6, '0');
  return `TVH-${year}-${seq}`;
};

module.exports = { generateInvoiceNumber };
