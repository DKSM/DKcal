const express = require('express');
const { computeStats } = require('../services/statsCalc');
const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/stats', async (req, res, next) => {
  try {
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    let from = req.query.from;

    if (req.query.to && !DATE_RE.test(req.query.to)) {
      return res.status(400).json({ error: 'Invalid date format for to, use YYYY-MM-DD' });
    }
    if (from && !DATE_RE.test(from)) {
      return res.status(400).json({ error: 'Invalid date format for from, use YYYY-MM-DD' });
    }

    if (!from) {
      // Default to 30 days
      const d = new Date(to);
      d.setDate(d.getDate() - 29);
      from = d.toISOString().slice(0, 10);
    }

    const minKcal = Math.max(0, Math.min(5000, parseInt(req.query.minKcal) || 0));
    const stats = await computeStats(req.session.userId, from, to, minKcal);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
