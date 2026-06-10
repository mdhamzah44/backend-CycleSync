const mongoose = require('mongoose');

const SYMPTOM_TYPES = [
  'cramps', 'headache', 'back_pain', 'breast_tenderness', 'acne',
  'bloating', 'fatigue', 'nausea', 'dizziness', 'hot_flashes',
  'mood_swings', 'anxiety', 'irritability', 'stress', 'depression',
  'insomnia', 'appetite_changes', 'spotting', 'discharge', 'custom'
];

const MOOD_TYPES = ['happy', 'calm', 'sad', 'anxious', 'irritable', 'tired', 'energetic', 'sensitive', 'confident'];

const symptomSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  symptoms: [{
    type: { type: String, enum: [...SYMPTOM_TYPES] },
    severity: { type: Number, min: 1, max: 5 },
    customName: String,
    notes: String,
  }],
  mood: { type: String, enum: MOOD_TYPES },
  moodScore: { type: Number, min: 1, max: 10 },
  energyLevel: { type: Number, min: 1, max: 5 },
  stressLevel: { type: Number, min: 1, max: 5 },
  notes: String,
  createdAt: { type: Date, default: Date.now },
});

symptomSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Symptom', symptomSchema);
