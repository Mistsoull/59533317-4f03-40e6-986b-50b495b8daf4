import { INGREDIENTS, PREPPABLE_ITEMS, type IngredientDef } from '../config/ingredients';
import type { ProfileId } from '../config/profiles';
import type { RecipeDef } from '../config/recipes';

export interface StationLockSnapshot {
  lockedBy: ProfileId | null;
  lockExpiresAt: string | null;
}

export function isStationLockedByOther(
  station: StationLockSnapshot | undefined,
  myProfileId: ProfileId | null,
  nowMs = Date.now(),
): boolean {
  if (!station || !station.lockedBy) return false;
  if (station.lockedBy === myProfileId) return false;
  if (!station.lockExpiresAt) return true;
  return new Date(station.lockExpiresAt).getTime() > nowMs;
}

export function getPreppableRawItems(
  inventory: Record<string, number>,
): Array<{ raw: IngredientDef; target: IngredientDef; rawQty: number; preppedQty: number }> {
  return PREPPABLE_ITEMS.map((raw) => {
    const target = INGREDIENTS[raw.prepTargetId!];
    return {
      raw,
      target,
      rawQty: inventory[raw.id] ?? 0,
      preppedQty: inventory[target.id] ?? 0,
    };
  });
}

export function getMissingRecipeItems(
  recipe: RecipeDef,
  inventory: Record<string, number>,
): Array<{ item: IngredientDef; have: number; need: number }> {
  const missing: Array<{ item: IngredientDef; have: number; need: number }> = [];
  for (const req of recipe.requirements) {
    const have = inventory[req.itemId] ?? 0;
    if (have < req.qty) {
      const item = INGREDIENTS[req.itemId];
      if (item) {
        missing.push({ item, have, need: req.qty });
      }
    }
  }
  return missing;
}

export function canCookRecipe(
  recipe: RecipeDef,
  inventory: Record<string, number>,
): boolean {
  return getMissingRecipeItems(recipe, inventory).length === 0;
}

/**
 * Prevents economic soft-lock when coins < 30 and no recipe can be cooked or prepped.
 */
export function needsPantrySupport(
  coins: number,
  inventory: Record<string, number>,
  recipes: readonly RecipeDef[],
): boolean {
  if (coins >= 30) return false;
  const anyCookable = recipes.some((r) => canCookRecipe(r, inventory));
  if (anyCookable) return false;

  // Check if prepping currently owned raw items could still unlock a recipe
  const simulated = { ...inventory };
  for (const item of PREPPABLE_ITEMS) {
    const qty = simulated[item.id] ?? 0;
    if (qty > 0 && item.prepTargetId) {
      simulated[item.prepTargetId] = (simulated[item.prepTargetId] ?? 0) + qty;
    }
  }
  return !recipes.some((r) => canCookRecipe(r, simulated));
}
