const express = require('express');
const { v4: uuidv4 } = require('uuid');
const storage = require('../services/storage');
const { validateItem } = require('../validation/itemSchema');
const { calculateItem, computeItemNutrition } = require('../services/itemCalc');
const router = express.Router();

// Recalculate all day entries that use any of the given item IDs
async function recalcDays(userId, itemIds, itemsMap) {
  const dates = await storage.listDayDates(userId);
  const idSet = new Set(itemIds);

  for (const dateStr of dates) {
    const day = await storage.readDay(userId, dateStr);
    let changed = false;

    for (const entry of day.entries) {
      if (!idSet.has(entry.itemId)) continue;
      const nutrition = calculateItem(entry.itemId, entry.qty, entry.unitType, itemsMap);
      const newKcal = nutrition.kcal || 0;
      const newProtein = nutrition.protein || 0;
      const newFat = nutrition.fat || 0;
      const newCarbs = nutrition.carbs || 0;
      if (entry.kcal !== newKcal || entry.protein !== newProtein || entry.fat !== newFat || entry.carbs !== newCarbs) {
        entry.kcal = newKcal;
        entry.protein = newProtein;
        entry.fat = newFat;
        entry.carbs = newCarbs;
        changed = true;
      }
    }

    if (changed) {
      day.totals = {
        kcal: Math.round(day.entries.reduce((s, e) => s + (e.kcal || 0), 0) * 100) / 100,
        protein: Math.round(day.entries.reduce((s, e) => s + (e.protein || 0), 0) * 100) / 100,
        fat: Math.round(day.entries.reduce((s, e) => s + (e.fat || 0), 0) * 100) / 100,
        carbs: Math.round(day.entries.reduce((s, e) => s + (e.carbs || 0), 0) * 100) / 100,
      };
      await storage.writeDay(userId, dateStr, day);
    }
  }
}

// Find all item IDs affected by a change to the given itemId (including composites that use it)
function findAffectedItemIds(changedId, items) {
  const affected = new Set([changedId]);
  let added = true;
  while (added) {
    added = false;
    for (const item of items) {
      if (affected.has(item.id)) continue;
      if (item.mode === 'composite' && Array.isArray(item.components)) {
        if (item.components.some(c => affected.has(c.itemId))) {
          affected.add(item.id);
          added = true;
        }
      }
    }
  }
  return [...affected];
}

// GET /api/items
router.get('/items', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const items = await storage.readItems(userId);
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
    const userId = req.session.userId;
    const errors = validateItem(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const items = await storage.readItems(userId);

    // Check for duplicate name
    const trimmedName = req.body.name.trim().toLowerCase();
    if (items.some(i => i.name.trim().toLowerCase() === trimmedName)) {
      return res.status(409).json({ error: 'Un aliment avec ce nom existe déjà' });
    }

    const now = new Date().toISOString();

    const item = {
      id: uuidv4(),
      name: req.body.name.trim(),
      description: req.body.description || '',
      mode: req.body.mode,
      created: now,
      updated: now,
    };

    if (req.body.mode === 'per_100') {
      item.kcal_100 = req.body.kcal_100;
      item.protein_100 = req.body.protein_100 ?? null;
      item.fat_100 = req.body.fat_100 ?? null;
      item.carbs_100 = req.body.carbs_100 ?? null;
      item.baseUnit = req.body.baseUnit || 'g';
    } else if (req.body.mode === 'per_unit') {
      item.kcal_unit = req.body.kcal_unit;
      item.protein_unit = req.body.protein_unit ?? null;
      item.fat_unit = req.body.fat_unit ?? null;
      item.carbs_unit = req.body.carbs_unit ?? null;
    } else if (req.body.mode === 'composite') {
      item.components = req.body.components;
    }

    items.push(item);
    await storage.writeItems(userId, items);

    const itemsMap = new Map(items.map(i => [i.id, i]));
    res.status(201).json({ ...item, computed: computeItemNutrition(item, itemsMap) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/items/:id
router.put('/items/:id', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const items = await storage.readItems(userId);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const errors = validateItem(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    // Check for duplicate name (exclude self)
    const trimmedName = req.body.name.trim().toLowerCase();
    if (items.some((i, j) => j !== idx && i.name.trim().toLowerCase() === trimmedName)) {
      return res.status(409).json({ error: 'Un aliment avec ce nom existe déjà' });
    }

    const item = {
      ...items[idx],
      name: req.body.name.trim(),
      description: req.body.description || '',
      mode: req.body.mode,
      updated: new Date().toISOString(),
    };

    // Clear old mode fields
    delete item.kcal_100;
    delete item.protein_100;
    delete item.fat_100;
    delete item.carbs_100;
    delete item.kcal_unit;
    delete item.protein_unit;
    delete item.fat_unit;
    delete item.carbs_unit;
    delete item.components;
    delete item.baseUnit;

    if (req.body.mode === 'per_100') {
      item.kcal_100 = req.body.kcal_100;
      item.protein_100 = req.body.protein_100 ?? null;
      item.fat_100 = req.body.fat_100 ?? null;
      item.carbs_100 = req.body.carbs_100 ?? null;
      item.baseUnit = req.body.baseUnit || 'g';
    } else if (req.body.mode === 'per_unit') {
      item.kcal_unit = req.body.kcal_unit;
      item.protein_unit = req.body.protein_unit ?? null;
      item.fat_unit = req.body.fat_unit ?? null;
      item.carbs_unit = req.body.carbs_unit ?? null;
    } else if (req.body.mode === 'composite') {
      item.components = req.body.components;
    }

    items[idx] = item;
    await storage.writeItems(userId, items);

    // Recalculate all historical entries affected by this item change
    const itemsMap = new Map(items.map(i => [i.id, i]));
    const affectedIds = findAffectedItemIds(item.id, items);
    await recalcDays(userId, affectedIds, itemsMap);

    res.json({ ...item, computed: computeItemNutrition(item, itemsMap) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/items/:id
router.delete('/items/:id', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const items = await storage.readItems(userId);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }

    items.splice(idx, 1);
    await storage.writeItems(userId, items);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
