const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const dayRoutes = require('./routes/day');
const statsRoutes = require('./routes/stats');
const profileRoutes = require('./routes/profile');
const { estimateNutrition, estimateFromImage, estimateChat } = require('./services/estimator');

const app = express();

// Parse JSON & form bodies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Serve static files (login page accessible without auth)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session (persisted to disk)
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, '..', 'data', 'sessions'),
    ttl: 30 * 24 * 60 * 60, // 30 days
    retries: 0,
    logFn: () => {},
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// Auth routes (before auth gate)
app.use('/api', authRoutes);

// Auth gate — everything below requires authentication
app.use('/api', requireAuth);

// Protected API routes
app.use('/api', itemsRoutes);
app.use('/api', dayRoutes);
app.use('/api', statsRoutes);
app.use('/api', profileRoutes);

// AI nutrition estimate
app.get('/api/estimate', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const desc = req.query.desc || '';
    if (!desc && !q) return res.status(400).json({ error: 'Nom ou description requis' });
    const unit = req.query.unit || '100g';
    const primary = desc || q;
    const context = desc ? q : '';
    const result = await estimateNutrition(primary, unit, context);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// AI nutrition estimate from image
app.post('/api/estimate-image', express.json({ limit: '5mb' }), async (req, res, next) => {
  try {
    const { image, unit, name } = req.body;
    if (!image) return res.status(400).json({ error: 'Image requise' });
    const result = await estimateFromImage(image, unit || '100g', name || '');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// AI nutrition chat (follow-up corrections)
app.post('/api/estimate-chat', async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages requis' });
    }
    if (messages.length > 100) {
      return res.status(400).json({ error: 'Trop de messages (max 100)' });
    }
    const result = await estimateChat(messages);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Suggestions (all items sorted by all-time frequency)
app.get('/api/suggestions', async (req, res, next) => {
  try {
    const storage = require('./services/storage');
    const userId = req.session.userId;
    const items = await storage.readItems(userId);
    const dates = await storage.listDayDates(userId);

    const freq = {};
    for (const dateStr of dates) {
      const day = await storage.readDay(userId, dateStr);
      for (const entry of day.entries) {
        freq[entry.itemId] = (freq[entry.itemId] || 0) + 1;
      }
    }

    const { computeItemNutrition } = require('./services/itemCalc');
    const itemsMap = new Map(items.map(i => [i.id, i]));
    const suggestions = items
      .map(item => ({ ...item, frequency: freq[item.id] || 0, computed: computeItemNutrition(item, itemsMap) }))
      .sort((a, b) => b.frequency - a.frequency);

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

// Error handler
app.use(errorHandler);

module.exports = app;
