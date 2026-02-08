const express = require('express');
const { v4: uuidv4 } = require('uuid');
const storage = require('../services/storage');
const { validateItem } = require('../validation/itemSchema');
const { computeItemNutrition } = require('../services/itemCalc');
const router = express.Router();

// GET /api/items
router.get('/items', async (req, res, next) => {
  try {
    const items = await storage.readItems();
    const itemsMap = new Map(items.map(i => [i.id, i]));

    const search = (req.query.search || '').toLowerCase().trim();
    let result = items;
    if (search) {
      result = items.filter(i => i.name.toLowerCase().includes(search));
    }

    const enriched = result.map(item => ({
      ...item,
      computed: computeItemNutrition(item, itemsMap),
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// POST /api/items
router.post('/items', async (req, res, next) => {
  try {
    const errors = validateItem(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const items = await storage.readItems();
    const now = new Date().toISOString();

    const item = {
      id: uuidv4(),
      name: req.body.name.trim(),
      mode: req.body.mode,
      created: now,
      updated: now,
    };

    if (req.body.mode === 'per_100') {
      item.kcal_100 = req.body.kcal_100;
      item.protein_100 = req.body.protein_100 ?? null;
      item.baseUnit = req.body.baseUnit || 'g';
    } else if (req.body.mode === 'per_unit') {
      item.kcal_unit = req.body.kcal_unit;
      item.protein_unit = req.body.protein_unit ?? null;
    } else if (req.body.mode === 'composite') {
      item.components = req.body.components;
    }

    items.push(item);
    await storage.writeItems('default', items);

    const itemsMap = new Map(items.map(i => [i.id, i]));
    res.status(201).json({ ...item, computed: computeItemNutrition(item, itemsMap) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/items/:id
router.put('/items/:id', async (req, res, next) => {
  try {
    const items = await storage.readItems();
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const errors = validateItem(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const item = {
      ...items[idx],
      name: req.body.name.trim(),
      mode: req.body.mode,
      updated: new Date().toISOString(),
    };

    // Clear old mode fields
    delete item.kcal_100;
    delete item.protein_100;
    delete item.kcal_unit;
    delete item.protein_unit;
    delete item.components;
    delete item.baseUnit;

    if (req.body.mode === 'per_100') {
      item.kcal_100 = req.body.kcal_100;
      item.protein_100 = req.body.protein_100 ?? null;
      item.baseUnit = req.body.baseUnit || 'g';
    } else if (req.body.mode === 'per_unit') {
      item.kcal_unit = req.body.kcal_unit;
      item.protein_unit = req.body.protein_unit ?? null;
    } else if (req.body.mode === 'composite') {
      item.components = req.body.components;
    }

    items[idx] = item;
    await storage.writeItems('default', items);

    const itemsMap = new Map(items.map(i => [i.id, i]));
    res.json({ ...item, computed: computeItemNutrition(item, itemsMap) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/items/:id
router.delete('/items/:id', async (req, res, next) => {
  try {
    const items = await storage.readItems();
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    items.splice(idx, 1);
    await storage.writeItems('default', items);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
