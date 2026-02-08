const express = require('express');
const { v4: uuidv4 } = require('uuid');
const storage = require('../services/storage');
const { validateDayUpdate } = require('../validation/daySchema');
const { computeEntryNutrition } = require('../services/itemCalc');
const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/day/:date
router.get('/day/:date', async (req, res, next) => {
  try {
    if (!DATE_RE.test(req.params.date)) {
      return res.status(400).json({ error: 'Invalid date format, use YYYY-MM-DD' });
    }
    const day = await storage.readDay('default', req.params.date);

    // Enrich entries with item names
    const items = await storage.readItems();
    const itemsMap = new Map(items.map(i => [i.id, i]));
    day.entries = day.entries.map(e => ({
      ...e,
      itemName: itemsMap.get(e.itemId)?.name || 'Unknown',
    }));

    res.json(day);
  } catch (err) {
    next(err);
  }
});

// PUT /api/day/:date
router.put('/day/:date', async (req, res, next) => {
  try {
    if (!DATE_RE.test(req.params.date)) {
      return res.status(400).json({ error: 'Invalid date format, use YYYY-MM-DD' });
    }

    const dateStr = req.params.date;
    const existing = await storage.readDay('default', dateStr);

    // Update weight if provided
    if (req.body.weight !== undefined) {
      existing.weight = req.body.weight;
    }

    // Add a single entry
    if (req.body.addEntry) {
      const e = req.body.addEntry;
      if (!e.itemId || typeof e.qty !== 'number' || !['g', 'ml', 'unit'].includes(e.unitType)) {
        return res.status(400).json({ error: 'addEntry requires itemId, qty, unitType' });
      }
      const nutrition = await computeEntryNutrition('default', e.itemId, e.qty, e.unitType);
      existing.entries.push({
        id: uuidv4(),
        itemId: e.itemId,
        qty: e.qty,
        unitType: e.unitType,
        time: e.time || new Date().toTimeString().slice(0, 5),
        kcal: nutrition.kcal || 0,
        protein: nutrition.protein || 0,
        fat: nutrition.fat || 0,
        carbs: nutrition.carbs || 0,
      });
    }

    // Replace all entries (for editing)
    if (req.body.entries) {
      const errors = validateDayUpdate(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
      }
      const recomputed = [];
      for (const e of req.body.entries) {
        const nutrition = await computeEntryNutrition('default', e.itemId, e.qty, e.unitType);
        recomputed.push({
          id: e.id || uuidv4(),
          itemId: e.itemId,
          qty: e.qty,
          unitType: e.unitType,
          time: e.time || '',
          kcal: nutrition.kcal || 0,
          protein: nutrition.protein || 0,
          fat: nutrition.fat || 0,
          carbs: nutrition.carbs || 0,
        });
      }
      existing.entries = recomputed;
    }

    // Remove entry
    if (req.body.removeEntryId) {
      existing.entries = existing.entries.filter(e => e.id !== req.body.removeEntryId);
    }

    // Recompute totals
    existing.totals = {
      kcal: Math.round(existing.entries.reduce((s, e) => s + (e.kcal || 0), 0) * 100) / 100,
      protein: Math.round(existing.entries.reduce((s, e) => s + (e.protein || 0), 0) * 100) / 100,
      fat: Math.round(existing.entries.reduce((s, e) => s + (e.fat || 0), 0) * 100) / 100,
      carbs: Math.round(existing.entries.reduce((s, e) => s + (e.carbs || 0), 0) * 100) / 100,
    };
    existing.date = dateStr;

    await storage.writeDay('default', dateStr, existing);

    // Enrich with item names for response
    const items = await storage.readItems();
    const itemsMap = new Map(items.map(i => [i.id, i]));
    existing.entries = existing.entries.map(e => ({
      ...e,
      itemName: itemsMap.get(e.itemId)?.name || 'Unknown',
    }));

    res.json(existing);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
