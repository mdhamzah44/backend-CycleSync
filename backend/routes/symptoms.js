const express = require('express');
const router = express.Router();
const Symptom = require('../models/Symptom');
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
    const symptoms = await Symptom.find(query).sort({ date: -1 }).limit(parseInt(limit));
    res.json({ symptoms });
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
    const symptom = await Symptom.findOne({ userId: req.user._id, date: { $gte: today, $lt: tomorrow } });
    res.json({ symptom });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { date, symptoms, mood, moodScore, energyLevel, stressLevel, notes } = req.body;
    const logDate = new Date(date || new Date());
    logDate.setHours(0, 0, 0, 0);

    let symptomLog = await Symptom.findOne({
      userId: req.user._id,
      date: { $gte: logDate, $lt: new Date(logDate.getTime() + 86400000) },
    });

    if (symptomLog) {
      Object.assign(symptomLog, { symptoms, mood, moodScore, energyLevel, stressLevel, notes });
    } else {
      symptomLog = new Symptom({ userId: req.user._id, date: logDate, symptoms, mood, moodScore, energyLevel, stressLevel, notes });
    }

    await symptomLog.save();
    res.status(201).json({ symptom: symptomLog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const symptom = await Symptom.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    res.json({ symptom });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get symptom trends
router.get('/trends', auth, async (req, res) => {
  try {
    const { months = 3 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const symptoms = await Symptom.find({
      userId: req.user._id,
      date: { $gte: startDate },
    }).sort({ date: 1 });

    // Aggregate symptom frequency
    const frequency = {};
    const moodTrend = [];
    symptoms.forEach(s => {
      s.symptoms?.forEach(sym => {
        frequency[sym.type] = (frequency[sym.type] || 0) + 1;
      });
      if (s.moodScore) {
        moodTrend.push({ date: s.date, score: s.moodScore });
      }
    });

    res.json({ frequency, moodTrend, totalDaysLogged: symptoms.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
