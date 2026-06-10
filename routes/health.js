const express = require('express');
const router = express.Router();
const HealthLog = require('../models/HealthLog');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, limit = 30 } = req.query;
    const query = { userId: req.user._id };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    const logs = await HealthLog.find(query).sort({ date: -1 }).limit(parseInt(limit));
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const log = await HealthLog.findOne({ userId: req.user._id, date: { $gte: today, $lt: tomorrow } });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { date, ...data } = req.body;
    const logDate = new Date(date || new Date());
    logDate.setHours(0, 0, 0, 0);

    let log = await HealthLog.findOne({
      userId: req.user._id,
      date: { $gte: logDate, $lt: new Date(logDate.getTime() + 86400000) },
    });

    if (log) {
      Object.assign(log, data);
    } else {
      log = new HealthLog({ userId: req.user._id, date: logDate, ...data });
    }

    await log.save();
    res.status(201).json({ log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const log = await HealthLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    res.json({ log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health insights
router.get('/stats', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const logs = await HealthLog.find({
      userId: req.user._id,
      date: { $gte: startDate },
    });

    const stats = {
      avgWeight: null,
      avgSleepHours: null,
      avgWaterIntake: null,
      totalExerciseDays: 0,
      avgHeartRate: null,
    };

    const weights = logs.filter(l => l.weight).map(l => l.weight);
    const sleepHours = logs.filter(l => l.sleep?.hours).map(l => l.sleep.hours);
    const water = logs.filter(l => l.waterIntake).map(l => l.waterIntake);
    const heartRates = logs.filter(l => l.vitals?.heartRate).map(l => l.vitals.heartRate);

    if (weights.length) stats.avgWeight = Math.round((weights.reduce((a, b) => a + b) / weights.length) * 10) / 10;
    if (sleepHours.length) stats.avgSleepHours = Math.round((sleepHours.reduce((a, b) => a + b) / sleepHours.length) * 10) / 10;
    if (water.length) stats.avgWaterIntake = Math.round(water.reduce((a, b) => a + b) / water.length);
    if (heartRates.length) stats.avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b) / heartRates.length);
    stats.totalExerciseDays = logs.filter(l => l.exercise?.type).length;

    res.json({ stats, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
