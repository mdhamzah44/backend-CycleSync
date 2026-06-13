const express = require('express');
const router = express.Router();
const Cycle = require('../models/Cycle');
const Symptom = require('../models/Symptom');
const HealthLog = require('../models/HealthLog');
const auth = require('../middleware/auth');
const { predictNextCycle, calculateRegularityScore } = require('../utils/cyclePredictor');

router.get('/overview', auth, async (req, res) => {
  try {
    const cycles = await Cycle.find({ userId: req.user._id }).sort({ startDate: -1 });
    const symptoms = await Symptom.find({ userId: req.user._id }).sort({ date: -1 }).limit(90);
    const healthLogs = await HealthLog.find({ userId: req.user._id }).sort({ date: -1 }).limit(30);

    const predictions = predictNextCycle(cycles, req.user.profile?.averageCycleLength, req.user.profile?.averagePeriodLength);
    const regularityScore = calculateRegularityScore(cycles);

    // Period lengths
    const periodLengths = cycles.filter(c => c.periodLength).map(c => c.periodLength);
    const avgPeriodLength = periodLengths.length
      ? Math.round(periodLengths.reduce((a, b) => a + b) / periodLengths.length * 10) / 10 : null;

    // Symptom frequency
    const symptomFreq = {};
    symptoms.forEach(s => s.symptoms?.forEach(sym => {
      symptomFreq[sym.type] = (symptomFreq[sym.type] || 0) + 1;
    }));
    const topSymptoms = Object.entries(symptomFreq)
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Mood trend
    const moodData = symptoms.filter(s => s.moodScore).slice(0, 30).map(s => ({
      date: s.date,
      score: s.moodScore,
    }));

    res.json({
      cycleSummary: {
        totalCycles: cycles.length,
        avgCycleLength: predictions?.averageCycleLength || null,
        avgPeriodLength,
        regularityScore,
        currentCycleDay: predictions?.currentCycleDay || null,
        daysUntilNextPeriod: predictions?.daysUntilNextPeriod || null,
      },
      topSymptoms,
      moodData,
      healthStats: {
        avgSleep: healthLogs.filter(l => l.sleep?.hours).length > 0
          ? (healthLogs.filter(l => l.sleep?.hours).reduce((a, l) => a + l.sleep.hours, 0) / healthLogs.filter(l => l.sleep?.hours).length).toFixed(1)
          : null,
        avgWater: healthLogs.filter(l => l.waterIntake).length > 0
          ? Math.round(healthLogs.filter(l => l.waterIntake).reduce((a, l) => a + l.waterIntake, 0) / healthLogs.filter(l => l.waterIntake).length)
          : null,
        exerciseDays: healthLogs.filter(l => l.exercise?.type).length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monthly report
router.get('/report/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const [cycles, symptoms, health] = await Promise.all([
      Cycle.find({ userId: req.user._id, startDate: { $gte: startDate, $lte: endDate } }),
      Symptom.find({ userId: req.user._id, date: { $gte: startDate, $lte: endDate } }),
      HealthLog.find({ userId: req.user._id, date: { $gte: startDate, $lte: endDate } }),
    ]);

    res.json({ month: parseInt(month), year: parseInt(year), cycles, symptoms, health });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
