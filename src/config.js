require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  appPassword: process.env.APP_PASSWORD || 'changeme',
  sessionSecret: process.env.SESSION_SECRET || 'dkcal-fallback-secret',
  groqApiKey: process.env.GROQ_API_KEY || '',
  dataDir: require('path').join(__dirname, '..', 'data', 'users', 'default'),
};
