require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  sessionSecret: process.env.SESSION_SECRET || 'dkcal-fallback-secret',
  groqApiKey: process.env.GROQ_API_KEY || '',
};
