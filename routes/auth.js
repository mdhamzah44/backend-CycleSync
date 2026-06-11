const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Cycle = require('../models/Cycle');
const auth = require('../middleware/auth');
const { predictNextCycle } = require('../utils/cyclePredictor');

// Verify a partner code before registration (no auth needed)
router.post('/verify-partner-code', async (req, res) => {
  try {
    const { partnerCode } = req.body;
    if (!partnerCode) return res.status(400).json({ error: 'Code required' });

    const partner = await User.findOne({ partnerCode: partnerCode.trim().toUpperCase() });
    if (!partner) return res.status(404).json({ error: 'Partner code not found' });

    // Fetch partner's shareable cycle data
    const cycles = await Cycle.find({ userId: partner._id }).sort({ startDate: -1 }).limit(3);
    const predictions = predictNextCycle(cycles, partner.profile?.averageCycleLength, partner.profile?.averagePeriodLength);

    res.json({
      valid: true,
      partner: {
        name: partner.name,
        partnerCode: partner.partnerCode,
        goal: partner.profile?.goals || 'tracking',
        pregnancyMode: partner.pregnancyMode,
        predictions: predictions ? {
          nextPeriodDate: predictions.nextPeriodDate,
          currentCycleDay: predictions.currentCycleDay,
          daysUntilNextPeriod: predictions.daysUntilNextPeriod,
          fertileWindowStart: predictions.fertileWindowStart,
          fertileWindowEnd: predictions.fertileWindowEnd,
          ovulationDate: predictions.ovulationDate,
          averageCycleLength: predictions.averageCycleLength,
        } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, goal, partnerCode } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: 'All fields required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    // Generate unique partner code for the new user
    const newPartnerCode = Math.random().toString(36).substr(2, 8).toUpperCase();

    // If a partnerCode was provided, look up that partner
    let partnerId = null;
    if (partnerCode) {
      const partnerUser = await User.findOne({ partnerCode: partnerCode.trim().toUpperCase() });
      if (partnerUser) {
        partnerId = partnerUser._id;
        // Also link partner back to this new user (set after save below)
      }
    }

    const user = new User({
      email,
      password,
      name,
      partnerCode: newPartnerCode,
      partnerId,
      'profile.goals': goal || 'tracking',
    });
    await user.save();

    // Link partner → new user bidirectionally
    if (partnerId) {
      await User.findByIdAndUpdate(partnerId, { partnerId: user._id });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    // Fetch partner info to return in response
    let partnerInfo = null;
    if (partnerId) {
      const partner = await User.findById(partnerId).select('name partnerCode profile pregnancyMode');
      const cycles = await Cycle.find({ userId: partnerId }).sort({ startDate: -1 }).limit(3);
      const predictions = predictNextCycle(cycles, partner.profile?.averageCycleLength, partner.profile?.averagePeriodLength);
      partnerInfo = {
        name: partner.name,
        partnerCode: partner.partnerCode,
        predictions: predictions ? {
          nextPeriodDate: predictions.nextPeriodDate,
          currentCycleDay: predictions.currentCycleDay,
          daysUntilNextPeriod: predictions.daysUntilNextPeriod,
          fertileWindowStart: predictions.fertileWindowStart,
          fertileWindowEnd: predictions.fertileWindowEnd,
          ovulationDate: predictions.ovulationDate,
          averageCycleLength: predictions.averageCycleLength,
        } : null,
        pregnancyMode: partner.pregnancyMode,
      };
    }

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profile: user.profile,
        settings: user.settings,
        partnerCode: newPartnerCode,
        partnerId: partnerId,
      },
      partnerInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    res.json({
      token,
      user: {
        id: user._id, email: user.email, name: user.name,
        profile: user.profile, settings: user.settings,
        premium: user.premium, partnerCode: user.partnerCode,
        pregnancyMode: user.pregnancyMode,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ user });
});

// Verify PIN
router.post('/verify-pin', auth, async (req, res) => {
  try {
    const { pin } = req.body;
    const bcrypt = require('bcryptjs');
    const user = await User.findById(req.user._id);
    const valid = await bcrypt.compare(pin, user.settings.pinHash || '');
    res.json({ valid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set PIN
router.post('/set-pin', auth, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { pin } = req.body;
    const hash = await bcrypt.hash(pin, 10);
    await User.findByIdAndUpdate(req.user._id, {
      'settings.pinEnabled': true,
      'settings.pinHash': hash,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
