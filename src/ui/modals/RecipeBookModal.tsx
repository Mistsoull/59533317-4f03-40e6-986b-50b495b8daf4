import { useState } from 'react';
import { CheckCircle2, Clock, Sparkles, Users } from 'lucide-react';
import { INGREDIENTS } from '../../config/ingredients';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPES, RECIPE_LIST, type RecipeId } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { getTranslations } from '../../i18n/translations';
import { confirmRecipeIrl } from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ModalDialog } from '../common/ModalDialog';

interface RecipeBookModalProps {
  open: boolean;
  profileId: ProfileId;
  onClose: () => void;
}

export function RecipeBookModal({ open, profileId, onClose }: RecipeBookModalProps) {
  const [selectedId, setSelectedId] = useState<RecipeId>('menemen');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const inventory = useGameStore((s) => s.inventory);
  const recipesProgress = useGameStore((s) => s.recipes);
  const profiles = useGameStore((s) => s.profiles);
  const pushToast = useGameStore((s) => s.pushToast);

  const lang = useLanguageStore((s) => s.lang);
  const showRealLifeRecipes = useSettingsStore((s) => s.showRealLifeRecipes);
  const t = getTranslations(lang);

  const recipe = RECIPES[selectedId];
  const locRecipe = t.recipes[selectedId];
  const progress = recipesProgress[selectedId];

  const myConfirmed =
    profileId === 'p1' ? progress.irlConfirmedP1 : progress.irlConfirmedP2;
  const partnerId: ProfileId = profileId === 'p1' ? 'p2' : 'p1';
  const partnerConfirmed =
    partnerId === 'p1' ? progress.irlConfirmedP1 : progress.irlConfirmedP2;
  const bothConfirmed = progress.irlConfirmedP1 && progress.irlConfirmedP2;

  const handleConfirmIrl = async (resetCycle = false) => {
    setSubmitting(true);
    kitchenAudio.unlockSync();
    const res = await confirmRecipeIrl(profileId, selectedId, note, resetCycle);
    setSubmitting(false);

    if (res.ok) {
      kitchenAudio.playSuccess();
      setNote('');
      if (res.bothConfirmed) {
        pushToast(t.bothConfirmedToast(locRecipe.name), 'success');
      } else {
        pushToast(t.singleConfirmedToast(locRecipe.name), 'success');
      }
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      icon="📖"
      title={t.recipeBook}
      subtitle={showRealLifeRecipes ? t.recipeBookSubtitle : t.inGameIngredients}
    >
      <div className="grid grid-cols-12 gap-4">
        <nav className="col-span-4 space-y-2" aria-label={t.recipeBook}>
          {RECIPE_LIST.map((r) => {
            const prog = recipesProgress[r.id];
            const active = r.id === selectedId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  kitchenAudio.playTap();
                  setSelectedId(r.id);
                }}
                className={`flex w-full flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition active:scale-98 ${
                  active
                    ? 'border-[#e07a5f] bg-[#e07a5f]/12'
                    : 'ui-surface hover:brightness-98'
                }`}
              >
                <span className="text-sm font-extrabold">
                  <span className="mr-1.5" aria-hidden="true">
                    {r.icon}
                  </span>
                  {t.recipes[r.id].name}
                </span>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="ui-subtle rounded-md px-1.5 py-0.5">
                    {t.inGameCount(prog.inGameCookCount)}
                  </span>
                  {showRealLifeRecipes && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 ${
                        prog.irlCookedCount > 0
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                          : 'ui-subtle ui-muted'
                      }`}
                    >
                      {t.irlCount(prog.irlCookedCount)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        <article className="col-span-8 space-y-3">
          {/* In-game ingredients & tagline */}
          <div className="ui-surface rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#d46548]">
                {t.inGameIngredients}
              </h2>
              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-300">
                {t.rewardLabel(recipe.rewardCoins)}
              </span>
            </div>
            <p className="text-xs ui-muted">{locRecipe.tagline}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recipe.requirements.map((req) => {
                const ing = INGREDIENTS[req.itemId];
                const have = inventory[req.itemId] ?? 0;
                const ok = have >= req.qty;
                return (
                  <span
                    key={req.itemId}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                      ok
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                        : 'ui-subtle ui-muted'
                    }`}
                  >
                    {ing?.icon} {t.ingredients[req.itemId] ?? ing?.name} ({have}/{req.qty})
                  </span>
                );
              })}
            </div>
          </div>

          {/* Real-life recipe + IRL confirmation (toggleable in Settings) */}
          {showRealLifeRecipes && (
            <>
              <div className="ui-surface space-y-2.5 rounded-2xl p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-extrabold">
                    {t.realLifeRecipeTitle(locRecipe.name)}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="ui-subtle inline-flex items-center gap-1 rounded-md px-2 py-0.5">
                      <Clock className="h-3 w-3 text-[#e07a5f]" aria-hidden="true" />
                      {locRecipe.prepTime}
                    </span>
                    <span className="ui-subtle inline-flex items-center gap-1 rounded-md px-2 py-0.5">
                      <Users className="h-3 w-3 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                      {locRecipe.servings}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#d46548]">{t.ingredientsHeading}</h3>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                    {locRecipe.ingredients.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#d46548]">{t.stepsHeading}</h3>
                  <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs">
                    {locRecipe.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                <p className="rounded-xl bg-amber-500/12 px-3 py-2 text-[11px]">
                  ✨ <strong>{t.chefTipHeading}</strong> {locRecipe.chefTip}
                </p>
              </div>

              <div className="space-y-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-700 dark:text-emerald-200">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {t.madeItIrlTitle}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {(['p1', 'p2'] as const).map((pid) => {
                      const confirmed =
                        pid === 'p1' ? progress.irlConfirmedP1 : progress.irlConfirmedP2;
                      const label = profiles[pid]?.displayName ?? PROFILES[pid].defaultName;
                      return (
                        <span
                          key={pid}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${
                            confirmed
                              ? 'bg-emerald-600 text-white'
                              : 'ui-subtle ui-muted'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {progress.irlNote && (
                  <p className="ui-surface rounded-lg px-2.5 py-1.5 text-xs italic">
                    &ldquo;{progress.irlNote}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={120}
                    placeholder={t.notePlaceholder}
                    className="ui-surface flex-1 rounded-xl px-3 py-2 text-xs"
                  />

                  {bothConfirmed ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleConfirmIrl(true)}
                      className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white transition active:scale-95"
                    >
                      {t.madeItAgainBtn}
                    </button>
                  ) : myConfirmed ? (
                    <span className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-200">
                      {t.confirmedWaitingPartner}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleConfirmIrl(false)}
                      className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white transition active:scale-95"
                    >
                      {partnerConfirmed ? t.confirmPartnerBtn : t.confirmFirstBtn}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </article>
      </div>
    </ModalDialog>
  );
}
