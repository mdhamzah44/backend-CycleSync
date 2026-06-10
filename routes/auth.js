const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: 'All fields required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    // Generate unique partner code
    const partnerCode = Math.random().toString(36).substr(2, 8).toUpperCase();

    const user = new User({ email, password, name, partnerCode });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name, profile: user.profile, settings: user.settings, partnerCode },
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
  res.json({ user: req.user });
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
