const storage = require('./storage');

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calculateItem(itemId, qty, unitType, itemsMap, visited = new Set(), depth = 0) {
  // Guard: max depth
  if (depth > 10) {
    return { kcal: null, protein: null };
  }

  // Guard: cycle detection
  if (visited.has(itemId)) {
    return { kcal: null, protein: null };
  }

  // Guard: item exists
  const item = itemsMap.get(itemId);
  if (!item) {
    return { kcal: null, protein: null };
  }

  const branchVisited = new Set(visited);
  branchVisited.add(itemId);

  switch (item.mode) {
    case 'per_100': {
      const factor = qty / 100;
      return {
        kcal: item.kcal_100 != null ? round2(item.kcal_100 * factor) : null,
        protein: item.protein_100 != null ? round2(item.protein_100 * factor) : null,
      };
    }

    case 'per_unit': {
      const factor = unitType === 'unit' ? qty : qty;
      return {
        kcal: item.kcal_unit != null ? round2(item.kcal_unit * factor) : null,
        protein: item.protein_unit != null ? round2(item.protein_unit * factor) : null,
      };
    }

    case 'composite': {
      let totalKcal = 0;
      let totalProtein = 0;
      let hasAnyKcal = false;
      let hasAnyProtein = false;

      if (Array.isArray(item.components)) {
        for (const comp of item.components) {
          const result = calculateItem(
            comp.itemId,
            comp.qty,
            comp.unitType,
            itemsMap,
            branchVisited,
            depth + 1
          );

          if (result.kcal != null) {
            totalKcal += result.kcal;
            hasAnyKcal = true;
          }
          if (result.protein != null) {
            totalProtein += result.protein;
            hasAnyProtein = true;
          }
        }
      }

      return {
        kcal: hasAnyKcal ? round2(totalKcal * qty) : null,
        protein: hasAnyProtein ? round2(totalProtein * qty) : null,
      };
    }

    default:
      return { kcal: null, protein: null };
  }
}

async function computeEntryNutrition(userId, itemId, qty, unitType) {
  const items = await storage.readItems(userId);
  const itemsMap = new Map(items.map(i => [i.id, i]));
  return calculateItem(itemId, qty, unitType, itemsMap);
}

function computeItemNutrition(item, itemsMap) {
  if (item.mode === 'per_100') {
    return { kcal: item.kcal_100, protein: item.protein_100 || null };
  }
  if (item.mode === 'per_unit') {
    return { kcal: item.kcal_unit, protein: item.protein_unit || null };
  }
  if (item.mode === 'composite') {
    return calculateItem(item.id, 1, 'unit', itemsMap);
  }
  return { kcal: null, protein: null };
}

module.exports = { calculateItem, computeEntryNutrition, computeItemNutrition, round2 };
