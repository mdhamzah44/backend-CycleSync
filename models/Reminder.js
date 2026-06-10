const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['period', 'ovulation', 'fertility', 'medication', 'birth_control',
           'water', 'exercise', 'sleep', 'appointment', 'custom'],
    required: true,
  },
  title: { type: String, required: true },
  message: String,
  time: String, // "HH:MM"
  daysBeforeEvent: Number, // for period/ovulation reminders
  repeatDays: [Number], // 0=Sun, 1=Mon...
  isActive: { type: Boolean, default: true },
  lastTriggered: Date,
  nextTrigger: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Reminder', reminderSchema);
