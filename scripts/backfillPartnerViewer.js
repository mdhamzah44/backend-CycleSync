/**
 * One-time migration: backfill `isPartnerViewer` for existing users.
 *
 * Existing documents created before `isPartnerViewer` was added to the
 * schema won't have the field at all (Mongoose schema defaults only apply
 * to newly created documents). This script sets it to `false` for any
 * user where the field is missing, so the AppNavigator's
 * `isViewer = !!(user.isPartnerViewer && user.partnerId)` check behaves
 * correctly instead of treating `undefined` as falsy-but-ambiguous.
 *
 * Run with:  node backend/scripts/backfillPartnerViewer.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cyclesync');
  console.log('Connected to MongoDB');

  const result = await User.updateMany(
    { isPartnerViewer: { $exists: false } },
    { $set: { isPartnerViewer: false } }
  );

  console.log(`Backfilled ${result.modifiedCount} user(s) with isPartnerViewer: false`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
