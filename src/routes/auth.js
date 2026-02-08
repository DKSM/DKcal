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

router.get('/me', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.userId) });
});

module.exports = router;
