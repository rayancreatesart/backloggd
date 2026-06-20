'use client';
import { useState, useEffect, useRef } from 'react';
import type { Game, Category } from '@/lib/types';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

interface Props {
  game: Game;
  onCategoryChange: (id: string, category: Category) => void;
}

const IMG_SOURCES = (id: string) => [
  `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
  `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
  `https://cdn.akamai.steamstatic.com/steam/apps/${id}/capsule_616x353.jpg`,
];

function formatHours(h: number | null): string {
  if (h === null) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return 'Never played';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m played`;
  if (m === 0) return `${h}h played`;
  return `${h}h ${m}m played`;
}

const ALL_CATEGORIES: Category[] = ['in_progress', 'play_now', 'play_later', 'completed', 'dropped', 'dont_bother', 'na', 'uncategorised'];
const IN_PROGRESS_ACTIONS: { category: Category; label: string }[] = [
  { category: 'completed', label: '✓ Mark as Completed' },
  { category: 'dropped',   label: '✗ Drop Game' },
];

export default function GameCard({ game, onCategoryChange }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isPsn = game.source === 'psn';
  const sources = IMG_SOURCES(game.id);
  const [imgIndex, setImgIndex] = useState(0);
  const [sgdbUrl, setSgdbUrl] = useState<string | null>(game.sgdb_cover_url ?? null);
  const [imgFailed, setImgFailed] = useState(isPsn && !game.sgdb_cover_url);
  const [showMenu, setShowMenu] = useState(false);
  const [hltb, setHltb] = useState<{ main: number | null } | null>(
    game.hltb_searched ? { main: game.hltb_main } : null
  );
  const [loadingHltb, setLoadingHltb] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    // Skip if analysis already fetched it, or if already searched
    if (!game.hltb_searched && !game.analysis_done) {
      setLoadingHltb(true);
      fetch(`/api/games/${game.id}/hltb`, { method: 'POST' })
        .then(r => r.json())
        .then(d => { setHltb({ main: d.hltb_main }); setLoadingHltb(false); })
        .catch(() => setLoadingHltb(false));
    }
  }, [game.id, game.hltb_searched, game.analysis_done]);

  const color = CATEGORY_COLORS[game.category];
  const label = CATEGORY_LABELS[game.category];

  return (
    <div ref={cardRef} className="relative group rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl" style={{ background: 'var(--bg-800)' }}>
      {/* Cover image */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {imgFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-2" style={{ background: 'linear-gradient(to bottom, var(--wine-700), var(--bg-900))' }}>
            <span className="text-4xl font-black text-white/10 select-none">
              {game.name.charAt(0).toUpperCase()}
            </span>
            <p className="text-xs text-white/20 text-center leading-tight line-clamp-3">{game.name}</p>
          </div>
        ) : sgdbUrl ? (
          <img
            src={sgdbUrl}
            alt={game.name}
            className="w-full h-full object-cover"
            onError={() => { setSgdbUrl(null); setImgFailed(true); }}
            loading="lazy"
          />
        ) : (
          <img
            key={imgIndex}
            src={sources[imgIndex]}
            alt={game.name}
            className={`w-full h-full ${imgIndex === 0 ? 'object-cover' : 'object-contain bg-[#0d0d1a]'}`}
            onError={() => {
              if (imgIndex < sources.length - 1) {
                setImgIndex(i => i + 1);
              } else {
                fetch(`/api/games/${game.id}/cover`)
                  .then(r => r.json())
                  .then(d => {
                    if (d.url) setSgdbUrl(d.url);
                    else setImgFailed(true);
                  })
                  .catch(() => setImgFailed(true));
              }
            }}
            loading="lazy"
          />
        )}

        {/* Category badge */}
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-lg"
          style={{ backgroundColor: color + 'cc', border: `1px solid ${color}66` }}
        >
          {label}
        </div>

        {/* Platform logo */}
        <div className="absolute top-2 right-2 rounded-lg shadow-lg bg-white px-1.5 py-1 flex items-center justify-center">
          <img
            src={isPsn ? '/PlayStation_logo.svg.png' : '/steam-1-logo.png'}
            alt={isPsn ? 'PlayStation' : 'Steam'}
            className="h-4 w-auto object-contain"
          />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 gap-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-full py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition"
          >
            Move to…
          </button>
        </div>

        {/* Category menu */}
        {showMenu && (
          <div className="absolute inset-x-2 bottom-2 border border-white/20 rounded-xl overflow-hidden shadow-2xl z-10" style={{ background: 'var(--bg-900)' }}>
            {game.category === 'in_progress'
              ? IN_PROGRESS_ACTIONS.map(({ category: cat, label }) => (
                  <button
                    key={cat}
                    onClick={() => { onCategoryChange(game.id, cat); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 transition flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                    {label}
                  </button>
                ))
              : ALL_CATEGORIES.filter(c => c !== game.category).map(cat => (
                  <button
                    key={cat}
                    onClick={() => { onCategoryChange(game.id, cat); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 transition flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))
            }
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white truncate mb-0.5" title={game.name}>{game.name}</h3>
        {game.game_type && (
          <p className="text-xs text-purple-400 capitalize mb-1 truncate">{game.game_type}</p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>{formatPlaytime(game.playtime_minutes)}</span>
          <span className="text-gray-500">
            {loadingHltb ? '…' : (hltb?.main ?? game.hltb_main) ? `~${formatHours(hltb?.main ?? game.hltb_main)} to beat` : ''}
          </span>
        </div>
        {game.steamspy_sentiment !== null && (
          <div className="text-xs text-gray-500 mb-1">
            <span style={{ color: game.steamspy_sentiment > 0.7 ? '#22c55e' : game.steamspy_sentiment > 0.4 ? '#f59e0b' : '#ef4444' }}>
              {Math.round(game.steamspy_sentiment * 100)}% positive
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
