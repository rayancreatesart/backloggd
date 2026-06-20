'use client';
import { useState } from 'react';
import type { Game, DroppedReview } from '@/lib/types';

interface Props {
  game: Game;
  onClose: () => void;
  onSaved: (review: DroppedReview) => void;
}

type Step = 'reason' | 'enjoyed' | 'recommended';

const STEPS: Step[] = ['reason', 'enjoyed', 'recommended'];

export default function DroppedReviewModal({ game, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('reason');
  const [review, setReview] = useState<Partial<DroppedReview>>({});
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex) / STEPS.length) * 100;

  async function answer(key: keyof DroppedReview, value: string) {
    const updated = { ...review, [key]: value } as DroppedReview;
    setReview(updated);

    if (step === 'recommended') {
      // Last question — save
      setSaving(true);
      await fetch(`/api/games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropped_review: updated }),
      });
      setSaving(false);
      onSaved(updated);
    } else {
      setStep(STEPS[stepIndex + 1]);
    }
  }

  const coverUrl = game.source === 'psn'
    ? (game.sgdb_cover_url ?? null)
    : `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#240E1A] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Game header */}
        <div className="relative h-28 bg-gradient-to-br from-[#370C28] to-[#160812]">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={game.name}
              className="w-full h-full object-cover opacity-20"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-gray-300 hover:text-white transition"
          >
            ×
          </button>
          <div className="absolute bottom-3 left-4 right-12">
            <p className="text-xs text-red-400 mb-0.5 font-medium">Dropped</p>
            <h2 className="text-lg font-bold text-white truncate">{game.name}</h2>
          </div>
        </div>

        {/* Questions */}
        <div className="p-6">
          {step === 'reason' && (
            <Question
              question="Why did you stop playing?"
              hint="Helps us understand what kinds of games work for you"
              options={[
                { label: "It wasn't my type of game", value: 'not_my_type', icon: '🚫' },
                { label: 'It got too hard or frustrating', value: 'too_hard', icon: '😤' },
                { label: 'I just ran out of time', value: 'ran_out_of_time', icon: '⏰' },
              ]}
              onPick={v => answer('reason', v)}
            />
          )}

          {step === 'enjoyed' && (
            <Question
              question="Did you enjoy the time you spent with it?"
              hint="Even if you stopped, did you get something out of it?"
              options={[
                { label: 'Yes, I enjoyed what I played', value: 'yes', icon: '👍' },
                { label: "Not really, it wasn't for me", value: 'no', icon: '👎' },
              ]}
              onPick={v => answer('enjoyed', v)}
            />
          )}

          {step === 'recommended' && (
            <Question
              question="Would you recommend it to someone who likes this type of game?"
              hint="Helps rank similar games in your library"
              options={[
                { label: 'Yes, others would probably enjoy it', value: 'yes', icon: '✅' },
                { label: "Hard to say — depends on the person", value: 'maybe', icon: '🤷' },
                { label: "No, I wouldn't recommend it", value: 'no', icon: '❌' },
              ]}
              onPick={v => answer('recommended', v)}
              loading={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Question({
  question,
  hint,
  options,
  onPick,
  loading,
}: {
  question: string;
  hint?: string;
  options: { label: string; value: string; icon: string }[];
  onPick: (v: string) => void;
  loading?: boolean;
}) {
  return (
    <div>
      <p className="text-white font-semibold text-base mb-1">{question}</p>
      {hint && <p className="text-xs text-gray-500 mb-4">{hint}</p>}
      <div className="flex flex-col gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => !loading && onPick(opt.value)}
            disabled={loading}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-left transition group disabled:opacity-50"
          >
            <span className="text-xl">{opt.icon}</span>
            <span className="text-sm text-gray-200 group-hover:text-white font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
