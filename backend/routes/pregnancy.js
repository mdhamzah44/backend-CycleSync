const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { addDays, differenceInWeeks, differenceInDays } = require('date-fns');

const WEEKLY_UPDATES = {
  4: { size: 'poppy seed', development: 'The embryo is forming, and the neural tube — which becomes the brain and spinal cord — is developing.' },
  5: { size: 'sesame seed', development: 'The heart begins to beat. Tiny buds that will become arms and legs are forming.' },
  6: { size: 'lentil', development: 'The brain and other organs are developing rapidly. Facial features begin to form.' },
  7: { size: 'blueberry', development: 'The embryo has doubled in size. Hands and feet are forming, though fingers are still fused.' },
  8: { size: 'raspberry', development: 'All major organs are forming. The baby is officially called a fetus.' },
  9: { size: 'grape', development: 'Tiny earlobes, mouth, nose, and nostrils are more distinct.' },
  10: { size: 'kumquat', development: 'Bones are forming and vital organs are fully developed and starting to function.' },
  12: { size: 'lime', development: 'The fetus can open and close fingers, and reflexes are developing.' },
  16: { size: 'avocado', development: 'The baby can make sucking motions. Eyebrows and eyelashes are forming.' },
  20: { size: 'banana', development: 'You can feel movement! The baby can swallow and produce urine.' },
  24: { size: 'ear of corn', development: 'The baby\'s face is fully formed. Footprints and fingerprints are forming.' },
  28: { size: 'eggplant', development: 'The baby can open eyes and see light. Brain tissue is developing rapidly.' },
  32: { size: 'squash', development: 'Practicing breathing. Most major development is complete.' },
  36: { size: 'honeydew melon', development: 'The baby is gaining weight rapidly and is almost ready.' },
  40: { size: 'watermelon', development: 'Full term! Your baby is ready to meet you.' },
};

function getWeeklyUpdate(week) {
  const weeks = Object.keys(WEEKLY_UPDATES).map(Number).sort((a, b) => a - b);
  let closest = weeks[0];
  for (const w of weeks) {
    if (w <= week) closest = w;
  }
  return WEEKLY_UPDATES[closest] || { size: 'unknown', development: 'Continue taking care of yourself!' };
}

router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.pregnancyMode || !user.pregnancyDueDate) {
      return res.json({ pregnancyMode: false });
    }

    const dueDate = new Date(user.pregnancyDueDate);
    const today = new Date();
    const conceptionDate = addDays(dueDate, -280);
    const weeksPregnant = Math.max(0, differenceInWeeks(today, conceptionDate));
    const daysPregnant = Math.max(0, differenceInDays(today, conceptionDate));
    const trimester = weeksPregnant < 14 ? 1 : weeksPregnant < 28 ? 2 : 3;
    const daysUntilDue = Math.max(0, differenceInDays(dueDate, today));

    const update = getWeeklyUpdate(weeksPregnant);

    res.json({
      pregnancyMode: true,
      dueDate,
      weeksPregnant,
      daysPregnant,
      trimester,
      daysUntilDue,
      weeklyUpdate: { ...update, week: weeksPregnant },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/enable', auth, async (req, res) => {
  try {
    const { dueDate, lastPeriodDate } = req.body;
    let calculatedDueDate = dueDate;
    if (!calculatedDueDate && lastPeriodDate) {
      calculatedDueDate = addDays(new Date(lastPeriodDate), 280);
    }
    await User.findByIdAndUpdate(req.user._id, {
      pregnancyMode: true,
      pregnancyDueDate: calculatedDueDate,
    });
    res.json({ success: true, dueDate: calculatedDueDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disable', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pregnancyMode: false, pregnancyDueDate: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
