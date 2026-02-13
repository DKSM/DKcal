const config = require('../config');

const UNIT_PROMPTS = {
  '100g': 'pour 100g de',
  '100ml': 'pour 100ml de',
  'portion': 'Donne les valeurs nutritionnelles de',
};

const SYSTEM_PROMPT = `Tu es un assistant nutritionniste bienveillant qui parle en FRANÇAIS. Tu tutoies l'utilisateur.

Règles strictes :
- Si un aliment est décrit comme "cuit" ou "cuite", utilise les valeurs APRÈS cuisson (pâtes cuites ~130 kcal/100g, pas 350).
- Si c'est un produit de marque, recherche les valeurs exactes sur le site du fabricant ou une base nutritionnelle comme OpenFoodFacts.
- Additionne les valeurs de chaque ingrédient séparément.
- Vérifie la cohérence : kcal ≈ protein×4 + fat×9 + carbs×4.

Format de réponse OBLIGATOIRE (JSON uniquement, rien d'autre) :
{
  "kcal": nombre,
  "protein": nombre,
  "fat": nombre,
  "carbs": nombre,
  "summary": "1-2 phrases en français, ton naturel. D'où viennent ces chiffres, confiance ou pas.",
  "details": "En français, 80-150 mots MAX. Va droit au but : quelle source (avec URL si possible), quel calcul si tu as adapté un poids/quantité. Pas de conseil diététique, pas de cours. Sois concis."
}`;

const SYSTEM_PROMPT_IMAGE = `Tu es un assistant nutritionniste bienveillant expert en lecture d'étiquettes nutritionnelles et en estimation visuelle de plats. Tu parles en FRANÇAIS et tu tutoies l'utilisateur.

Règles strictes :
- Si l'image montre une étiquette nutritionnelle, lis les valeurs exactes.
- Si l'image montre un plat ou aliment, estime les valeurs.
- Vérifie la cohérence : kcal ≈ protein×4 + fat×9 + carbs×4.

Format de réponse OBLIGATOIRE (JSON uniquement, rien d'autre) :
{
  "kcal": nombre,
  "protein": nombre,
  "fat": nombre,
  "carbs": nombre,
  "summary": "1-2 phrases en français, ton naturel. Ce que tu vois et d'où viennent ces chiffres.",
  "details": "En français, 80-150 mots MAX. Va droit au but : ce que tu as lu/vu sur l'image, quelle source. Pas de conseil diététique, pas de cours. Sois concis."
}`;

const SYSTEM_PROMPT_CHAT = `Tu es un assistant nutritionniste bienveillant qui parle en FRANÇAIS. Tu tutoies l'utilisateur.

L'utilisateur a demandé une estimation nutritionnelle et discute avec toi pour la corriger ou la préciser.

CHOIX DU FORMAT DE RÉPONSE :

1) Si l'utilisateur te donne de NOUVELLES INFORMATIONS (ingrédients, quantités, recette) ou DEMANDE EXPLICITEMENT un recalcul → réponds en JSON :
{"kcal":nombre,"protein":nombre,"fat":nombre,"carbs":nombre,"summary":"1-2 phrases"}

2) Pour TOUT LE RESTE (explication, détail, ventilation par ingrédient, question générale, comparaison) → réponds en TEXTE LIBRE en français. Pas de JSON. Écris naturellement, utilise des listes à puces, des chiffres, sois précis et utile. Tu peux utiliser le markdown simple (gras avec **, listes avec -).

Règles :
- En JSON, vérifie la cohérence : kcal ≈ protein×4 + fat×9 + carbs×4.
- En texte libre, tu peux détailler autant que nécessaire.
- Sois concis mais complet.`;

async function estimateNutrition(description, unit = '100g', name = '') {
  if (!config.groqApiKey) {
    throw Object.assign(new Error('Clé API Groq non configurée'), { status: 503 });
  }

  const unitLabel = UNIT_PROMPTS[unit] || UNIT_PROMPTS['100g'];
  const nameCtx = name ? ` (produit : "${name}")` : '';

  const prompt = `${unitLabel} "${description}"${nameCtx}. Toutes les valeurs doivent être cohérentes (kcal ≈ protein×4 + fat×9 + carbs×4). Réponds UNIQUEMENT en JSON : {"kcal":nombre,"protein":nombre,"fat":nombre,"carbs":nombre,"summary":"résumé court","details":"explication détaillée"}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'compound-beta',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
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

  return parseEstimateResponse(content);
}

function parseEstimateResponse(content) {
  // Try JSON.parse first for clean responses
  let parsed = null;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { /* fallback to regex */ }

  if (parsed && parsed.kcal != null) {
    return {
      kcal: Math.round(parsed.kcal),
      protein: parsed.protein != null ? Math.round(parsed.protein * 10) / 10 : 0,
      fat: parsed.fat != null ? Math.round(parsed.fat * 10) / 10 : 0,
      carbs: parsed.carbs != null ? Math.round(parsed.carbs * 10) / 10 : 0,
      summary: parsed.summary || null,
      details: parsed.details || null,
    };
  }

  // Regex fallback
  const kcalMatch = content.match(/"kcal"\s*:\s*([\d.]+)/);
  const protMatch = content.match(/"protein"\s*:\s*([\d.]+)/);
  const fatMatch = content.match(/"fat"\s*:\s*([\d.]+)/);
  const carbsMatch = content.match(/"carbs"\s*:\s*([\d.]+)/);
  const summaryMatch = content.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const detailsMatch = content.match(/"details"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (!kcalMatch) {
    throw Object.assign(new Error('Réponse IA invalide'), { status: 502 });
  }

  return {
    kcal: Math.round(parseFloat(kcalMatch[1])),
    protein: protMatch ? Math.round(parseFloat(protMatch[1]) * 10) / 10 : 0,
    fat: fatMatch ? Math.round(parseFloat(fatMatch[1]) * 10) / 10 : 0,
    carbs: carbsMatch ? Math.round(parseFloat(carbsMatch[1]) * 10) / 10 : 0,
    summary: summaryMatch ? summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null,
    details: detailsMatch ? detailsMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null,
  };
}

async function estimateFromImage(imageBase64, unit = '100g', name = '') {
  if (!config.groqApiKey) {
    throw Object.assign(new Error('Clé API Groq non configurée'), { status: 503 });
  }

  const unitLabel = UNIT_PROMPTS[unit] || UNIT_PROMPTS['100g'];
  const nameCtx = name ? ` (produit : "${name}")` : '';

  const textContent = `Analyse cette image${nameCtx}. Si c'est une étiquette nutritionnelle, lis les valeurs ${unitLabel} le produit. Si c'est un plat ou un produit visible, estime les valeurs ${unitLabel} ce que tu vois. Toutes les valeurs doivent être cohérentes (kcal ≈ protein×4 + fat×9 + carbs×4). Réponds UNIQUEMENT en JSON : {"kcal":nombre,"protein":nombre,"fat":nombre,"carbs":nombre,"summary":"résumé court","details":"explication détaillée"}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_IMAGE },
        {
          role: 'user',
          content: [
            { type: 'text', text: textContent },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
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

  return parseEstimateResponse(content);
}

async function estimateChat(messages) {
  if (!config.groqApiKey) {
    throw Object.assign(new Error('Clé API Groq non configurée'), { status: 503 });
  }

  if (messages.length > 100) {
    throw Object.assign(new Error('Limite de messages dépassée'), { status: 400 });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'compound-beta',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_CHAT },
        ...messages,
      ],
      temperature: 0.1,
      max_tokens: 500,
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

  // Try to parse as JSON (nutrition values). If not JSON, return as plain text.
  try {
    return parseEstimateResponse(content);
  } catch {
    return { text: content };
  }
}

module.exports = { estimateNutrition, estimateFromImage, estimateChat };
