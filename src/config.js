require('dotenv').config();

const sessionSecret = process.env.SESSION_SECRET || 'dkcal-fallback-secret';
if (!process.env.SESSION_SECRET) {
  console.warn('[DKcal] WARNING: SESSION_SECRET non défini, utilisation du secret par défaut. Définir SESSION_SECRET dans .env pour la production.');
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  sessionSecret,
  groqApiKey: process.env.GROQ_API_KEY || '',
};
