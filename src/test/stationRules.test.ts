import { describe, expect, it } from 'vitest';
import { RECIPES, RECIPE_LIST } from '../config/recipes';
import {
  canCookRecipe,
  getMissingRecipeItems,
  isStationLockedByOther,
  needsPantrySupport,
} from '../domain/stationRules';

describe('stationRules', () => {
  it('respects station lock owner and TTL expiration', () => {
    const future = new Date(Date.now() + 20_000).toISOString();
    const past = new Date(Date.now() - 5_000).toISOString();

    expect(
      isStationLockedByOther({ lockedBy: 'p2', lockExpiresAt: future }, 'p1'),
    ).toBe(true);
    expect(
      isStationLockedByOther({ lockedBy: 'p1', lockExpiresAt: future }, 'p1'),
    ).toBe(false);
    expect(
      isStationLockedByOther({ lockedBy: 'p2', lockExpiresAt: past }, 'p1'),
    ).toBe(false);
  });

  it('checks recipe readiness and missing prepped ingredients accurately', () => {
    const menemen = RECIPES.menemen;
    expect(
      canCookRecipe(menemen, {
        domates_dogranmis: 1,
        biber_dogranmis: 1,
        yumurta: 1,
      }),
    ).toBe(true);

    const missing = getMissingRecipeItems(menemen, { yumurta: 1 });
    expect(missing.map((m) => m.item.id)).toEqual([
      'domates_dogranmis',
      'biber_dogranmis',
    ]);
  });

  it('detects economic soft-lock so pantry support triggers only when truly stuck', () => {
    expect(needsPantrySupport(10, {}, RECIPE_LIST)).toBe(true);
    expect(needsPantrySupport(50, {}, RECIPE_LIST)).toBe(false);
    // Already cooked dish can be served or sold via sell_cooked_dish -> NOT soft-locked
    expect(needsPantrySupport(10, { dish_menemen: 1 }, RECIPE_LIST)).toBe(false);
    expect(
      needsPantrySupport(
        10,
        { domates: 1, biber: 1, yumurta: 1 },
        RECIPE_LIST,
      ),
    ).toBe(false);
  });
});
