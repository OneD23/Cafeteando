const roundQuantity = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000;

const normalizeRecipeItems = (items = []) => items.map((item) => ({
  ingredientId: String(item.ingredientId || item.ingredient || item._id),
  quantity: Number(item.quantity || 0),
}));

const expandIngredientRequirements = async (items = [], { loadIngredient, path = [] } = {}) => {
  if (typeof loadIngredient !== 'function') {
    throw new Error('loadIngredient es obligatorio para expandir ingredientes compuestos');
  }

  const totals = new Map();
  const details = [];

  const visit = async (ingredientId, quantity, currentPath) => {
    if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0) return;
    if (currentPath.includes(ingredientId)) {
      throw new Error('La composición de ingredientes no puede tener ciclos');
    }

    const ingredient = await loadIngredient(ingredientId);
    if (!ingredient) {
      throw new Error('Ingrediente no encontrado en composición');
    }

    const components = Array.isArray(ingredient.components) ? ingredient.components.filter((component) => component?.ingredientId && component.quantity > 0) : [];
    if (!components.length) {
      const key = String(ingredient._id || ingredientId);
      const previous = totals.get(key) || { ingredient, quantity: 0 };
      previous.quantity = roundQuantity(previous.quantity + quantity);
      totals.set(key, previous);
      details.push({ ingredient, quantity: roundQuantity(quantity), path: [...currentPath, key] });
      return;
    }

    const nextPath = [...currentPath, String(ingredient._id || ingredientId)];
    for (const component of components) {
      await visit(String(component.ingredientId), roundQuantity(quantity * Number(component.quantity || 0)), nextPath);
    }
  };

  for (const item of normalizeRecipeItems(items)) {
    await visit(item.ingredientId, item.quantity, path.map(String));
  }

  return {
    requirements: Array.from(totals.values()).map((row) => ({ ...row, quantity: roundQuantity(row.quantity) })),
    details,
  };
};

const calculateCompositeUnitCost = async (ingredient, { loadIngredient } = {}) => {
  const components = Array.isArray(ingredient?.components) ? ingredient.components.filter((component) => component?.ingredientId && component.quantity > 0) : [];
  if (!components.length) return Number(ingredient?.costPerUnit || 0);
  const { requirements } = await expandIngredientRequirements(components, { loadIngredient, path: [String(ingredient._id)] });
  return Math.round((requirements.reduce((sum, row) => sum + (Number(row.ingredient.costPerUnit || 0) * row.quantity), 0) + Number.EPSILON) * 1000000) / 1000000;
};

module.exports = {
  roundQuantity,
  expandIngredientRequirements,
  calculateCompositeUnitCost,
};
