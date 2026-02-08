function validateDayUpdate(body) {
  const errors = [];

  if (body.weight !== undefined && body.weight !== null) {
    if (typeof body.weight !== 'number' || body.weight <= 0 || body.weight > 500) {
      errors.push('weight must be a positive number up to 500');
    }
  }

  if (body.entries !== undefined) {
    if (!Array.isArray(body.entries)) {
      errors.push('entries must be an array');
    } else {
      body.entries.forEach((e, i) => {
        if (!e.itemId) errors.push(`entries[${i}].itemId is required`);
        if (typeof e.qty !== 'number' || e.qty <= 0) errors.push(`entries[${i}].qty must be positive`);
        if (!['g', 'ml', 'unit'].includes(e.unitType)) errors.push(`entries[${i}].unitType must be g, ml, or unit`);
      });
    }
  }

  return errors;
}

module.exports = { validateDayUpdate };
