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

async function computeStats(userId = 'default', fromDate, toDate, minKcal = 0) {
  const allDates = await storage.listDayDates(userId);
  const filtered = allDates.filter(d => d >= fromDate && d <= toDate);

  const dates = [];
  const kcalValues = [];
  const proteinValues = [];
  const fatValues = [];
  const carbsValues = [];
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
      const dayKcal = day.totals?.kcal || 0;

      // Filtre jours incomplets : en dessous du seuil → traité comme vide
      if (minKcal > 0 && dayKcal > 0 && dayKcal < minKcal) {
        kcalValues.push(0);
        proteinValues.push(0);
        fatValues.push(0);
        carbsValues.push(0);
      } else {
        kcalValues.push(dayKcal);
        proteinValues.push(day.totals?.protein || 0);
        fatValues.push(day.totals?.fat || 0);
        carbsValues.push(day.totals?.carbs || 0);
      }
      weightValues.push(day.weight || null);
    } else {
      kcalValues.push(0);
      proteinValues.push(0);
      fatValues.push(0);
      carbsValues.push(0);
      weightValues.push(null);
    }
  }

  // Exclude today from averages (partial day skews stats)
  const today = new Date().toISOString().slice(0, 10);
  const todayIdx = dates.indexOf(today);

  // Filtrage synchronisé : un jour compte si ses kcal > 0 (après filtrage minKcal)
  const validDay = (i) => kcalValues[i] > 0 && i !== todayIdx;
  const nonZeroKcal = kcalValues.filter((_, i) => validDay(i));
  const nonZeroProtein = proteinValues.filter((_, i) => validDay(i));
  const nonZeroFat = fatValues.filter((_, i) => validDay(i));
  const nonZeroCarbs = carbsValues.filter((_, i) => validDay(i));
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
    fat: {
      values: fatValues,
      movingAvg: movingAverage(fatValues),
    },
    carbs: {
      values: carbsValues,
      movingAvg: movingAverage(carbsValues),
    },
    weight: {
      values: weightValues,
      movingAvg: movingAverage(weightValues),
      trend: linearTrend(weightValues),
    },
    summary: {
      avgKcal: nonZeroKcal.length > 0 ? Math.round(nonZeroKcal.reduce((a, b) => a + b, 0) / nonZeroKcal.length) : 0,
      avgProtein: nonZeroProtein.length > 0 ? Math.round(nonZeroProtein.reduce((a, b) => a + b, 0) / nonZeroProtein.length * 10) / 10 : 0,
      avgFat: nonZeroFat.length > 0 ? Math.round(nonZeroFat.reduce((a, b) => a + b, 0) / nonZeroFat.length * 10) / 10 : 0,
      avgCarbs: nonZeroCarbs.length > 0 ? Math.round(nonZeroCarbs.reduce((a, b) => a + b, 0) / nonZeroCarbs.length * 10) / 10 : 0,
      minWeight: nonNullWeight.length > 0 ? Math.min(...nonNullWeight) : null,
      maxWeight: nonNullWeight.length > 0 ? Math.max(...nonNullWeight) : null,
      weightDelta: nonNullWeight.length >= 2 ? Math.round((nonNullWeight[nonNullWeight.length - 1] - nonNullWeight[0]) * 10) / 10 : null,
      daysTracked: nonZeroKcal.length + (todayIdx !== -1 && kcalValues[todayIdx] > 0 ? 1 : 0),
    },
  };
}

module.exports = { computeStats };
