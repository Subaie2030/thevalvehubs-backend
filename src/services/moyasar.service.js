const axios = require('axios');

const BASE_URL = 'https://api.moyasar.com/v1';
const API_KEY  = process.env.MOYASAR_API_KEY;

// المصادقة — Basic Auth بـ API Key
const auth = { username: API_KEY, password: '' };

// ── إنشاء دفعة جديدة ──────────────────────────────
const createPayment = async ({ amountHalala, description, source, callbackUrl, metadata }) => {
  const res = await axios.post(`${BASE_URL}/payments`, {
    amount:       amountHalala,     // المبلغ بالهللة (1 SAR = 100 هللة)
    currency:     'SAR',
    description,
    source,                         // { type: 'creditcard', token: '...' }
    callback_url: callbackUrl,
    metadata,
  }, { auth });
  return res.data;
};

// ── جلب بيانات دفعة ───────────────────────────────
const getPayment = async (paymentId) => {
  const res = await axios.get(`${BASE_URL}/payments/${paymentId}`, { auth });
  return res.data;
};

// ── استرداد دفعة ──────────────────────────────────
const refundPayment = async (paymentId, amountHalala) => {
  const res = await axios.post(`${BASE_URL}/payments/${paymentId}/refund`,
    { amount: amountHalala }, { auth });
  return res.data;
};

// ── التحقق من webhook signature ───────────────────
const verifyWebhook = (payload, signature) => {
  const crypto = require('crypto');
  const secret = process.env.MOYASAR_WEBHOOK_SECRET;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return computed === signature;
};

module.exports = { createPayment, getPayment, refundPayment, verifyWebhook };
