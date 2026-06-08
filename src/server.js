require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const compression = require('compression');
const morgan  = require('morgan');

const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & Middleware ──────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5500',
      'http://127.0.0.1:5500',
    ];
    const allowedPatterns = [
      /\.netlify\.app$/,
      /thevalvehubs\.com$/,
    ];
    // Allow requests with no origin (server-to-server, mobile, Postman)
    // or null origin (local file:// protocol during development)
    if (!origin || origin === 'null') return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    if (allowedPatterns.some(p => p.test(origin))) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ───────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status:  'ok',
    platform: 'TheValveHubs API',
    version: '1.0.0',
    env:     process.env.NODE_ENV,
    time:    new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
// app.use('/api/companies',     require('./routes/company.routes'));
app.use('/api/suppliers',     require('./routes/supplier.routes'));
app.use('/api',               require('./routes/subscription.routes'));
app.use('/api/payments',      require('./routes/payment.routes'));
app.use('/api/rfqs',          require('./routes/rfq.routes'));
// app.use('/api/emergency',     require('./routes/emergency.routes'));
// app.use('/api/projects',      require('./routes/project.routes'));
app.use('/api/iktva',         require('./routes/iktva.routes'));
app.use('/api/admin',         require('./routes/admin.routes'));
app.use('/api/invoices',      require('./routes/invoice.routes'));
app.use('/api/experts',       require('./routes/expert.routes'));
app.use('/api/leads',         require('./routes/leads.routes'));

// ── 404 Handler ────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ───────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   TheValveHubs API — Running 🚀     ║
  ║   http://localhost:${PORT}               ║
  ║   Environment: ${process.env.NODE_ENV}          ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
