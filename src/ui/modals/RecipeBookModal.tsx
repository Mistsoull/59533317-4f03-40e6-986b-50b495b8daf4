import { useState } from 'react';
import { CheckCircle2, Clock, Sparkles, Users } from 'lucide-react';
import { INGREDIENTS } from '../../config/ingredients';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPES, RECIPE_LIST, type RecipeId } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { confirmRecipeIrl } from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
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

  const recipe = RECIPES[selectedId];
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
        pushToast(`🎉 İkiniz de ${recipe.name} tarifini gerçekte onayladınız! +50 Bonus Coin`, 'success');
      } else {
        pushToast(`🍽️ ${recipe.name} "Gerçekte Yaptık" olarak kaydedildi! +30 Coin`, 'success');
      }
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      icon="📖"
      title="Tarif Defteri"
      subtitle="3 tarifin gerçek hayat reçetesi ve Gerçekte Yaptık onayı"
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Left recipe selector */}
        <nav className="col-span-4 space-y-2" aria-label="Tarifler">
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
                className={`flex w-full flex-col items-start gap-1 rounded-2xl border p-3 text-left transition active:scale-98 ${
                  active
                    ? 'border-amber-300/60 bg-amber-500/15 text-amber-50'
                    : 'border-white/8 bg-stone-900/60 text-stone-300 hover:bg-stone-800/70'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-bold">
                    <span className="mr-1.5" aria-hidden="true">
                      {r.icon}
                    </span>
                    {r.name}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded-md bg-stone-950/70 px-1.5 py-0.5 text-amber-200">
                    Oyunda: {prog.inGameCookCount}×
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-semibold ${
                      prog.irlCookedCount > 0
                        ? 'bg-emerald-500/25 text-emerald-200'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    Gerçekte: {prog.irlCookedCount}×
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Right recipe details + IRL confirmation */}
        <article className="col-span-8 space-y-3">
          {/* In-game requirements summary */}
          <div className="rounded-2xl border border-white/10 bg-stone-900/70 p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Oyun İçi Malzemeler
              </h2>
              <span className="text-xs font-bold text-amber-200">
                Ödül: +🪙 {recipe.rewardCoins}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recipe.requirements.map((req) => {
                const ing = INGREDIENTS[req.itemId];
                const have = inventory[req.itemId] ?? 0;
                const ok = have >= req.qty;
                return (
                  <span
                    key={req.itemId}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                      ok
                        ? 'border-emerald-400/35 bg-emerald-950/50 text-emerald-200'
                        : 'border-amber-400/25 bg-stone-950/70 text-stone-300'
                    }`}
                  >
                    {ing?.icon} {ing?.name} ({have}/{req.qty})
                  </span>
                );
              })}
            </div>
          </div>

          {/* Real-life recipe */}
          <div className="rounded-2xl border border-white/10 bg-stone-900/70 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-amber-50">
                Gerçek Hayat Tarifi — {recipe.name}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-stone-300">
                <span className="inline-flex items-center gap-1 rounded-md bg-stone-800 px-2 py-0.5">
                  <Clock className="h-3 w-3 text-amber-300" aria-hidden="true" />
                  {recipe.irl.prepTime}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-stone-800 px-2 py-0.5">
                  <Users className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                  {recipe.irl.servings}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-amber-200/90">Malzemeler</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-stone-200">
                {recipe.irl.ingredients.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold text-amber-200/90">Hazırlanışı</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-stone-200">
                {recipe.irl.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
              ✨ <strong>Şef Notu:</strong> {recipe.irl.chefTip}
            </p>
          </div>

          {/* "Gerçekte Yaptık!" confirmation box */}
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-950/30 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-200">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Gerçekte Yaptık!
              </h2>
              <div className="flex items-center gap-1.5 text-[11px]">
                {(['p1', 'p2'] as const).map((pid) => {
                  const confirmed =
                    pid === 'p1' ? progress.irlConfirmedP1 : progress.irlConfirmedP2;
                  const label = profiles[pid]?.displayName ?? PROFILES[pid].defaultName;
                  return (
                    <span
                      key={pid}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                        confirmed
                          ? 'bg-emerald-500/25 text-emerald-100'
                          : 'bg-stone-800 text-stone-400'
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
              <p className="rounded-lg bg-stone-950/60 px-2.5 py-1.5 text-xs italic text-stone-200">
                &ldquo;{progress.irlNote}&rdquo;
              </p>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={120}
                placeholder="Kısa anı notu (isteğe bağlı)..."
                className="flex-1 rounded-xl border border-white/15 bg-stone-950/75 px-3 py-2 text-xs text-white placeholder:text-stone-500"
              />

              {bothConfirmed ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConfirmIrl(true)}
                  className="shrink-0 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-stone-950 transition active:scale-95"
                >
                  Tekrar Yaptık (+30 🪙)
                </button>
              ) : myConfirmed ? (
                <span className="shrink-0 rounded-xl border border-emerald-400/30 bg-emerald-900/40 px-3 py-2 text-xs font-semibold text-emerald-200">
                  Onayladın ✓ (Partner bekleniyor)
                </span>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleConfirmIrl(false)}
                  className="shrink-0 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-stone-950 transition active:scale-95"
                >
                  {partnerConfirmed
                    ? 'Ben de Onaylıyorum (+50 🪙)'
                    : 'Gerçekte Yaptık! (+30 🪙)'}
                </button>
              )}
            </div>
          </div>
        </article>
      </div>
    </ModalDialog>
  );
}
