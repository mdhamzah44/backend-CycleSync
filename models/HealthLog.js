const mongoose = require('mongoose');

const healthSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  weight: Number, // kg
  waterIntake: Number, // ml
  sleep: {
    hours: Number,
    quality: { type: Number, min: 1, max: 5 },
    bedtime: String,
    wakeTime: String,
  },
  exercise: {
    type: String, // yoga, running, gym, etc.
    duration: Number, // minutes
    intensity: { type: Number, min: 1, max: 5 },
  },
  vitals: {
    heartRate: Number,
    bloodPressureSystolic: Number,
    bloodPressureDiastolic: Number,
    bodyTemperature: Number, // celsius
  },
  medications: [{
    name: String,
    dose: String,
    taken: Boolean,
    time: String,
  }],
  supplements: [{
    name: String,
    dose: String,
    taken: Boolean,
  }],
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

healthSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('HealthLog', healthSchema);
