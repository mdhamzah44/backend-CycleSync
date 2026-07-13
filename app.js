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
// Explicit origins so proxy HTTP→HTTPS redirects never hit a preflight.
// Add your deployed frontend origin(s) to ALLOWED_ORIGINS (e.g. your Netlify
// site URL, a custom domain, etc).
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

// Force HTTPS redirect when running behind a proxy that sets
// x-forwarded-proto (Railway, Render, etc). Netlify already terminates TLS
// before invoking the function, so this simply never triggers there.
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

// Netlify invokes this app via netlify/functions/api.js, and the request
// path arrives prefixed with the function path (either
// "/.netlify/functions/api/..." directly, or "/api/..." rewritten to that
// by the redirect in netlify.toml). Normalize both back to "/api/...", so
// the route mounts below ("/api/auth", "/api/cycles", ...) keep working
// unchanged, both locally and on Netlify.
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api') || '/api';
  }
  next();
});

app.use(express.json());

// ── DB connection (cached across warm serverless invocations) ─────────────
let dbConnectionPromise = null;
async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (dbConnectionPromise) return dbConnectionPromise;

  dbConnectionPromise = mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cyclesync', {
      bufferCommands: true,
      serverSelectionTimeoutMS: 8000,
    })
    .then(conn => {
      console.log('✅ MongoDB connected');
      return conn;
    })
    .catch(err => {
      console.error('❌ MongoDB error:', err);
      dbConnectionPromise = null; // allow retry on next invocation
      throw err;
    });

  return dbConnectionPromise;
}

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

app.get('/api/health-check', (req, res) => res.json({ status: 'ok', message: 'CycleSync API running' }));
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'CycleSync API running' }));

module.exports = { app, connectDB };
