const express = require('express');
const storage = require('../services/storage');
const router = express.Router();

// GET /api/profile
router.get('/profile', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const profile = await storage.readProfile(userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile
router.put('/profile', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const existing = await storage.readProfile(userId);

    const b = req.body;
    if (b.sex !== undefined) {
      if (b.sex !== null && b.sex !== 'male' && b.sex !== 'female') {
        return res.status(400).json({ error: 'sex must be male, female or null' });
      }
      existing.sex = b.sex;
    }
    if (b.age !== undefined) {
      if (b.age !== null && (typeof b.age !== 'number' || b.age < 1 || b.age > 120)) {
        return res.status(400).json({ error: 'age must be between 1 and 120' });
      }
      existing.age = b.age;
    }
    if (b.height !== undefined) {
      if (b.height !== null && (typeof b.height !== 'number' || b.height < 50 || b.height > 250)) {
        return res.status(400).json({ error: 'height must be between 50 and 250' });
      }
      existing.height = b.height;
    }
    if (b.weight !== undefined) {
      if (b.weight !== null && (typeof b.weight !== 'number' || b.weight < 1 || b.weight > 500)) {
        return res.status(400).json({ error: 'weight must be between 1 and 500' });
      }
      existing.weight = b.weight;
    }
    if (b.bmr !== undefined) {
      if (b.bmr !== null && (typeof b.bmr !== 'number' || b.bmr < 500 || b.bmr > 10000)) {
        return res.status(400).json({ error: 'bmr must be between 500 and 10000' });
      }
      existing.bmr = b.bmr;
    }
    if (b.activityMode !== undefined) {
      const validModes = ['sedentary', 'light', 'moderate', 'active', 'very_active', 'custom'];
      if (b.activityMode !== null && !validModes.includes(b.activityMode)) {
        return res.status(400).json({ error: 'Invalid activity mode' });
      }
      existing.activityMode = b.activityMode;
    }
    if (b.customActivity !== undefined) {
      if (b.customActivity !== null && (typeof b.customActivity !== 'number' || b.customActivity < 0 || b.customActivity > 5000)) {
        return res.status(400).json({ error: 'customActivity must be between 0 and 5000' });
      }
      existing.customActivity = b.customActivity;
    }
    if (b.deficitPct !== undefined) {
      if (typeof b.deficitPct !== 'number' || b.deficitPct < 1 || b.deficitPct > 100) {
        return res.status(400).json({ error: 'deficitPct must be between 1 and 100' });
      }
      existing.deficitPct = b.deficitPct;
    }
    if (b.maintenanceCalories !== undefined) existing.maintenanceCalories = b.maintenanceCalories;
    if (b.calorieAdjust !== undefined) {
      if (typeof b.calorieAdjust !== 'number' || b.calorieAdjust < -50 || b.calorieAdjust > 100) {
        return res.status(400).json({ error: 'calorieAdjust must be between -50 and 100' });
      }
      existing.calorieAdjust = b.calorieAdjust;
    }

    await storage.writeProfile(userId, existing);
    res.json(existing);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
