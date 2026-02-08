function validateItem(body) {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('name is required');
  }

  if (!['per_100', 'per_unit', 'composite'].includes(body.mode)) {
    errors.push('mode must be per_100, per_unit, or composite');
    return errors;
  }

  const checkOptionalNum = (field, label) => {
    if (body[field] !== undefined && body[field] !== null &&
        (typeof body[field] !== 'number' || body[field] < 0)) {
      errors.push(`${label} must be a non-negative number if provided`);
    }
  };

  if (body.mode === 'per_100') {
    if (typeof body.kcal_100 !== 'number' || body.kcal_100 < 0) {
      errors.push('kcal_100 must be a non-negative number');
    }
    checkOptionalNum('protein_100', 'protein_100');
    checkOptionalNum('fat_100', 'fat_100');
    checkOptionalNum('carbs_100', 'carbs_100');
    if (body.baseUnit && !['g', 'ml'].includes(body.baseUnit)) {
      errors.push('baseUnit must be g or ml');
    }
  }

  if (body.mode === 'per_unit') {
    if (typeof body.kcal_unit !== 'number' || body.kcal_unit < 0) {
      errors.push('kcal_unit must be a non-negative number');
    }
    checkOptionalNum('protein_unit', 'protein_unit');
    checkOptionalNum('fat_unit', 'fat_unit');
    checkOptionalNum('carbs_unit', 'carbs_unit');
  }

  if (body.mode === 'composite') {
    if (!Array.isArray(body.components) || body.components.length === 0) {
      errors.push('composite items must have at least one component');
    } else {
      body.components.forEach((c, i) => {
        if (!c.itemId) errors.push(`component[${i}].itemId is required`);
        if (typeof c.qty !== 'number' || c.qty <= 0) errors.push(`component[${i}].qty must be positive`);
        if (!['g', 'ml', 'unit'].includes(c.unitType)) errors.push(`component[${i}].unitType must be g, ml, or unit`);
      });
    }
  }

  return errors;
}

module.exports = { validateItem };
