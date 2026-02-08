const express = require('express');
const { computeStats } = require('../services/statsCalc');
const router = express.Router();

// GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/stats', async (req, res, next) => {
  try {
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    let from = req.query.from;

    if (!from) {
      // Default to 30 days
      const d = new Date(to);
      d.setDate(d.getDate() - 29);
      from = d.toISOString().slice(0, 10);
    }

    const stats = await computeStats(req.session.userId, from, to);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
