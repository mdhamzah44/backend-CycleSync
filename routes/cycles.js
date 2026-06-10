const express = require('express');
const router = express.Router();
const Cycle = require('../models/Cycle');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { predictNextCycle, calculateRegularityScore, getCalendarMarkers } = require('../utils/cyclePredictor');

// Get all cycles
router.get('/', auth, async (req, res) => {
  try {
    const cycles = await Cycle.find({ userId: req.user._id }).sort({ startDate: -1 });
    const user = req.user;
    const predictions = predictNextCycle(cycles, user.profile?.averageCycleLength, user.profile?.averagePeriodLength);
    res.json({ cycles, predictions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log period start
router.post('/start', auth, async (req, res) => {
  try {
    const { startDate, flow, notes } = req.body;

    // Check for existing open cycle
    const openCycle = await Cycle.findOne({ userId: req.user._id, endDate: null });
    if (openCycle && !openCycle.endDate) {
      // Auto-close previous cycle
      openCycle.endDate = new Date(startDate);
      await openCycle.save();
    }

    const cycle = new Cycle({
      userId: req.user._id,
      startDate: new Date(startDate),
      flow: flow || 'medium',
      notes,
    });

    // Calculate predictions
    const allCycles = await Cycle.find({ userId: req.user._id });
    const predictions = predictNextCycle([...allCycles, cycle], req.user.profile?.averageCycleLength);
    if (predictions) cycle.predictions = predictions;

    await cycle.save();

    // Update user's last period date
    await User.findByIdAndUpdate(req.user._id, { 'profile.lastPeriodDate': new Date(startDate) });

    res.status(201).json({ cycle, predictions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log period end
router.put('/:id/end', auth, async (req, res) => {
  try {
    const { endDate } = req.body;
    const cycle = await Cycle.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

    cycle.endDate = new Date(endDate);
    await cycle.save();

    res.json({ cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update cycle
router.put('/:id', auth, async (req, res) => {
  try {
    const cycle = await Cycle.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    res.json({ cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete cycle
router.delete('/:id', auth, async (req, res) => {
  try {
    await Cycle.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log intercourse
router.post('/:id/intercourse', auth, async (req, res) => {
  try {
    const cycle = await Cycle.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    cycle.intercourse.push(req.body);
    await cycle.save();
    res.json({ cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log BBT
router.post('/:id/bbt', auth, async (req, res) => {
  try {
    const cycle = await Cycle.findOne({ _id: req.params.id, userId: req.user._id });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    cycle.bbt.push(req.body);
    await cycle.save();
    res.json({ cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get calendar markers
router.get('/calendar-markers', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const cycles = await Cycle.find({ userId: req.user._id });
    const predictions = predictNextCycle(cycles, req.user.profile?.averageCycleLength, req.user.profile?.averagePeriodLength);
    const markers = getCalendarMarkers(cycles, predictions, startDate, endDate);
    res.json({ markers, predictions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get predictions
router.get('/predictions', auth, async (req, res) => {
  try {
    const cycles = await Cycle.find({ userId: req.user._id }).sort({ startDate: -1 });
    const predictions = predictNextCycle(cycles, req.user.profile?.averageCycleLength, req.user.profile?.averagePeriodLength);
    const regularityScore = calculateRegularityScore(cycles);
    res.json({ predictions, regularityScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
