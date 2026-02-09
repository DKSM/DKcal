const config = require('../config');

const UNIT_PROMPTS = {
  '100g': 'pour 100g de',
  '100ml': 'pour 100ml de',
  'portion': 'pour',
};

async function estimateNutrition(description, unit = '100g', name = '') {
  if (!config.groqApiKey) {
    throw Object.assign(new Error('Clé API Groq non configurée'), { status: 503 });
  }

  const unitLabel = UNIT_PROMPTS[unit] || UNIT_PROMPTS['100g'];
  const nameCtx = name ? ` (produit : "${name}")` : '';

  const prompt = `${unitLabel} "${description}"${nameCtx}, donne kcal, protéines, lipides et glucides. Toutes les valeurs doivent être cohérentes entre elles (kcal = protein*4 + fat*9 + carbs*4 environ). Réponds UNIQUEMENT : {"kcal":nombre,"protein":nombre,"fat":nombre,"carbs":nombre}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'compound-beta',
      messages: [
        { role: 'system', content: 'Tu es un nutritionniste. Si c\'est un produit de marque, recherche les valeurs exactes sur le site du fabricant ou une base nutritionnelle. Réponds UNIQUEMENT avec {"kcal":X,"protein":X,"fat":X,"carbs":X} — rien d\'autre.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Erreur API Groq: ${response.status}`), { status: 502 });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw Object.assign(new Error('Réponse vide de l\'IA'), { status: 502 });
  }

  // Extract values with individual regex (resilient to truncated JSON)
  const kcalMatch = content.match(/"kcal"\s*:\s*([\d.]+)/);
  const protMatch = content.match(/"protein"\s*:\s*([\d.]+)/);
  const fatMatch = content.match(/"fat"\s*:\s*([\d.]+)/);
  const carbsMatch = content.match(/"carbs"\s*:\s*([\d.]+)/);

  if (!kcalMatch) {
    throw Object.assign(new Error('Réponse IA invalide'), { status: 502 });
  }

  return {
    kcal: Math.round(parseFloat(kcalMatch[1])),
    protein: protMatch ? Math.round(parseFloat(protMatch[1]) * 10) / 10 : 0,
    fat: fatMatch ? Math.round(parseFloat(fatMatch[1]) * 10) / 10 : 0,
    carbs: carbsMatch ? Math.round(parseFloat(carbsMatch[1]) * 10) / 10 : 0,
  };
}

module.exports = { estimateNutrition };
