'use client';
import { useMemo, useRef, useState } from 'react';
import type { Game, Category } from '@/lib/types';
import BacklogHero from './BacklogHero';
import React from 'react';

interface Props {
  games: Game[];
  onCategoryChange: (id: string, category: Category) => void;
  onViewLibrary: () => void;
  onViewQueue: () => void;
}

function getThumbnail(game: Game): string | null {
  if (game.sgdb_cover_url) return game.sgdb_cover_url;
  if (game.source === 'psn') return null;
  return `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/library_600x900.jpg`;
}

function getCoverLarge(game: Game): string | null {
  if (game.sgdb_cover_url) return game.sgdb_cover_url;
  if (game.source === 'psn') return null;
  return `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/library_600x900.jpg`;
}

// ── Recently Added row item ───────────────────────────────────────────────────

function LibraryListRow({ game }: { game: Game }) {
  const [imgFailed, setImgFailed] = useState(false);
  const thumb = getThumbnail(game);
  const tags = game.steam_tags.slice(0, 2).length
    ? game.steam_tags.slice(0, 2)
    : game.game_type ? [game.game_type] : [];

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {!imgFailed && thumb ? (
          <img src={thumb} alt={game.name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-black" style={{ color: 'rgba(255,255,255,0.1)' }}>
            {game.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate leading-tight">{game.name}</p>
        {tags.length > 0 && (
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {tags.map(t => (
              <span
                key={t}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Arrow */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

// ── Gaming queue large card ───────────────────────────────────────────────────

function QueueCard({
  game,
  onMarkPlaying,
}: {
  game: Game;
  onMarkPlaying: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const cover = getCoverLarge(game);
  const tags = game.steam_tags.slice(0, 2).length
    ? game.steam_tags.slice(0, 2)
    : game.game_type ? [game.game_type] : [];
  const sentimentPct = game.steamspy_sentiment !== null ? Math.round(game.steamspy_sentiment * 100) : null;

  return (
    <div
      className="relative flex-shrink-0 rounded-2xl overflow-hidden group cursor-pointer"
      style={{ width: 220, height: 280 }}
    >
      {/* Art */}
      {!imgFailed && cover ? (
        <img
          src={cover}
          alt={game.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, var(--wine-700), var(--bg-900))' }}
        />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />

      {/* Sentiment badge top-left */}
      {sentimentPct !== null && (
        <div
          className="absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            color: game.steamspy_sentiment! > 0.7 ? '#22c55e' : game.steamspy_sentiment! > 0.4 ? '#f59e0b' : '#ef4444',
          }}
        >
          {sentimentPct}%
        </div>
      )}

      {/* Platform badge top-right */}
      <div className="absolute top-3 right-3 rounded-lg bg-white px-1.5 py-1 flex items-center shadow">
        <img
          src={game.source === 'psn' ? '/PlayStation_logo.svg.png' : '/steam-1-logo.png'}
          alt={game.source === 'psn' ? 'PSN' : 'Steam'}
          className="h-3 w-auto object-contain"
        />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white text-sm font-bold leading-tight mb-2 line-clamp-2" style={{ fontFamily: 'var(--font-display)' }}>
          {game.name}
        </p>
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {tags.map(t => (
            <span
              key={t}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}
            >
              {t}
            </span>
          ))}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onMarkPlaying(); }}
          className="w-full py-1.5 rounded-xl text-xs font-semibold text-white opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0"
          style={{ background: 'var(--accent)' }}
        >
          Mark as Playing
        </button>
      </div>
    </div>
  );
}

// ── Horizontal scroll strip ───────────────────────────────────────────────────

function ScrollStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  function scroll(dir: 'left' | 'right') {
    ref.current?.scrollBy({ left: dir === 'right' ? 500 : -500, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto"
        style={{ scrollbarWidth: 'none', paddingBottom: 4 }}
      >
        {children}
      </div>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-4 w-6 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--bg-900), transparent)' }} />
      <div className="absolute right-0 top-0 bottom-4 w-6 pointer-events-none" style={{ background: 'linear-gradient(to left, var(--bg-900), transparent)' }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomePage({ games, onCategoryChange, onViewLibrary, onViewQueue }: Props) {
  const libraryGames = useMemo(
    () => games.filter(g => !g.auto_filtered || g.category === 'completed'),
    [games]
  );

  const recentlyAdded = useMemo(
    () =>
      [...libraryGames]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
    [libraryGames]
  );

  const gamingQueue = useMemo(
    () =>
      libraryGames
        .filter(g => g.category === 'play_now')
        .sort((a, b) => (b.steamspy_sentiment ?? -1) - (a.steamspy_sentiment ?? -1)),
    [libraryGames]
  );

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--bg-900)' }}>
      <div className="p-6">

        {/* ── Top section: hero + recently added ─────────────────────────── */}
        <div className="flex gap-5 mb-8" style={{ height: 460 }}>

          {/* Hero carousel */}
          <div className="flex-1 min-w-0" style={{ minWidth: 0 }}>
            {gamingQueue.length > 0 ? (
              <BacklogHero
                games={gamingQueue}
                onMarkPlaying={id => onCategoryChange(id, 'in_progress')}
              />
            ) : (
              <div
                className="h-full rounded-3xl flex flex-col items-center justify-center text-center p-8"
                style={{ background: 'var(--bg-800)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="text-5xl mb-4">🎮</div>
                <p className="text-white font-bold text-lg mb-1" style={{ fontFamily: 'var(--font-display)' }}>No games in your queue</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Games you mark "Play Now" will appear here.</p>
              </div>
            )}
          </div>

          {/* Recently Added panel */}
          <div className="flex-shrink-0 flex flex-col rounded-2xl overflow-hidden" style={{ width: 340, background: 'var(--bg-800)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                Recently Added to Library
              </h3>
              <button
                onClick={onViewLibrary}
                className="text-xs font-medium transition"
                style={{ color: 'var(--accent)' }}
              >
                View all
              </button>
            </div>

            {/* Game list */}
            <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {recentlyAdded.length > 0 ? (
                recentlyAdded.map(game => <LibraryListRow key={game.id} game={game} />)
              ) : (
                <div className="flex items-center justify-center h-full text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  No games yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Gaming Queue section ────────────────────────────────────────── */}
        {gamingQueue.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  Your Current Gaming Queue
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Play Now · sorted by community score
                </p>
              </div>
              <button
                onClick={onViewQueue}
                className="text-xs font-medium transition"
                style={{ color: 'var(--accent)' }}
              >
                View all →
              </button>
            </div>

            <ScrollStrip>
              {gamingQueue.map(game => (
                <QueueCard
                  key={game.id}
                  game={game}
                  onMarkPlaying={() => onCategoryChange(game.id, 'in_progress')}
                />
              ))}
            </ScrollStrip>
          </div>
        )}

        {/* Empty state */}
        {libraryGames.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">🎮</div>
            <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>No games yet</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Sync your Steam or PlayStation library to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
