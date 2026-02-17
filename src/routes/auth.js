const express = require('express');
const bcrypt = require('bcryptjs');
const storage = require('../services/storage');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  const accounts = await storage.readAccounts();
  const account = accounts.find(a => a.username === username);
  if (!account) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }

  req.session.userId = account.id;
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }
  const result = { authenticated: true, isAdmin: false, impersonating: false };
  try {
    const realUserId = req.session.originalUserId || req.session.userId;
    const accounts = await storage.readAccounts();
    const realAccount = accounts.find(a => a.id === realUserId);
    if (realAccount) {
      const admins = await storage.readAdmins();
      result.isAdmin = admins.includes(realAccount.username);
    }
    if (req.session.originalUserId) {
      result.impersonating = true;
      const targetAccount = accounts.find(a => a.id === req.session.userId);
      result.impersonatingUsername = targetAccount ? targetAccount.username : 'inconnu';
    }
  } catch { /* ignore, defaults are safe */ }
  res.json(result);
});

module.exports = router;
