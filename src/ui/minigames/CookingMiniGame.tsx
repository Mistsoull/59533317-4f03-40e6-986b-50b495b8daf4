import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { INGREDIENTS } from '../../config/ingredients';
import type { ProfileId } from '../../config/profiles';
import { RECIPE_LIST, type RecipeDef } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { canCookRecipe } from '../../domain/stationRules';
import { getTranslations } from '../../i18n/translations';
import { completeCook } from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { ModalDialog } from '../common/ModalDialog';

interface CookingMiniGameProps {
  open: boolean;
  profileId: ProfileId;
  onClose: () => void;
}

const HEAT_LOW = 38;
const HEAT_HIGH = 74;

export function CookingMiniGame({
  open,
  profileId,
  onClose,
}: CookingMiniGameProps) {
  const inventory = useGameStore((s) => s.inventory);
  const orders = useGameStore((s) => s.orders);
  const pushToast = useGameStore((s) => s.pushToast);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDef | null>(null);
  const [heat, setHeat] = useState(25);
  const [progress, setProgress] = useState(0);
  const [cueVisible, setCueVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const heatingRef = useRef(false);
  const heatRef = useRef(25);
  const progressRef = useRef(0);
  const cueStageRef = useRef(0);
  const sizzleTimerRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setSelectedRecipe(null);
      setHeat(25);
      setProgress(0);
      setCueVisible(false);
      setSaving(false);
      heatingRef.current = false;
      heatRef.current = 25;
      progressRef.current = 0;
      cueStageRef.current = 0;
      completedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedRecipe || saving) return;

    let rafId = 0;
    let last = performance.now();

    const finishCooking = async () => {
      if (completedRef.current) return;
      completedRef.current = true;
      setSaving(true);
      const res = await completeCook(
        profileId,
        selectedRecipe.id,
        selectedRecipe.requirements,
        selectedRecipe.rewardCoins,
      );
      setSaving(false);
      const curT = getTranslations(useLanguageStore.getState().lang);
      if (res.ok) {
        kitchenAudio.playSuccess();
        kitchenAudio.playBell();
        pushToast(
          curT.cookedReadyToast(
            selectedRecipe.icon,
            curT.recipes[selectedRecipe.id].name,
          ),
          'success',
        );
        onClose();
      } else {
        kitchenAudio.playError();
        pushToast(curT.missingIngredientsToast, 'warn');
        setSelectedRecipe(null);
        completedRef.current = false;
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const deltaHeat = heatingRef.current ? 46 * dt : -30 * dt;
      const nextHeat = Math.max(5, Math.min(98, heatRef.current + deltaHeat));
      heatRef.current = nextHeat;
      setHeat(nextHeat);

      const inSweetZone = nextHeat >= HEAT_LOW && nextHeat <= HEAT_HIGH;
      if (inSweetZone) {
        progressRef.current = Math.min(100, progressRef.current + 13.5 * dt);
        setProgress(progressRef.current);

        sizzleTimerRef.current += dt;
        if (sizzleTimerRef.current > 0.75) {
          sizzleTimerRef.current = 0;
          kitchenAudio.playSizzle();
        }
      }

      if (cueStageRef.current === 0 && progressRef.current >= 32) {
        cueStageRef.current = 1;
        setCueVisible(true);
      } else if (cueStageRef.current === 2 && progressRef.current >= 68) {
        cueStageRef.current = 3;
        setCueVisible(true);
      }

      if (progressRef.current >= 100) {
        void finishCooking();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [open, selectedRecipe, saving, profileId, onClose, pushToast]);

  const handleActionCue = () => {
    if (!cueVisible) return;
    kitchenAudio.unlockSync();
    kitchenAudio.playFlip();
    setCueVisible(false);
    cueStageRef.current += 1;
    progressRef.current = Math.min(100, progressRef.current + 18);
    setProgress(progressRef.current);
  };

  const inZone = heat >= HEAT_LOW && heat <= HEAT_HIGH;
  const locSelected = selectedRecipe ? t.recipes[selectedRecipe.id] : null;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      dismissible={!selectedRecipe}
      icon="🔥"
      title={t.stations.stove.label}
      subtitle={
        locSelected
          ? t.stoveActiveSub(locSelected.name)
          : t.stoveSelectSub
      }
    >
      {!selectedRecipe ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {RECIPE_LIST.map((recipe) => {
              const ready = canCookRecipe(recipe, inventory);
              const waitingCount = orders.filter(
                (o) => o.status === 'waiting' && o.recipeId === recipe.id,
              ).length;
              const cookedHave = inventory[recipe.cookedItemId] ?? 0;
              const diffColor =
                recipe.difficulty === 'easy'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                  : recipe.difficulty === 'medium'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-200'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-200';
              return (
                <div
                  key={recipe.id}
                  className={`ui-surface flex flex-col justify-between gap-2.5 rounded-2xl p-3 ${
                    waitingCount > 0 ? 'ring-2 ring-amber-500/60' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-2xl" aria-hidden="true">
                        {recipe.icon}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-extrabold ${diffColor}`}>
                          {t.difficultyLabels[recipe.difficulty]} · {recipe.baseDeliverySeconds}s
                        </span>
                        <span className="rounded-lg bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-200">
                          🪙 {recipe.rewardCoins}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <h2 className="text-sm font-extrabold leading-tight">
                        {t.recipes[recipe.id].name}
                      </h2>
                      {waitingCount > 0 && (
                        <span className="animate-pulse rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white whitespace-nowrap">
                          {t.ordersWaitingBadge(waitingCount)}
                        </span>
                      )}
                    </div>
                    {cookedHave > 0 && (
                      <p className="mt-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        {t.cookedInStockShort(cookedHave)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recipe.requirements.map((req) => {
                        const ing = INGREDIENTS[req.itemId];
                        const have = inventory[req.itemId] ?? 0;
                        const ok = have >= req.qty;
                        return (
                          <span
                            key={req.itemId}
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              ok
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-200'
                            }`}
                          >
                            {ing?.icon} {have}/{req.qty}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => {
                      kitchenAudio.unlockSync();
                      kitchenAudio.playTap();
                      heatRef.current = 30;
                      progressRef.current = 0;
                      cueStageRef.current = 0;
                      completedRef.current = false;
                      setHeat(30);
                      setProgress(0);
                      setCueVisible(false);
                      setSelectedRecipe(recipe);
                    }}
                    className="w-full rounded-xl bg-[#e07a5f] py-2 text-xs font-extrabold text-white transition active:scale-95 disabled:opacity-40"
                  >
                    {ready ? t.startCooking : t.prepareIngredients}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="ui-surface rounded-xl px-3 py-2 text-xs ui-muted">
            {t.stoveMarketHint}
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-1">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-extrabold">
              <span>
                {t.cookProgressLabel(selectedRecipe.icon, locSelected!.name)}
              </span>
              <span className="text-emerald-600 dark:text-emerald-300">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="ui-subtle h-4 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="ui-muted font-semibold">{t.stoveHeatLabel}</span>
              <span
                className={
                  inZone ? 'font-extrabold text-amber-600 dark:text-amber-300' : 'ui-muted'
                }
              >
                {inZone ? t.heatGolden : heat < HEAT_LOW ? t.heatLow : t.heatHigh}
              </span>
            </div>
            <div className="ui-subtle relative h-12 w-full overflow-hidden rounded-2xl border border-amber-500/30">
              <div
                className="absolute inset-y-0 border-x-2 border-amber-500 bg-amber-400/30"
                style={{ left: `${HEAT_LOW}%`, width: `${HEAT_HIGH - HEAT_LOW}%` }}
              />
              <div
                className={`absolute inset-y-1 w-3 -translate-x-1/2 rounded-full transition-colors ${
                  inZone ? 'bg-amber-500 shadow-[0_0_14px_#f59e0b]' : 'bg-rose-500'
                }`}
                style={{ left: `${heat}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={saving}
              onPointerDown={(e) => {
                e.preventDefault();
                kitchenAudio.unlockSync();
                heatingRef.current = true;
              }}
              onPointerUp={() => {
                heatingRef.current = false;
              }}
              onPointerLeave={() => {
                heatingRef.current = false;
              }}
              onPointerCancel={() => {
                heatingRef.current = false;
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-sm font-extrabold text-white shadow-lg select-none active:scale-97"
            >
              <Flame className="h-5 w-5" aria-hidden="true" />
              {t.holdFlameBtn}
            </button>

            <button
              type="button"
              disabled={!cueVisible || saving}
              onPointerDown={(e) => {
                e.preventDefault();
                handleActionCue();
              }}
              className={`rounded-2xl py-4 text-sm font-extrabold shadow-lg transition active:scale-95 ${
                cueVisible
                  ? 'animate-pulse bg-emerald-600 text-white ring-2 ring-emerald-300'
                  : 'ui-subtle ui-muted'
              }`}
            >
              {cueVisible
                ? t.nowActionBtn(locSelected!.cookActionLabel)
                : t.waitingActionBtn(locSelected!.cookActionLabel)}
            </button>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
