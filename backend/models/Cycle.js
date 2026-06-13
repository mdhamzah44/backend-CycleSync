const mongoose = require('mongoose');

const cycleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, required: true },
  endDate: Date,
  periodLength: Number,
  cycleLength: Number, // days from this start to next start
  flow: { type: String, enum: ['spotting', 'light', 'medium', 'heavy', 'very_heavy'], default: 'medium' },
  isPregnancy: { type: Boolean, default: false },
  notes: String,
  predictions: {
    nextPeriodDate: Date,
    ovulationDate: Date,
    fertileWindowStart: Date,
    fertileWindowEnd: Date,
    fertilityScore: { type: Number, min: 0, max: 100 },
  },
  intercourse: [{
    date: Date,
    protected: Boolean,
    contraceptionType: String,
    notes: String,
  }],
  bbt: [{ date: Date, temperature: Number }], // Basal Body Temperature
  cervicalMucus: [{
    date: Date,
    type: { type: String, enum: ['dry', 'sticky', 'creamy', 'watery', 'egg_white'] },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

cycleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (this.startDate && this.endDate) {
    this.periodLength = Math.round((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1;
  }
  next();
});

module.exports = mongoose.model('Cycle', cycleSchema);
