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

// Middleware
app.use(cors());
app.use(express.json());

// DB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cyclesync')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

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
