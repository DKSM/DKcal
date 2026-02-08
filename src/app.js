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
const { estimateNutrition } = require('./services/estimator');

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
    secure: false,
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

// AI nutrition estimate
app.get('/api/estimate', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    const unit = req.query.unit || '100g';
    const result = await estimateNutrition(q, unit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Suggestions (items used in last 14 days)
app.get('/api/suggestions', async (req, res, next) => {
  try {
    const storage = require('./services/storage');
    const items = await storage.readItems();
    const itemsMap = new Map(items.map(i => [i.id, i]));
    const dates = await storage.listDayDates();

    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const cutoff = twoWeeksAgo.toISOString().slice(0, 10);

    const recentDates = dates.filter(d => d >= cutoff);
    const freq = {};

    for (const dateStr of recentDates) {
      const day = await storage.readDay('default', dateStr);
      for (const entry of day.entries) {
        freq[entry.itemId] = (freq[entry.itemId] || 0) + 1;
      }
    }

    const suggestions = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([itemId, count]) => {
        const item = itemsMap.get(itemId);
        return item ? { ...item, frequency: count } : null;
      })
      .filter(Boolean);

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

// Error handler
app.use(errorHandler);

module.exports = app;
