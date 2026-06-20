'use client';
import { useState } from 'react';
import type { FilteredGame } from '@/lib/types';
import { AUTO_FILTER_LABELS } from '@/lib/types';

interface Props {
  games: FilteredGame[];
  onDone: () => void;
}

export default function RecommendModal({ games, onDone }: Props) {
  const completedGames = games.filter(g => g.reason === 'likely_completed');
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const current = completedGames[index];

  if (!current || completedGames.length === 0) {
    return null;
  }

  async function answer(recommended: boolean) {
    setSaving(true);
    await fetch(`/api/games/${current.id}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommended }),
    });
    setSaving(false);

    if (index + 1 < completedGames.length) {
      setIndex(i => i + 1);
    } else {
      onDone();
    }
  }

  const coverUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${current.id}/header.jpg`;
  const hrsPlayed = current.playtime_minutes > 0 ? `${Math.round(current.playtime_minutes / 60 * 10) / 10}h` : null;
  const hltbHours = current.hltb_main ? `${current.hltb_main}h to beat` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header image */}
        <div className="relative">
          <img src={coverUrl} alt={current.name} className="w-full h-28 object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] to-transparent" />
          <div className="absolute bottom-3 left-4">
            <h2 className="text-lg font-bold text-white truncate">{current.name}</h2>
            <div className="flex gap-3 text-xs mt-0.5">
              {hrsPlayed && <span className="text-blue-400">{hrsPlayed} played</span>}
              {hltbHours && <span className="text-gray-500">{hltbHours}</span>}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 mb-4">
            <p className="text-xs text-purple-300">
              🏁 {AUTO_FILTER_LABELS['likely_completed']}
            </p>
          </div>

          <p className="text-white font-semibold text-base mb-1">Would you recommend this to someone?</p>
          <p className="text-gray-400 text-xs mb-5">
            Your answer helps rank similar types of games for future recommendations.
          </p>

          {current.steam_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {current.steam_tags.slice(0, 5).map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-white/5 rounded-full text-xs text-gray-400 border border-white/10">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => answer(false)}
              disabled={saving}
              className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-300 font-medium text-sm transition"
            >
              👎 No
            </button>
            <button
              onClick={() => answer(true)}
              disabled={saving}
              className="flex-1 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-300 font-medium text-sm transition"
            >
              👍 Yes
            </button>
          </div>

          {completedGames.length > 1 && (
            <p className="text-center text-xs text-gray-600 mt-3">
              {index + 1} of {completedGames.length} completed games
            </p>
          )}

          <button onClick={onDone} className="mt-3 w-full text-xs text-gray-600 hover:text-gray-400 transition">
            Skip all →
          </button>
        </div>
      </div>
    </div>
  );
}
