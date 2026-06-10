const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  profile: {
    dateOfBirth: Date,
    height: Number, // cm
    weight: Number, // kg
    goals: { type: String, enum: ['tracking', 'pregnancy_planning', 'pregnancy', 'contraception', 'health'], default: 'tracking' },
    medicalNotes: String,
    averageCycleLength: { type: Number, default: 28 },
    averagePeriodLength: { type: Number, default: 5 },
    lastPeriodDate: Date,
  },
  settings: {
    darkMode: { type: Boolean, default: false },
    themeColor: { type: String, default: '#E91E8C' },
    language: { type: String, default: 'en' },
    notifications: { type: Boolean, default: true },
    pinEnabled: { type: Boolean, default: false },
    pinHash: String,
    biometricEnabled: { type: Boolean, default: false },
    privateMode: { type: Boolean, default: false },
  },
  premium: { type: Boolean, default: false },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  partnerCode: { type: String, unique: true, sparse: true },
  pregnancyMode: { type: Boolean, default: false },
  pregnancyDueDate: Date,
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
