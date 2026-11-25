import { useEffect, useRef, useState } from 'react';
import { Flame, ShoppingBag } from 'lucide-react';
import { INGREDIENTS } from '../../config/ingredients';
import type { ProfileId } from '../../config/profiles';
import { RECIPE_LIST, type RecipeDef } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { canCookRecipe } from '../../domain/stationRules';
import { completeCook } from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { ModalDialog } from '../common/ModalDialog';

interface CookingMiniGameProps {
  open: boolean;
  profileId: ProfileId;
  onClose: () => void;
  onOpenMarket: () => void;
}

const HEAT_LOW = 38;
const HEAT_HIGH = 74;

export function CookingMiniGame({
  open,
  profileId,
  onClose,
  onOpenMarket,
}: CookingMiniGameProps) {
  const inventory = useGameStore((s) => s.inventory);
  const pushToast = useGameStore((s) => s.pushToast);

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
      if (res.ok) {
        kitchenAudio.playSuccess();
        kitchenAudio.playCoin();
        pushToast(
          `${selectedRecipe.icon} ${selectedRecipe.name} nefis oldu! +${selectedRecipe.rewardCoins} Coin`,
          'success',
        );
        onClose();
      } else {
        kitchenAudio.playError();
        pushToast('Malzeme eksik — pişirme tamamlanamadı.', 'warn');
        setSelectedRecipe(null);
        completedRef.current = false;
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Update heat: holding flame button heats up, releasing cools down
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

      // Trigger 2 fun stir/flip cues at 35% and 70%
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

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      dismissible={!selectedRecipe}
      icon="🔥"
      title="Ocak"
      subtitle={
        selectedRecipe
          ? `${selectedRecipe.name} pişiyor — ısıyı altın bölgede tut!`
          : 'Pişirmek istediğin tarifi seç'
      }
    >
      {!selectedRecipe ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {RECIPE_LIST.map((recipe) => {
              const ready = canCookRecipe(recipe, inventory);
              return (
                <div
                  key={recipe.id}
                  className="flex flex-col justify-between gap-2.5 rounded-2xl border border-white/10 bg-stone-900/80 p-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl" aria-hidden="true">
                        {recipe.icon}
                      </span>
                      <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-200">
                        +🪙 {recipe.rewardCoins}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-sm font-bold text-amber-50">{recipe.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recipe.requirements.map((req) => {
                        const ing = INGREDIENTS[req.itemId];
                        const have = inventory[req.itemId] ?? 0;
                        const ok = have >= req.qty;
                        return (
                          <span
                            key={req.itemId}
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              ok
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : 'bg-rose-500/20 text-rose-200'
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
                    className="w-full rounded-xl bg-amber-500 py-2 text-xs font-extrabold text-stone-950 transition active:scale-95 disabled:bg-stone-800 disabled:text-stone-500"
                  >
                    {ready ? '🔥 Pişirmeye Başla' : 'Malzeme Hazırla'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-stone-900/50 px-3 py-2 text-xs text-stone-300">
            <span>Eksik malzemen varsa Marketten al, ham sebze/çileği Kesme Tahtasında doğra.</span>
            <button
              type="button"
              onClick={onOpenMarket}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-amber-200"
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" /> Market
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-1">
          {/* Dish Cooking Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-amber-100">
                {selectedRecipe.icon} {selectedRecipe.name} Pişme İlerlemesi
              </span>
              <span className="text-emerald-300">{Math.round(progress)}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Heat Gauge */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">Ocak Isısı</span>
              <span className={inZone ? 'font-bold text-amber-300' : 'text-stone-400'}>
                {inZone ? '✨ Altın Pişirme Bölgesi!' : heat < HEAT_LOW ? 'Isı Düşük' : 'Çok Sıcak!'}
              </span>
            </div>
            <div className="relative h-12 w-full overflow-hidden rounded-2xl border border-white/15 bg-stone-900">
              {/* Golden heat zone */}
              <div
                className="absolute inset-y-0 border-x-2 border-amber-300 bg-amber-400/25"
                style={{ left: `${HEAT_LOW}%`, width: `${HEAT_HIGH - HEAT_LOW}%` }}
              />
              {/* Current heat marker */}
              <div
                className={`absolute inset-y-1 w-3 -translate-x-1/2 rounded-full transition-colors ${
                  inZone ? 'bg-amber-300 shadow-[0_0_14px_#f59e0b]' : 'bg-rose-400'
                }`}
                style={{ left: `${heat}%` }}
              />
            </div>
          </div>

          {/* Touch controls row */}
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
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-sm font-extrabold text-stone-950 shadow-lg select-none active:scale-97"
            >
              <Flame className="h-5 w-5" aria-hidden="true" />
              ATEŞİ AÇ (Basılı Tut)
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
                  ? 'animate-pulse bg-emerald-400 text-stone-950 ring-2 ring-emerald-200'
                  : 'border border-white/10 bg-stone-800/70 text-stone-500'
              }`}
            >
              {cueVisible
                ? `✨ ŞİMDİ ${selectedRecipe.cookActionLabel.toUpperCase()}! (+18%)`
                : `${selectedRecipe.cookActionLabel} Bekleniyor...`}
            </button>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
