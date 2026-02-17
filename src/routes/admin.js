const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const storage = require('../services/storage');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

// All admin routes require admin
router.use('/admin', requireAdmin);

// GET /api/admin/users — list all accounts (no passwordHash)
router.get('/admin/users', async (req, res, next) => {
  try {
    const accounts = await storage.readAccounts();
    const users = accounts.map(a => ({
      id: a.id,
      username: a.username,
      created: a.created,
    }));
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users — create a new account
router.post('/admin/users', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }
    if (typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    if (typeof password !== 'string' || password.length < 3) {
      return res.status(400).json({ error: 'Mot de passe trop court (min 3 caractères)' });
    }

    const accounts = await storage.readAccounts();
    if (accounts.find(a => a.username === username.trim())) {
      return res.status(409).json({ error: 'Cet identifiant existe déjà' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newAccount = {
      id: uuidv4(),
      username: username.trim(),
      passwordHash,
      created: new Date().toISOString(),
    };
    accounts.push(newAccount);
    await storage.writeAccounts(accounts);

    res.json({ id: newAccount.id, username: newAccount.username, created: newAccount.created });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id — change password
router.put('/admin/users/:id', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 3) {
      return res.status(400).json({ error: 'Mot de passe trop court (min 3 caractères)' });
    }

    const accounts = await storage.readAccounts();
    const account = accounts.find(a => a.id === req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    account.passwordHash = await bcrypt.hash(password, 10);
    await storage.writeAccounts(accounts);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id — remove account (keeps data directory)
router.delete('/admin/users/:id', async (req, res, next) => {
  try {
    const accounts = await storage.readAccounts();
    const idx = accounts.findIndex(a => a.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Don't allow deleting yourself
    const realUserId = req.session.originalUserId || req.session.userId;
    if (accounts[idx].id === realUserId) {
      return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
    }

    accounts.splice(idx, 1);
    await storage.writeAccounts(accounts);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/impersonate — enter spectator mode
router.post('/admin/impersonate', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const accounts = await storage.readAccounts();
    if (!accounts.find(a => a.id === userId)) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Store original admin userId if not already impersonating
    if (!req.session.originalUserId) {
      req.session.originalUserId = req.session.userId;
    }
    req.session.userId = userId;

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/exit-impersonate — leave spectator mode
router.post('/admin/exit-impersonate', async (req, res, next) => {
  try {
    if (!req.session.originalUserId) {
      return res.status(400).json({ error: 'Pas en mode spectateur' });
    }
    req.session.userId = req.session.originalUserId;
    delete req.session.originalUserId;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
