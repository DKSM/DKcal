const storage = require('./storage');

function round2(n) {
  return Math.round(n * 100) / 100;
}

const NULL_NUTRITION = { kcal: null, protein: null, fat: null, carbs: null };

function calculateItem(itemId, qty, unitType, itemsMap, visited = new Set(), depth = 0) {
  // Guard: max depth
  if (depth > 10) {
    return { ...NULL_NUTRITION };
  }

  // Guard: cycle detection
  if (visited.has(itemId)) {
    return { ...NULL_NUTRITION };
  }

  // Guard: item exists
  const item = itemsMap.get(itemId);
  if (!item) {
    return { ...NULL_NUTRITION };
  }

  const branchVisited = new Set(visited);
  branchVisited.add(itemId);

  switch (item.mode) {
    case 'per_100': {
      const factor = qty / 100;
      return {
        kcal: item.kcal_100 != null ? round2(item.kcal_100 * factor) : null,
        protein: item.protein_100 != null ? round2(item.protein_100 * factor) : null,
        fat: item.fat_100 != null ? round2(item.fat_100 * factor) : null,
        carbs: item.carbs_100 != null ? round2(item.carbs_100 * factor) : null,
      };
    }

    case 'per_unit': {
      const factor = qty;
      return {
        kcal: item.kcal_unit != null ? round2(item.kcal_unit * factor) : null,
        protein: item.protein_unit != null ? round2(item.protein_unit * factor) : null,
        fat: item.fat_unit != null ? round2(item.fat_unit * factor) : null,
        carbs: item.carbs_unit != null ? round2(item.carbs_unit * factor) : null,
      };
    }

    case 'composite': {
      let totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0;
      let hasKcal = false, hasProtein = false, hasFat = false, hasCarbs = false;

      if (Array.isArray(item.components)) {
        for (const comp of item.components) {
          const result = calculateItem(
            comp.itemId, comp.qty, comp.unitType,
            itemsMap, branchVisited, depth + 1
          );

          if (result.kcal != null) { totalKcal += result.kcal; hasKcal = true; }
          if (result.protein != null) { totalProtein += result.protein; hasProtein = true; }
          if (result.fat != null) { totalFat += result.fat; hasFat = true; }
          if (result.carbs != null) { totalCarbs += result.carbs; hasCarbs = true; }
        }
      }

      return {
        kcal: hasKcal ? round2(totalKcal * qty) : null,
        protein: hasProtein ? round2(totalProtein * qty) : null,
        fat: hasFat ? round2(totalFat * qty) : null,
        carbs: hasCarbs ? round2(totalCarbs * qty) : null,
      };
    }

    default:
      return { ...NULL_NUTRITION };
  }
}

async function computeEntryNutrition(userId, itemId, qty, unitType) {
  const items = await storage.readItems(userId);
  const itemsMap = new Map(items.map(i => [i.id, i]));
  return calculateItem(itemId, qty, unitType, itemsMap);
}

function computeItemNutrition(item, itemsMap) {
  if (item.mode === 'per_100') {
    return {
      kcal: item.kcal_100,
      protein: item.protein_100 || null,
      fat: item.fat_100 || null,
      carbs: item.carbs_100 || null,
    };
  }
  if (item.mode === 'per_unit') {
    return {
      kcal: item.kcal_unit,
      protein: item.protein_unit || null,
      fat: item.fat_unit || null,
      carbs: item.carbs_unit || null,
    };
  }
  if (item.mode === 'composite') {
    return calculateItem(item.id, 1, 'unit', itemsMap);
  }
  return { ...NULL_NUTRITION };
}

module.exports = { calculateItem, computeEntryNutrition, computeItemNutrition, round2 };
