const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Cycle = require('../models/Cycle');
const auth = require('../middleware/auth');
const { predictNextCycle } = require('../utils/cyclePredictor');

// Connect with partner using partner code
router.post('/connect', auth, async (req, res) => {
  try {
    const { partnerCode } = req.body;
    const partner = await User.findOne({ partnerCode });
    if (!partner) return res.status(404).json({ error: 'Partner code not found' });
    if (partner._id.toString() === req.user._id.toString())
      return res.status(400).json({ error: 'Cannot connect with yourself' });

    // Link both users
    await User.findByIdAndUpdate(req.user._id, { partnerId: partner._id });
    // Set a pending notification on the partner's account
    await User.findByIdAndUpdate(partner._id, {
      partnerId: req.user._id,
      pendingPartnerRequest: {
        fromUserId: req.user._id,
        fromName: req.user.name,
        requestedAt: new Date(),
      },
    });

    res.json({ success: true, partnerName: partner.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect partner
router.post('/disconnect', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.partnerId) {
      await User.findByIdAndUpdate(user.partnerId, {
        partnerId: null,
        pendingPartnerRequest: null,
      });
    }
    await User.findByIdAndUpdate(req.user._id, {
      partnerId: null,
      pendingPartnerRequest: null,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm partner request (the recipient presses "Accept")
router.post('/confirm', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pendingPartnerRequest: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dismiss without disconnecting
router.post('/dismiss', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pendingPartnerRequest: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get partner's shared data (limited, non-sensitive)
router.get('/data', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.partnerId) return res.status(404).json({ error: 'No partner connected' });

    const partner = await User.findById(user.partnerId)
      .select('name partnerCode profile pregnancyMode pendingPartnerRequest');
    if (!partner) return res.status(404).json({ error: 'Partner not found' });

    const cycles = await Cycle.find({ userId: user.partnerId }).sort({ startDate: -1 }).limit(3);
    const predictions = predictNextCycle(cycles, partner.profile?.averageCycleLength);

    res.json({
      partnerName: partner.name,
      partnerCode: partner.partnerCode,
      predictions: predictions ? {
        nextPeriodDate: predictions.nextPeriodDate,
        currentCycleDay: predictions.currentCycleDay,
        fertileWindowStart: predictions.fertileWindowStart,
        fertileWindowEnd: predictions.fertileWindowEnd,
        ovulationDate: predictions.ovulationDate,
        daysUntilNextPeriod: predictions.daysUntilNextPeriod,
        averageCycleLength: predictions.averageCycleLength,
      } : null,
      pregnancyMode: partner.pregnancyMode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
