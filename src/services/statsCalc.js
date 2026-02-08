const storage = require('./storage');

function movingAverage(values, windowSize = 7) {
  const result = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1).filter(v => v != null);
    result.push(window.length > 0 ? Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 100) / 100 : null);
  }
  return result;
}

function linearTrend(values) {
  const points = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) points.push({ x: i, y: values[i] });
  }
  if (points.length < 2) return values.map(() => null);

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return values.map((_, i) => Math.round((slope * i + intercept) * 100) / 100);
}

async function computeStats(userId = 'default', fromDate, toDate) {
  const allDates = await storage.listDayDates(userId);
  const filtered = allDates.filter(d => d >= fromDate && d <= toDate);

  const dates = [];
  const kcalValues = [];
  const proteinValues = [];
  const weightValues = [];

  // Fill in all dates in the range (including gaps)
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const filteredSet = new Set(filtered);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    dates.push(dateStr);

    if (filteredSet.has(dateStr)) {
      const day = await storage.readDay(userId, dateStr);
      kcalValues.push(day.totals?.kcal || 0);
      proteinValues.push(day.totals?.protein || 0);
      weightValues.push(day.weight || null);
    } else {
      kcalValues.push(0);
      proteinValues.push(0);
      weightValues.push(null);
    }
  }

  const nonZeroKcal = kcalValues.filter(v => v > 0);
  const nonZeroProtein = proteinValues.filter(v => v > 0);
  const nonNullWeight = weightValues.filter(v => v != null);

  return {
    dates,
    kcal: {
      values: kcalValues,
      movingAvg: movingAverage(kcalValues),
    },
    protein: {
      values: proteinValues,
      movingAvg: movingAverage(proteinValues),
    },
    weight: {
      values: weightValues,
      movingAvg: movingAverage(weightValues),
      trend: linearTrend(weightValues),
    },
    summary: {
      avgKcal: nonZeroKcal.length > 0 ? Math.round(nonZeroKcal.reduce((a, b) => a + b, 0) / nonZeroKcal.length) : 0,
      avgProtein: nonZeroProtein.length > 0 ? Math.round(nonZeroProtein.reduce((a, b) => a + b, 0) / nonZeroProtein.length * 10) / 10 : 0,
      minWeight: nonNullWeight.length > 0 ? Math.min(...nonNullWeight) : null,
      maxWeight: nonNullWeight.length > 0 ? Math.max(...nonNullWeight) : null,
      weightDelta: nonNullWeight.length >= 2 ? Math.round((nonNullWeight[nonNullWeight.length - 1] - nonNullWeight[0]) * 10) / 10 : null,
      daysTracked: nonZeroKcal.length,
    },
  };
}

module.exports = { computeStats };
