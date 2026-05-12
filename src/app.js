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
const adminRoutes = require('./routes/admin');
const { estimateNutrition, estimateFromImage, estimateChat, transcribeAudio } = require('./services/estimator');

const app = express();
// Trust the first reverse proxy (nginx/caddy on the VPS) so req.secure reflects
// the real client protocol — needed for cookie.secure: 'auto' to work in prod.
app.set('trust proxy', 1);

// Parse JSON & form bodies
// Limit is high enough to accept audio (voice dictation) and images
// that have not yet been compressed client-side.
app.use(express.json({ limit: '50mb' }));
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
    // 'auto' sets secure=true only when the request is actually HTTPS
    // (relies on trust proxy above). Works both for local HTTP and VPS HTTPS.
    secure: 'auto',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// Auth routes (before auth gate)
app.use('/api', authRoutes);

// Printable export page (HTML, not under /api so it bypasses the JSON auth gate;
// the route itself redirects to / if the user isn't logged in).
app.use('/', require('./routes/exportPage'));

// Auth gate — everything below requires authentication
app.use('/api', requireAuth);

// Protected API routes
app.use('/api', adminRoutes);
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

// Audio transcription (dictate food description)
app.post('/api/transcribe', express.json({ limit: '10mb' }), async (req, res, next) => {
  try {
    const { audio, language } = req.body;
    if (!audio) return res.status(400).json({ error: 'Audio requis' });
    const storage = require('./services/storage');
    // Save audio to disk (retained 30 days, non-blocking cleanup)
    storage.saveAudio(req.session.userId, audio).catch(err => console.error('[audio save]', err));
    const result = await transcribeAudio(audio, language || 'fr');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// AI nutrition chat (follow-up corrections)
app.post('/api/estimate-chat', async (req, res, next) => {
  try {
    const { messages, conversation_id } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages requis' });
    }
    const result = await estimateChat(messages, conversation_id || null);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Temporary entries history (for search/reuse)
app.get('/api/temp-history', async (req, res, next) => {
  try {
    const storage = require('./services/storage');
    const userId = req.session.userId;
    const dates = await storage.listDayDates(userId);

    // Aggregate temporary entries across all days, keyed by name+description
    const grouped = new Map();
    for (const dateStr of dates) {
      const day = await storage.readDay(userId, dateStr);
      for (const entry of day.entries) {
        if (!entry.temporary) continue;
        const key = `${(entry.itemName || '').toLowerCase()}|${(entry.description || '').toLowerCase()}`;
        const qty = entry.qty || 1;
        // Store the per-unit macros so we can re-multiply on add
        const perUnit = {
          kcal: (entry.kcal || 0) / qty,
          protein: (entry.protein || 0) / qty,
          fat: (entry.fat || 0) / qty,
          carbs: (entry.carbs || 0) / qty,
        };
        const existing = grouped.get(key);
        if (existing) {
          existing.count += 1;
          if (dateStr > existing.lastDate) {
            existing.lastDate = dateStr;
            existing.lastQty = qty;
            existing.unitType = entry.unitType || existing.unitType;
            existing.perUnit = perUnit;
            existing.kcal = entry.kcal;
            existing.protein = entry.protein;
            existing.fat = entry.fat;
            existing.carbs = entry.carbs;
          }
        } else {
          grouped.set(key, {
            itemName: entry.itemName || 'Temporaire',
            description: entry.description || '',
            unitType: entry.unitType || 'unit',
            lastQty: qty,
            lastDate: dateStr,
            count: 1,
            perUnit,
            kcal: entry.kcal,
            protein: entry.protein,
            fat: entry.fat,
            carbs: entry.carbs,
          });
        }
      }
    }

    // Sort by usage frequency, then by most recent
    const list = [...grouped.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastDate.localeCompare(a.lastDate);
    });

    res.json(list);
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
