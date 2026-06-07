const nodemailer = require('nodemailer');

// ── Transporter ───────────────────────────────────
function getTransporter() {
  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Dev: log emails to console
  return {
    sendMail: async (opts) => {
      console.log('\n📧 [EMAIL - DEV MODE]');
      console.log('  To:', opts.to);
      console.log('  Subject:', opts.subject);
      console.log('  ---');
      return { messageId: `dev-${Date.now()}` };
    }
  };
}

const FROM = process.env.FROM_EMAIL || 'TheValveHubs <noreply@thevalvehubs.com>';

// ── Welcome Email ─────────────────────────────────
async function sendWelcomeEmail({ email, nameEn, role, companyName }) {
  const transporter = getTransporter();
  const isSupplier = role === 'SUPPLIER';
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Welcome to TheValveHubs — Saudi Arabia's Valve Marketplace`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4F7F4;margin:0;padding:0;}
.wrap{max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;}
.header{background:linear-gradient(135deg,#006C35,#00843F);padding:40px;text-align:center;color:#fff;}
.header h1{font-size:1.6rem;font-weight:900;margin:0;}
.header p{opacity:.85;margin:8px 0 0;font-size:.9rem;}
.body{padding:36px;}
.body h2{font-size:1.1rem;font-weight:800;color:#1A2A1A;}
.body p{color:#5A6B62;line-height:1.7;font-size:.9rem;}
.btn{display:inline-block;background:#006C35;color:#fff;padding:13px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin:16px 0;}
.steps{background:#F4F7F4;border-radius:10px;padding:20px;margin:16px 0;}
.step{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #E0EAE0;font-size:.85rem;}
.step:last-child{border-bottom:none;}
.step-num{background:#006C35;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.75rem;flex-shrink:0;}
.footer{background:#1A2620;color:rgba(255,255,255,.6);text-align:center;padding:20px;font-size:.78rem;}
</style></head>
<body>
<div style="padding:24px;">
<div class="wrap">
  <div class="header">
    <div style="font-size:2rem;margin-bottom:8px;">🏭</div>
    <h1>Welcome to TheValveHubs!</h1>
    <p>Saudi Arabia's Engineering-Governed Industrial Valve Marketplace</p>
  </div>
  <div class="body">
    <h2>مرحباً ${nameEn || email.split('@')[0]}! 👋</h2>
    <p>Your <strong>${companyName || 'company'}</strong> account has been created as a <strong>${isSupplier ? 'Supplier' : 'Buyer'}</strong>.</p>
    ${isSupplier ? `
    <div class="steps">
      <div style="font-size:.78rem;font-weight:800;color:#006C35;margin-bottom:8px;letter-spacing:.06em;text-transform:uppercase;">Your Next Steps as a Supplier</div>
      <div class="step"><div class="step-num">1</div><div>Complete your <strong>company profile</strong> with CR number, VAT, and service pillars</div></div>
      <div class="step"><div class="step-num">2</div><div>Calculate your <strong>IKTVA score</strong> to unlock Aramco-preferred badge</div></div>
      <div class="step"><div class="step-num">3</div><div>Browse and respond to <strong>RFQs</strong> matching your capabilities</div></div>
      <div class="step"><div class="step-num">4</div><div>Upload <strong>certifications</strong> (ISO 9001, API 6D, Saudi Aramco)</div></div>
    </div>
    ` : `
    <div class="steps">
      <div style="font-size:.78rem;font-weight:800;color:#C8973A;margin-bottom:8px;letter-spacing:.06em;text-transform:uppercase;">Your Next Steps as a Buyer</div>
      <div class="step"><div class="step-num">1</div><div>Submit your first <strong>Request for Quotation (RFQ)</strong></div></div>
      <div class="step"><div class="step-num">2</div><div>Browse <strong>verified Saudi suppliers</strong> by service pillar</div></div>
      <div class="step"><div class="step-num">3</div><div>Use the <strong>IKTVA Calculator</strong> to track Vision 2030 compliance</div></div>
      <div class="step"><div class="step-num">4</div><div>Set up <strong>Emergency RFQ</strong> for 24/7 procurement support</div></div>
    </div>
    `}
    <div style="text-align:center;">
      <a href="https://thevalvehubs.netlify.app/dashboard.html" class="btn">🚀 Go to My Dashboard</a>
    </div>
    <p style="font-size:.8rem;color:#9A9A9A;margin-top:16px;">Questions? Reply to this email or contact us at <a href="mailto:info@thevalvehubs.com" style="color:#006C35;">info@thevalvehubs.com</a></p>
  </div>
  <div class="footer">
    &copy; 2026 TheValveHubs — Khobar, Saudi Arabia &bull; Vision 2030 Aligned<br/>
    <a href="https://thevalvehubs.netlify.app" style="color:#C8973A;">thevalvehubs.com</a>
  </div>
</div>
</div>
</body>
</html>`,
  });
}

// ── RFQ Alert Email ───────────────────────────────
async function sendRfqAlert({ email, nameEn, rfqTitle, rfqPillar, rfqRegion, rfqId }) {
  const transporter = getTransporter();
  const pillars = ['','Flow Control Valves','Actuation Systems','Safety & Relief','Industrial Services','Instrumentation','Maintenance & Repair'];
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `🔔 New RFQ Match: ${rfqTitle} — TheValveHubs`,
    html: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4F7F4;margin:0;padding:24px;}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;}
.header{background:linear-gradient(135deg,#1A3A6B,#2C4A7C);padding:32px;text-align:center;color:#fff;}
.body{padding:32px;}
.rfq-box{background:#EBF7F0;border:1.5px solid #006C35;border-radius:10px;padding:20px;margin:16px 0;}
.btn{display:inline-block;background:#006C35;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none;}
.footer{background:#1A2620;color:rgba(255,255,255,.6);text-align:center;padding:16px;font-size:.75rem;}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <div style="font-size:1.8rem;margin-bottom:8px;">📋</div>
    <h2 style="margin:0;font-size:1.2rem;">New RFQ Matching Your Profile</h2>
    <p style="margin:6px 0 0;opacity:.8;font-size:.85rem;">TheValveHubs — Saudi Arabia's Valve Marketplace</p>
  </div>
  <div class="body">
    <p style="color:#5A6B62;">Hello <strong>${nameEn}</strong>,</p>
    <p style="color:#5A6B62;font-size:.9rem;">A new Request for Quotation matching your service profile has been posted:</p>
    <div class="rfq-box">
      <div style="font-size:.75rem;font-weight:800;color:#006C35;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">RFQ Details</div>
      <div style="font-weight:800;font-size:1rem;color:#1A2A1A;margin-bottom:8px;">${rfqTitle}</div>
      <div style="font-size:.85rem;color:#5A6B62;">📌 Pillar: ${pillars[rfqPillar] || rfqPillar}</div>
      <div style="font-size:.85rem;color:#5A6B62;">📍 Region: ${rfqRegion || 'All Saudi Arabia'}</div>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <a href="https://thevalvehubs.netlify.app/dashboard.html" class="btn">📋 View & Respond to RFQ</a>
    </div>
    <p style="font-size:.78rem;color:#9A9A9A;margin-top:16px;text-align:center;">Respond before competitors. First 3 responses get priority placement.</p>
  </div>
  <div class="footer">&copy; 2026 TheValveHubs &bull; <a href="https://thevalvehubs.netlify.app" style="color:#C8973A;">thevalvehubs.com</a></div>
</div>
</body></html>`,
  });
}

// ── Verification Email ────────────────────────────
async function sendVerificationEmail({ email, nameEn, companyName }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `✅ Your supplier profile has been verified — TheValveHubs`,
    html: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,sans-serif;background:#F4F7F4;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#006C35,#00843F);padding:32px;text-align:center;color:#fff;">
    <div style="font-size:3rem;">✅</div>
    <h2 style="margin:8px 0 0;">Supplier Verified!</h2>
  </div>
  <div style="padding:32px;">
    <p style="color:#5A6B62;">Congratulations <strong>${nameEn}</strong>!</p>
    <p style="color:#5A6B62;font-size:.9rem;"><strong>${companyName}</strong> has been verified on TheValveHubs. You now have the ✅ Verified Supplier badge and will appear higher in search results.</p>
    <div style="background:#EBF7F0;border-radius:10px;padding:16px;margin:16px 0;">
      <div style="font-weight:700;color:#006C35;margin-bottom:6px;">What's unlocked:</div>
      <div style="font-size:.85rem;color:#5A6B62;">✅ Verified badge on your profile<br/>✅ Priority placement in RFQ matching<br/>✅ Aramco-preferred eligibility (if IKTVA ≥ 60%)<br/>✅ Buyer trust indicator</div>
    </div>
    <div style="text-align:center;"><a href="https://thevalvehubs.netlify.app/dashboard.html" style="display:inline-block;background:#006C35;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none;">View My Profile</a></div>
  </div>
  <div style="background:#1A2620;color:rgba(255,255,255,.6);text-align:center;padding:16px;font-size:.75rem;">&copy; 2026 TheValveHubs</div>
</div>
</body></html>`,
  });
}

module.exports = { sendWelcomeEmail, sendRfqAlert, sendVerificationEmail };
