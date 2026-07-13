const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Cycle = require('../models/Cycle');
const Symptom = require('../models/Symptom');
const auth = require('../middleware/auth');
const { predictNextCycle, calculateRegularityScore, getCalendarMarkers } = require('../utils/cyclePredictor');

// ── Connect with partner using partner code ─────────────────────────────────
router.post('/connect', auth, async (req, res) => {
  try {
    const { partnerCode } = req.body;
    const partner = await User.findOne({ partnerCode });
    if (!partner) return res.status(404).json({ error: 'Partner code not found' });
    if (partner._id.toString() === req.user._id.toString())
      return res.status(400).json({ error: 'Cannot connect with yourself' });

    await User.findByIdAndUpdate(req.user._id, { partnerId: partner._id, isPartnerViewer: true });
    await User.findByIdAndUpdate(partner._id, {
      partnerId: req.user._id,
      isPartnerViewer: false, // they are the tracker, not the viewer
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

// ── Disconnect partner ──────────────────────────────────────────────────────
router.post('/disconnect', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.partnerId) {
      await User.findByIdAndUpdate(user.partnerId, {
        partnerId: null,
        isPartnerViewer: false,
        pendingPartnerRequest: null,
      });
    }
    await User.findByIdAndUpdate(req.user._id, {
      partnerId: null,
      isPartnerViewer: false,
      pendingPartnerRequest: null,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Confirm partner request ─────────────────────────────────────────────────
router.post('/confirm', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pendingPartnerRequest: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dismiss notification ────────────────────────────────────────────────────
router.post('/dismiss', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pendingPartnerRequest: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Basic partner data (used in Profile) ───────────────────────────────────
router.get('/data', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.partnerId) return res.status(404).json({ error: 'No partner connected' });

    const partner = await User.findById(user.partnerId)
      .select('name partnerCode profile pregnancyMode');
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

// ── Full home data for partner-viewer ──────────────────────────────────────
// Returns everything the partner-viewer needs for their home screen
router.get('/home-data', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.partnerId) return res.status(404).json({ error: 'No partner connected' });

    const partner = await User.findById(user.partnerId)
      .select('name profile pregnancyMode pregnancyDueDate');
    if (!partner) return res.status(404).json({ error: 'Partner not found' });

    const cycles = await Cycle.find({ userId: user.partnerId }).sort({ startDate: -1 });
    const predictions = predictNextCycle(cycles, partner.profile?.averageCycleLength, partner.profile?.averagePeriodLength);
    const regularityScore = calculateRegularityScore(cycles);
    const calendarMarkers = getCalendarMarkers(cycles, predictions);

    // Recent symptoms (last 7 days — only show mood & energy, not detailed symptoms)
    const recentSymptoms = await Symptom.find({ userId: user.partnerId })
      .sort({ date: -1 }).limit(7)
      .select('date mood moodScore energyLevel stressLevel');

    // Cycle stats
    const periodLengths = cycles.filter(c => c.periodLength).map(c => c.periodLength);
    const avgPeriodLength = periodLengths.length
      ? Math.round(periodLengths.reduce((a, b) => a + b) / periodLengths.length)
      : partner.profile?.averagePeriodLength || 5;

    res.json({
      partnerName: partner.name,
      pregnancyMode: partner.pregnancyMode,
      pregnancyDueDate: partner.pregnancyDueDate,
      predictions: predictions ? {
        nextPeriodDate: predictions.nextPeriodDate,
        currentCycleDay: predictions.currentCycleDay,
        daysUntilNextPeriod: predictions.daysUntilNextPeriod,
        fertileWindowStart: predictions.fertileWindowStart,
        fertileWindowEnd: predictions.fertileWindowEnd,
        ovulationDate: predictions.ovulationDate,
        averageCycleLength: predictions.averageCycleLength,
        fertilityScore: predictions.fertilityScore,
      } : null,
      cycleSummary: {
        totalCycles: cycles.length,
        avgCycleLength: predictions?.averageCycleLength || null,
        avgPeriodLength,
        regularityScore,
        currentCycleDay: predictions?.currentCycleDay || null,
      },
      calendarMarkers,
      recentMood: recentSymptoms.map(s => ({
        date: s.date,
        mood: s.mood,
        moodScore: s.moodScore,
        energyLevel: s.energyLevel,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
