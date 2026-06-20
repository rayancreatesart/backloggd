'use client';
import { useState, useEffect } from 'react';
import type { GameSuggestion, Category } from '@/lib/types';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

interface Props {
  source?: 'uncategorised' | 'play_later' | 'play_now';
  onClose: () => void;
  onApplied: () => void;
}

const OVERRIDE_OPTIONS: Category[] = ['play_now', 'play_later', 'in_progress', 'dropped', 'dont_bother'];

export default function SuggestCategoriesModal({ source = 'uncategorised', onClose, onApplied }: Props) {
  const [suggestions, setSuggestions] = useState<GameSuggestion[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Category>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/games/suggest?source=${source}`)
      .then(r => r.json())
      .then(data => { setSuggestions(data); setLoading(false); });
  }, [source]);

  function getCategory(s: GameSuggestion): Category {
    return overrides[s.game.id] ?? s.suggested_category;
  }

  function acceptAll() {
    const map: Record<string, Category> = {};
    for (const s of visible) map[s.game.id] = getCategory(s);
    setOverrides(prev => ({ ...prev, ...map }));
  }

  async function apply() {
    setSaving(true);
    await Promise.all(
      visible.map(s =>
        fetch(`/api/games/${s.game.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: getCategory(s) }),
        })
      )
    );
    setSaving(false);
    onApplied();
    onClose();
  }

  const visible = suggestions.filter(s => !dismissed.has(s.game.id));

  const isRerun = source === 'play_later' || source === 'play_now';
  const title = source === 'play_later' ? 'Re-analyse Play Later'
    : source === 'play_now' ? 'Re-analyse Play Now'
    : 'Suggested Categories';
  const subtitle = source === 'play_later'
    ? "Games that should be upgraded to Play Now or moved to Don't Bother"
    : source === 'play_now'
    ? "Games that should be demoted to Play Later or Don't Bother"
    : 'Based on your library — accept, override, or dismiss';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
          >
            ×
          </button>
        </div>

        {/* Legend */}
        {!loading && visible.length > 0 && (
          <div className="flex gap-4 px-6 py-2 border-b border-white/5 flex-shrink-0">
            {(['play_now', 'play_later', 'dont_bother'] as Category[]).map(c => (
              <div key={c} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
                {CATEGORY_LABELS[c]}
              </div>
            ))}
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Analysing your library…</p>
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">✅</p>
              <p>
                {source === 'play_later' ? 'Everything in Play Later looks correctly placed.'
                  : source === 'play_now' ? 'Everything in Play Now looks correctly placed.'
                  : 'No uncategorised games to suggest.'}
              </p>
            </div>
          )}

          {!loading && visible.map(s => {
            const cat = getCategory(s);
            const coverUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${s.game.id}/library_600x900.jpg`;
            const confidence = Math.round(s.confidence * 100);
            const confColor = confidence > 70 ? '#22c55e' : confidence > 45 ? '#f59e0b' : '#6b7280';

            return (
              <div
                key={s.game.id}
                className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0"
              >
                {/* Cover */}
                <img
                  src={coverUrl}
                  alt={s.game.name}
                  className="w-10 h-14 rounded-lg object-cover flex-shrink-0 bg-white/5"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white truncate">{s.game.name}</p>
                    {s.game.game_type && (
                      <span className="text-xs text-purple-400 hidden sm:inline truncate">{s.game.game_type}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{s.reason}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="bg-white/5 rounded-full h-1 w-16">
                      <div className="h-full rounded-full transition-all" style={{ width: `${confidence}%`, backgroundColor: confColor }} />
                    </div>
                    <span className="text-xs" style={{ color: confColor }}>{confidence}%</span>
                  </div>
                </div>

                {/* Category selector */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={cat}
                    onChange={e => setOverrides(prev => ({ ...prev, [s.game.id]: e.target.value as Category }))}
                    className="text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer focus:outline-none transition-colors"
                    style={{
                      backgroundColor: CATEGORY_COLORS[cat] + '22',
                      borderColor: CATEGORY_COLORS[cat] + '66',
                      color: CATEGORY_COLORS[cat],
                    }}
                  >
                    {OVERRIDE_OPTIONS.map(c => (
                      <option key={c} value={c} style={{ backgroundColor: '#1a1a2e', color: 'white' }}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setDismissed(prev => new Set([...prev, s.game.id]))}
                    className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-300 transition text-xs"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!loading && visible.length > 0 && (
          <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between gap-3 flex-shrink-0">
            <button onClick={acceptAll} className="text-sm text-blue-400 hover:text-blue-300 transition">
              Accept all →
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-white/10 rounded-xl text-gray-400 hover:text-white text-sm transition">
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-semibold text-sm transition"
              >
                {saving ? 'Applying…' : `Apply to ${visible.length} game${visible.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
