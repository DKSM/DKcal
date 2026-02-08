function errorHandler(err, req, res, _next) {
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
