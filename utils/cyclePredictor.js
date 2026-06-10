const { addDays, differenceInDays } = require('date-fns');

/**
 * Predict next cycle dates based on history
 */
function predictNextCycle(cycles, averageCycleLength = 28, averagePeriodLength = 5) {
  if (!cycles || cycles.length === 0) return null;

  // Sort cycles by start date descending
  const sorted = [...cycles].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const lastCycle = sorted[0];

  // Calculate average cycle length from history
  if (sorted.length >= 2) {
    let totalLength = 0;
    let count = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const len = differenceInDays(new Date(sorted[i].startDate), new Date(sorted[i + 1].startDate));
      if (len > 0 && len < 60) { totalLength += len; count++; }
    }
    if (count > 0) averageCycleLength = Math.round(totalLength / count);
  }

  if (sorted.length >= 2) {
    const periodLengths = sorted.filter(c => c.periodLength).map(c => c.periodLength);
    if (periodLengths.length > 0)
      averagePeriodLength = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);
  }

  const lastStart = new Date(lastCycle.startDate);
  const nextPeriodDate = addDays(lastStart, averageCycleLength);
  const ovulationDate = addDays(nextPeriodDate, -14);
  const fertileWindowStart = addDays(ovulationDate, -5);
  const fertileWindowEnd = addDays(ovulationDate, 1);

  // Fertility score based on current day in cycle
  const today = new Date();
  const currentCycleDay = differenceInDays(today, lastStart) + 1;
  const daysToOvulation = differenceInDays(ovulationDate, today);
  let fertilityScore = 0;
  if (daysToOvulation >= -1 && daysToOvulation <= 5) {
    fertilityScore = Math.max(0, 100 - Math.abs(daysToOvulation) * 15);
  }

  return {
    nextPeriodDate,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    fertilityScore,
    averageCycleLength,
    averagePeriodLength,
    currentCycleDay,
    daysUntilNextPeriod: differenceInDays(nextPeriodDate, today),
  };
}

/**
 * Calculate cycle regularity score (0-100)
 */
function calculateRegularityScore(cycles) {
  if (cycles.length < 3) return null;
  const sorted = [...cycles].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = differenceInDays(new Date(sorted[i].startDate), new Date(sorted[i - 1].startDate));
    if (len > 0 && len < 60) lengths.push(len);
  }
  if (lengths.length === 0) return null;
  const mean = lengths.reduce((a, b) => a + b) / lengths.length;
  const variance = lengths.reduce((acc, l) => acc + Math.pow(l - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  // Score: perfect=100, stdDev of 7 = ~50
  return Math.max(0, Math.round(100 - stdDev * 7));
}

/**
 * Get calendar markers for a date range
 */
function getCalendarMarkers(cycles, predictions, startDate, endDate) {
  const markers = {};
  const markDate = (date, type, color) => {
    const key = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    if (!markers[key]) markers[key] = { dots: [] };
    markers[key].dots.push({ color, key: type });
  };

  cycles.forEach(cycle => {
    const start = new Date(cycle.startDate);
    const end = cycle.endDate ? new Date(cycle.endDate) : addDays(start, (cycle.periodLength || 5) - 1);
    let d = new Date(start);
    while (d <= end) {
      markDate(d, 'period', '#E91E8C');
      d = addDays(d, 1);
    }
  });

  if (predictions) {
    const { nextPeriodDate, ovulationDate, fertileWindowStart, fertileWindowEnd } = predictions;
    // Future period
    for (let i = 0; i < 5; i++) markDate(addDays(nextPeriodDate, i), 'future_period', '#F48FB1');
    // Fertile window
    let d = new Date(fertileWindowStart);
    while (d <= fertileWindowEnd) {
      markDate(d, 'fertile', '#81C784');
      d = addDays(d, 1);
    }
    // Ovulation
    markDate(ovulationDate, 'ovulation', '#FFB300');
  }

  return markers;
}

module.exports = { predictNextCycle, calculateRegularityScore, getCalendarMarkers };
