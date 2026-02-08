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

    if (req.body.sex !== undefined) existing.sex = req.body.sex;
    if (req.body.age !== undefined) existing.age = req.body.age;
    if (req.body.weight !== undefined) existing.weight = req.body.weight;
    if (req.body.bmr !== undefined) existing.bmr = req.body.bmr;
    if (req.body.activityMode !== undefined) existing.activityMode = req.body.activityMode;
    if (req.body.customActivity !== undefined) existing.customActivity = req.body.customActivity;
    if (req.body.maintenanceCalories !== undefined) existing.maintenanceCalories = req.body.maintenanceCalories;

    await storage.writeProfile(userId, existing);
    res.json(existing);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
