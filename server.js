require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const cycleRoutes = require('./routes/cycles');
const symptomRoutes = require('./routes/symptoms');
const healthRoutes = require('./routes/health');
const aiRoutes = require('./routes/ai');
const profileRoutes = require('./routes/profile');
const analyticsRoutes = require('./routes/analytics');
const remindersRoutes = require('./routes/reminders');
const pregnancyRoutes = require('./routes/pregnancy');
const partnerRoutes = require('./routes/partner');

const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────
// Explicit origins so Railway's HTTP→HTTPS redirect never hits a preflight.
// Add your deployed web origin (e.g. Vercel/Netlify URL) to ALLOWED_ORIGINS.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Always allow localhost dev origins
const DEV_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (native apps, curl, Postman)
    if (!origin) return callback(null, true);
    const allowed = [...DEV_ORIGINS, ...ALLOWED_ORIGINS];
    if (allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200, // 204 breaks some browsers
}));

// Force HTTPS redirect on Railway (before any routes)
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use(express.json());

// DB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cyclesync')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Ensure models are registered
require('./models/ChatSession');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cycles', cycleRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/pregnancy', pregnancyRoutes);
app.use('/api/partner', partnerRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', message: 'CycleSync API running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 CycleSync server running on port ${PORT}`));

module.exports = app;