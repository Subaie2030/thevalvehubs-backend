const { VAT_RATE } = require('../config/constants');

// حساب الضريبة 15%
const calcVat = (subtotal) => {
  const vat   = parseFloat((subtotal * VAT_RATE).toFixed(2));
  const total = parseFloat((subtotal + vat).toFixed(2));
  return { subtotal, vatAmount: vat, total };
};

module.exports = { calcVat };
