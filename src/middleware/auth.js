const storage = require('../services/storage');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

async function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const realUserId = req.session.originalUserId || req.session.userId;
    const accounts = await storage.readAccounts();
    const account = accounts.find(a => a.id === realUserId);
    if (!account) return res.status(401).json({ error: 'Account not found' });
    const admins = await storage.readAdmins();
    if (!admins.includes(account.username)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireAdmin };
