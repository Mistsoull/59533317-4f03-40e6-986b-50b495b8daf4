import { useEffect, useRef, useState } from 'react';
import type { IngredientDef } from '../../config/ingredients';
import type { ProfileId } from '../../config/profiles';
import { kitchenAudio } from '../../domain/audio';
import { getPreppableRawItems } from '../../domain/stationRules';
import { getTranslations } from '../../i18n/translations';
import { completePrep } from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { ModalDialog } from '../common/ModalDialog';

interface ChoppingMiniGameProps {
  open: boolean;
  profileId: ProfileId;
  onClose: () => void;
}

const TARGET_SLICES = 5;
const ZONE_MIN = 36;
const ZONE_MAX = 64;

export function ChoppingMiniGame({
  open,
  profileId,
  onClose,
}: ChoppingMiniGameProps) {
  const inventory = useGameStore((s) => s.inventory);
  const pushToast = useGameStore((s) => s.pushToast);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const [activePair, setActivePair] = useState<{
    raw: IngredientDef;
    target: IngredientDef;
  } | null>(null);
  const [slices, setSlices] = useState(0);
  const [cursorPct, setCursorPct] = useState(50);
  const [feedback, setFeedback] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const cursorRef = useRef(50);
  const dirRef = useRef(1);

  const preppable = getPreppableRawItems(inventory);

  useEffect(() => {
    if (!open) {
      setActivePair(null);
      setSlices(0);
      setFeedback('');
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !activePair || saving) return;

    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const speed = 78 + slices * 10;
      let next = cursorRef.current + dirRef.current * speed * dt;
      if (next >= 96) {
        next = 96;
        dirRef.current = -1;
      } else if (next <= 4) {
        next = 4;
        dirRef.current = 1;
      }
      cursorRef.current = next;
      setCursorPct(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [open, activePair, slices, saving]);

  const handleSliceTap = async () => {
    if (!activePair || saving) return;
    kitchenAudio.unlockSync();

    const pos = cursorRef.current;
    const hit = pos >= ZONE_MIN && pos <= ZONE_MAX;

    if (hit) {
      kitchenAudio.playChop(true);
      const nextSlices = slices + 1;
      setSlices(nextSlices);
      setFeedback(t.chopGreat);

      if (nextSlices >= TARGET_SLICES) {
        setSaving(true);
        const res = await completePrep(profileId, activePair.raw.id, activePair.target.id);
        setSaving(false);
        if (res.ok) {
          kitchenAudio.playSuccess();
          pushToast(
            t.preppedToast(
              activePair.target.icon,
              t.ingredients[activePair.target.id] ?? activePair.target.name,
            ),
            'success',
          );
          onClose();
        } else {
          kitchenAudio.playError();
          pushToast(t.missingRawToast, 'warn');
          setActivePair(null);
        }
      }
    } else {
      kitchenAudio.playChop(false);
      setFeedback(t.chopMiss);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      dismissible={!activePair}
      icon="🔪"
      title={t.stations.cutting_board.label}
      subtitle={
        activePair
          ? t.choppingActiveSub(t.ingredients[activePair.raw.id] ?? activePair.raw.name)
          : t.choppingSelectSub
      }
    >
      {!activePair ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {preppable.map(({ raw, target, rawQty, preppedQty }) => (
              <button
                key={raw.id}
                type="button"
                disabled={rawQty < 1}
                onClick={() => {
                  kitchenAudio.unlockSync();
                  kitchenAudio.playTap();
                  setSlices(0);
                  setFeedback('');
                  setActivePair({ raw, target });
                }}
                className="ui-surface flex items-center justify-between gap-3 rounded-2xl p-3.5 text-left transition active:scale-98 disabled:opacity-45"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">
                    {raw.icon}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold">
                      {t.ingredients[raw.id] ?? raw.name}
                    </p>
                    <p className="text-[11px] ui-muted">
                      {t.rawShort(rawQty)} · {t.readyShort(preppedQty)}
                    </p>
                  </div>
                </div>
                <span className="rounded-xl bg-[#e07a5f] px-3 py-1.5 text-xs font-extrabold text-white">
                  {t.chopBtn}
                </span>
              </button>
            ))}
          </div>

          {preppable.every((p) => p.rawQty === 0) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/12 p-3 text-xs font-semibold">
              {t.noRawToChop}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex items-center gap-2">
            {Array.from({ length: TARGET_SLICES }).map((_, idx) => (
              <span
                key={idx}
                className={`h-3.5 w-10 rounded-full transition ${
                  idx < slices ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'ui-subtle'
                }`}
              />
            ))}
          </div>

          <div className="relative h-16 w-full max-w-lg overflow-hidden rounded-2xl border-2 border-amber-700/60 bg-gradient-to-b from-[#b47c4c] to-[#8f5d34] shadow-inner">
            <div
              className="absolute inset-y-0 border-x-2 border-emerald-300 bg-emerald-400/40"
              style={{ left: `${ZONE_MIN}%`, width: `${ZONE_MAX - ZONE_MIN}%` }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl opacity-85">
              {activePair.raw.icon}
            </div>
            <div
              className="absolute inset-y-1 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]"
              style={{ left: `${cursorPct}%` }}
            />
          </div>

          <p className="h-5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            {feedback || t.chopReadyPrompt}
          </p>

          <button
            type="button"
            disabled={saving}
            onPointerDown={(e) => {
              e.preventDefault();
              void handleSliceTap();
            }}
            className="w-full max-w-sm rounded-2xl bg-emerald-600 py-4 text-base font-extrabold text-white shadow-xl transition active:scale-95"
          >
            {saving ? t.saving : t.chopActionBtn(slices, TARGET_SLICES)}
          </button>
        </div>
      )}
    </ModalDialog>
  );
}
