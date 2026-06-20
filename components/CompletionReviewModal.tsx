'use client';
import { useState } from 'react';
import type { Game, CompletionReview } from '@/lib/types';

interface Props {
  game: Game;
  onClose: () => void;
  onSaved: (review: CompletionReview) => void;
}

type Step = 'enjoyed' | 'play_again' | 'recommended' | 'done';

export default function CompletionReviewModal({ game, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('enjoyed');
  const [review, setReview] = useState<Partial<CompletionReview>>({});
  const [saving, setSaving] = useState(false);

  const coverUrl = game.source === 'psn'
    ? (game.sgdb_cover_url ?? null)
    : `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;

  function answer(key: keyof CompletionReview, value: string) {
    const updated = { ...review, [key]: value } as Partial<CompletionReview>;
    setReview(updated);

    const next: Record<Step, Step> = {
      enjoyed: 'play_again',
      play_again: 'recommended',
      recommended: 'done',
      done: 'done',
    };
    setStep(next[step]);

    if (next[step] === 'done') {
      submit(updated as CompletionReview);
    }
  }

  async function submit(finalReview: CompletionReview) {
    setSaving(true);
    await fetch(`/api/games/${game.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_review: finalReview }),
    });
    setSaving(false);
    onSaved(finalReview);
    onClose();
  }

  const steps = ['enjoyed', 'play_again', 'recommended'];
  const stepIndex = steps.indexOf(step);
  const progress = step === 'done' ? 100 : (stepIndex / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#240E1A] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="h-1 bg-white/5">
          <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Game header */}
        <div className="relative h-28 bg-gradient-to-br from-[#370C28] to-[#160812]">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={game.name}
              className="w-full h-full object-cover opacity-30"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-gray-300 hover:text-white transition"
          >
            ×
          </button>
          <div className="absolute bottom-3 left-4">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs text-purple-400 font-medium uppercase tracking-wide">Completed ✓</span>
            </div>
            <h2 className="text-lg font-bold text-white truncate">{game.name}</h2>
          </div>
        </div>

        {/* Questions */}
        <div className="p-5">
          {step === 'enjoyed' && (
            <ReviewStep
              question="Did you enjoy it?"
              options={[
                { label: 'Yeah, loved it', value: 'yes', icon: '😄' },
                { label: 'It was okay', value: 'mixed', icon: '😐' },
                { label: "Not really", value: 'no', icon: '😞' },
              ]}
              onPick={v => answer('enjoyed', v)}
            />
          )}

          {step === 'play_again' && (
            <ReviewStep
              question="Would you play it again?"
              options={[
                { label: 'Absolutely', value: 'yes', icon: '🔁' },
                { label: 'Maybe someday', value: 'maybe', icon: '🤔' },
                { label: "Probably not", value: 'no', icon: '🚫' },
              ]}
              onPick={v => answer('play_again', v)}
            />
          )}

          {step === 'recommended' && (
            <ReviewStep
              question="Would you recommend it to someone?"
              hint="Your answer helps rank similar games in your library"
              options={[
                { label: 'Yes, 100%', value: 'yes', icon: '👍' },
                { label: "I wouldn't", value: 'no', icon: '👎' },
              ]}
              onPick={v => answer('recommended', v)}
            />
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              {saving
                ? <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
                : <p className="text-gray-400 text-sm">Saving…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  question, hint, options, onPick,
}: {
  question: string;
  hint?: string;
  options: { label: string; value: string; icon: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-white font-semibold text-base mb-1">{question}</p>
      {hint ? <p className="text-xs text-blue-400 mb-4">{hint}</p> : <div className="mb-4" />}
      <div className="flex flex-col gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onPick(opt.value)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-left transition group"
          >
            <span className="text-xl">{opt.icon}</span>
            <span className="text-sm text-gray-200 group-hover:text-white font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
