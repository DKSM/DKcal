// Server-rendered printable export page for nutrition tracking.
// Auth via session cookie. Not mounted under /api so it bypasses the JSON
// requireAuth gate; if no session, we redirect to the login page.

const express = require('express');
const storage = require('../services/storage');
const renderExportPrint = require('../views/exportPrintTemplate');
const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

router.get('/export/print', async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/');
  }
  try {
    const userId = req.session.userId;
    let { from, to } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    if (!to || !DATE_RE.test(to)) to = today;
    if (!from || !DATE_RE.test(from)) from = addDays(to, -29);
    if (from > to) [from, to] = [to, from];

    const accounts = await storage.readAccounts();
    const account = accounts.find(a => a.id === userId);
    const username = account ? account.username : userId;

    const profile = await storage.readProfile(userId);

    // Clamp `from` to the user's earliest known day so big presets (1 year)
    // don't pad the report with months of empty days before the user started.
    const knownDatesList = await storage.listDayDates(userId);
    if (knownDatesList.length > 0) {
      const earliest = knownDatesList[0];
      if (from < earliest) from = earliest;
    }

    // Build the full list of dates in the range
    const dates = [];
    let cursor = from;
    let safety = 0;
    while (cursor <= to && safety++ < 1000) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const knownDates = new Set(knownDatesList);
    const days = await Promise.all(dates.map(async (date) => {
      if (!knownDates.has(date)) {
        return { date, tracked: false, kcal: 0, protein: 0, fat: 0, carbs: 0, weight: null };
      }
      const day = await storage.readDay(userId, date);
      const t = day.totals || {};
      return {
        date,
        tracked: (day.entries && day.entries.length > 0) || day.weight != null,
        kcal: t.kcal || 0,
        protein: t.protein || 0,
        fat: t.fat || 0,
        carbs: t.carbs || 0,
        weight: day.weight != null ? day.weight : null,
      };
    }));

    const maintenance = profile.maintenanceCalories || 0;
    const deficitPct = profile.deficitPct != null ? profile.deficitPct : 100;
    const goalTarget = maintenance && deficitPct < 100 ? Math.round(maintenance * deficitPct / 100) : 0;

    // Only count tracked days for averages so empty days don't tank the numbers
    const trackedDays = days.filter(d => d.tracked && d.kcal > 0);
    const trackedCount = trackedDays.length;

    const sumKcal = trackedDays.reduce((s, d) => s + d.kcal, 0);
    const sumProtein = trackedDays.reduce((s, d) => s + d.protein, 0);
    const sumFat = trackedDays.reduce((s, d) => s + d.fat, 0);
    const sumCarbs = trackedDays.reduce((s, d) => s + d.carbs, 0);

    const maxKcalDay = trackedDays.reduce((max, d) => (!max || d.kcal > max.kcal) ? d : max, null);

    let underGoalDays = 0;
    if (goalTarget) {
      underGoalDays = trackedDays.filter(d => d.kcal <= goalTarget).length;
    }

    const weighedDays = days.filter(d => d.weight != null);
    const weightStart = weighedDays[0]?.weight ?? null;
    const weightEnd = weighedDays.length ? weighedDays[weighedDays.length - 1].weight : null;

    const summary = {
      total_days: days.length,
      tracked_days: trackedCount,
      avg_kcal: trackedCount ? sumKcal / trackedCount : 0,
      avg_protein: trackedCount ? sumProtein / trackedCount : 0,
      avg_fat: trackedCount ? sumFat / trackedCount : 0,
      avg_carbs: trackedCount ? sumCarbs / trackedCount : 0,
      total_kcal: sumKcal,
      max_kcal_day: maxKcalDay,
      under_goal_days: underGoalDays,
      weight_start: weightStart,
      weight_end: weightEnd,
    };

    const data = {
      user: { username },
      profile,
      from, to,
      generated_at: new Date().toISOString(),
      summary, days,
    };

    res.type('html').send(renderExportPrint(data));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
