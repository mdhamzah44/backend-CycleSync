const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id });
    res.json({ reminders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const reminder = new Reminder({ userId: req.user._id, ...req.body });
    await reminder.save();
    res.status(201).json({ reminder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body, { new: true }
    );
    res.json({ reminder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
