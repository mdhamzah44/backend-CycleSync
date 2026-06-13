const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  res.json({ user: req.user });
});

router.put('/', auth, async (req, res) => {
  try {
    const { name, profile, settings } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (profile) updates.profile = { ...req.user.profile?.toObject?.() || {}, ...profile };
    if (settings) updates.settings = { ...req.user.settings?.toObject?.() || {}, ...settings };

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export data
router.get('/export', auth, async (req, res) => {
  try {
    const Cycle = require('../models/Cycle');
    const Symptom = require('../models/Symptom');
    const HealthLog = require('../models/HealthLog');

    const [cycles, symptoms, health] = await Promise.all([
      Cycle.find({ userId: req.user._id }),
      Symptom.find({ userId: req.user._id }),
      HealthLog.find({ userId: req.user._id }),
    ]);

    res.json({
      exportDate: new Date(),
      user: { name: req.user.name, email: req.user.email, profile: req.user.profile },
      cycles, symptoms, health,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete account data
router.delete('/data', auth, async (req, res) => {
  try {
    const Cycle = require('../models/Cycle');
    const Symptom = require('../models/Symptom');
    const HealthLog = require('../models/HealthLog');

    await Promise.all([
      Cycle.deleteMany({ userId: req.user._id }),
      Symptom.deleteMany({ userId: req.user._id }),
      HealthLog.deleteMany({ userId: req.user._id }),
    ]);

    res.json({ success: true, message: 'All data deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
