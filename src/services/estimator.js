const config = require('../config');

const UNIT_PROMPTS = {
  '100g': 'pour 100g de',
  '100ml': 'pour 100ml de',
  'portion': 'Donne les valeurs nutritionnelles de',
};

const SYSTEM_PROMPT = `Tu es un assistant nutritionniste bienveillant qui parle en FRANÇAIS. Tu tutoies l'utilisateur.

Règles strictes :
- Si un aliment est décrit comme "cuit" ou "cuite", utilise les valeurs APRÈS cuisson (pâtes cuites ~130 kcal/100g, pas 350).
- Si c'est un produit de marque, base-toi en PRIORITÉ sur les résultats de recherche web fournis. Croise les sources entre elles pour fiabiliser.
- Additionne les valeurs de chaque ingrédient séparément.
- Vérifie la cohérence : kcal ≈ protein×4 + fat×9 + carbs×4.
- ESPRIT CRITIQUE : les résultats de recherche web peuvent contenir des erreurs ou des données pour le mauvais produit. Vérifie que les sources correspondent bien à l'aliment demandé. Si les sources se contredisent, privilégie les bases nutritionnelles officielles (OpenFoodFacts, Ciqual, USDA). Si une source te semble incohérente, ignore-la et signale-le dans le summary.

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

const SYSTEM_PROMPT_EXTRACT = `Tu es un extracteur de macronutriments. On te donne un échange entre un utilisateur et un assistant nutritionniste.

Ta tâche : extraire les valeurs nutritionnelles FINALES de la réponse de l'assistant et les formater.

Réponds UNIQUEMENT en JSON, rien d'autre :
{"kcal":nombre,"protein":nombre,"fat":nombre,"carbs":nombre,"summary":"résumé de 1-2 phrases max, en français, expliquant d'où viennent les chiffres"}

Règles :
- Si l'assistant a donné des macros (même approximatives), extrais-les.
- Si l'assistant a détaillé par ingrédient, ADDITIONNE le tout.
- Si l'assistant n'a donné AUCUNE valeur nutritionnelle (question hors-sujet), réponds : {"no_macros":true}
- Vérifie la cohérence : kcal ≈ protein×4 + fat×9 + carbs×4.`;

// ---------------------------------------------------------------------------
// DKai helper
// ---------------------------------------------------------------------------

async function dkai(messages, options = {}) {
  const res = await fetch(`${config.dkaiUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.dkaiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || `DKai ${res.status}`), { status: 502 });
  }

  return res.json();
}

async function dkaiVision(image, prompt, system, options = {}) {
  const res = await fetch(`${config.dkaiUrl}/api/vision`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.dkaiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image, prompt, system, options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || `DKai vision ${res.status}`), { status: 502 });
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

async function estimateNutrition(description, unit = '100g', name = '') {
  const unitLabel = UNIT_PROMPTS[unit] || UNIT_PROMPTS['100g'];
  const nameCtx = name ? ` (produit : "${name}")` : '';

  const prompt = `${unitLabel} "${description}"${nameCtx}. Toutes les valeurs doivent être cohérentes (kcal ≈ protein×4 + fat×9 + carbs×4). Réponds UNIQUEMENT en JSON : {"kcal":nombre,"protein":nombre,"fat":nombre,"carbs":nombre,"summary":"résumé court","details":"explication détaillée"}`;

  const result = await dkai([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ], {
    web_search: true,
    web_search_depth: 20,
    json_mode: true,
  });

  const parsed = parseEstimateResponse(result.content);
  parsed.provider = result.provider || null;
  parsed.web_sources = result.web_sources || null;
  return parsed;
}

function parseEstimateResponse(content) {
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
  const unitLabel = UNIT_PROMPTS[unit] || UNIT_PROMPTS['100g'];
  const nameCtx = name ? ` (produit : "${name}")` : '';

  const prompt = `Analyse cette image${nameCtx}. Si c'est une étiquette nutritionnelle, lis les valeurs ${unitLabel} le produit. Si c'est un plat ou un produit visible, estime les valeurs ${unitLabel} ce que tu vois. Toutes les valeurs doivent être cohérentes (kcal ≈ protein×4 + fat×9 + carbs×4). Réponds UNIQUEMENT en JSON.`;

  const result = await dkaiVision(imageBase64, prompt, SYSTEM_PROMPT_IMAGE, {
    json_mode: true,
  });

  const parsed = parseEstimateResponse(result.content);
  parsed.provider = result.provider || null;
  parsed.web_sources = result.web_sources || null;
  return parsed;
}

async function estimateChat(messages, conversationId = null) {
  const options = {};

  if (conversationId) {
    options.conversation_id = conversationId;
  } else {
    options.persist = true;
  }

  // Pass 1 — natural response from the AI
  const result = await dkai(messages, options);

  const response = {
    conversation_id: result.conversation_id,
    provider: result.provider || null,
  };

  // If already clean JSON, use it directly
  try {
    Object.assign(response, parseEstimateResponse(result.content));
    return response;
  } catch { /* not JSON, proceed to pass 2 */ }

  response.text = result.content;

  // Pass 2 — extract macros from the text response
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  try {
    const extract = await dkai([
      { role: 'system', content: SYSTEM_PROMPT_EXTRACT },
      { role: 'user', content: `Question de l'utilisateur : "${lastUserMsg?.content || ''}"

Réponse de l'assistant :
${result.content}` },
    ], { json_mode: true });

    const parsed = JSON.parse(extract.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    if (parsed.kcal != null && !parsed.no_macros) {
      response.macros = {
        kcal: Math.round(parsed.kcal),
        protein: parsed.protein != null ? Math.round(parsed.protein * 10) / 10 : 0,
        fat: parsed.fat != null ? Math.round(parsed.fat * 10) / 10 : 0,
        carbs: parsed.carbs != null ? Math.round(parsed.carbs * 10) / 10 : 0,
        summary: parsed.summary || null,
      };
    }
  } catch { /* extraction failed, no macros — that's ok */ }

  return response;
}

module.exports = { estimateNutrition, estimateFromImage, estimateChat };
