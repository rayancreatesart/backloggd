'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Game } from '@/lib/types';

interface Props {
  games: Game[];
  onMarkPlaying: (id: string) => void;
}

const AUTOPLAY_MS = 7000;
const ACCENTS = ['#E11D48', '#D9407E', '#B23A52', '#8E5BE0', '#C2603A', '#4338CA'];

function accent(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return ACCENTS[Math.abs(h) % ACCENTS.length];
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function procedural(ac: string): string {
  return [
    `radial-gradient(120% 90% at 78% 18%, ${hexA(ac, 0.55)} 0%, transparent 55%)`,
    `radial-gradient(90% 80% at 92% 80%, ${hexA(ac, 0.32)} 0%, transparent 60%)`,
    `linear-gradient(105deg, #1a0812 0%, #2a0f1d 42%, ${hexA(ac, 0.22)} 100%)`,
  ].join(', ');
}

function heroUrl(game: Game): string | null {
  if (game.source !== 'psn')
    return `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/library_hero.jpg`;
  return game.sgdb_cover_url ?? null;
}

function fallbackUrl(game: Game): string | null {
  if (game.sgdb_cover_url) return game.sgdb_cover_url;
  if (game.source !== 'psn')
    return `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/library_600x900.jpg`;
  return null;
}

function buildBlurb(game: Game): string {
  const parts: string[] = [];
  if (game.game_type) parts.push(`A ${game.game_type}`);
  if (game.steamspy_sentiment !== null) {
    const pct = Math.round(game.steamspy_sentiment * 100);
    if (pct >= 85) parts.push(`loved by ${pct}% of players`);
    else if (pct >= 70) parts.push(`liked by ${pct}% of players`);
    else if (pct >= 55) parts.push(`with mixed reception`);
  }
  const intro = parts.join(', ');
  const hrs = Math.round(game.playtime_minutes / 60);
  const played = hrs > 0 ? `${hrs}h logged.` : 'Not yet started.';
  const hltb = game.hltb_main
    ? `Main story takes around ${game.hltb_main < 1 ? `${Math.round(game.hltb_main * 60)}m` : `${game.hltb_main.toFixed(0)}h`} to complete.`
    : '';
  return [intro ? intro + '.' : '', played, hltb].filter(Boolean).join(' ');
}

function fmtHltb(h: number | null): string {
  if (!h) return '?h to beat';
  return `≈ ${h < 1 ? `${Math.round(h * 60)}m` : `${h % 1 === 0 ? h : h.toFixed(1)}h`} to beat`;
}

function fmtPlayed(m: number): string {
  if (!m) return 'Not started';
  const h = Math.floor(m / 60), min = m % 60;
  return h === 0 ? `${min}m played` : `${h}h${min > 0 ? ` ${min}m` : ''} played`;
}

export default function BacklogHero({ games, onMarkPlaying }: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [heroFailed, setHeroFailed] = useState<Record<number, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = games.length;

  const go = useCallback((n: number) => setIdx(i => (n + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const u = () => setReduced(mq.matches);
    u(); mq.addEventListener('change', u);
    return () => mq.removeEventListener('change', u);
  }, []);

  useEffect(() => {
    if (paused || reduced || count <= 1) return;
    timer.current = setTimeout(() => go(idx + 1), AUTOPLAY_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [idx, paused, reduced, go, count]);

  if (!count) return null;

  const game = games[idx];
  const ac = accent(game.name);
  const url = !heroFailed[idx] ? heroUrl(game) : (!failed[idx] ? fallbackUrl(game) : null);
  const tags = game.steam_tags.slice(0, 3).length ? game.steam_tags.slice(0, 3)
    : game.game_type ? [game.game_type] : [];

  return (
    <div
      className="relative w-full overflow-hidden border border-white/10 focus:outline-none"
      style={{
        borderRadius: 24,
        height: '100%',
        minHeight: 320,
        boxShadow: '0 40px 90px -40px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06)',
      }}
      tabIndex={0}
      aria-label="Featured games in your Play Now list"
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); go(idx - 1); }
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* ── Art layers ─────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {games.map((g, i) => {
          const u = !heroFailed[i] ? heroUrl(g) : (!failed[i] ? fallbackUrl(g) : null);
          const a = accent(g.name);
          return (
            <div
              key={g.id}
              className="absolute inset-0 bg-cover"
              style={{
                backgroundImage: u ? `url(${u})` : procedural(a),
                backgroundPosition: 'center center',
                opacity: i === idx ? 1 : 0,
                transform: i === idx ? 'scale(1)' : 'scale(1.06)',
                transition: reduced ? 'none' : 'opacity 0.85s ease, transform 9s linear',
              }}
            />
          );
        })}

        {/* Hidden img tags to detect load failures — hero tier then fallback tier */}
        {games.map((g, i) => {
          const hero = heroUrl(g);
          const fallback = fallbackUrl(g);
          return (
            <React.Fragment key={g.id}>
              {hero && (
                <img src={hero} alt="" aria-hidden className="hidden"
                  onError={() => setHeroFailed(p => ({ ...p, [i]: true }))} />
              )}
              {fallback && fallback !== hero && (
                <img src={fallback} alt="" aria-hidden className="hidden"
                  onError={() => setFailed(p => ({ ...p, [i]: true }))} />
              )}
            </React.Fragment>
          );
        })}

        {/* Scrim — hard on left, fades right */}
        <div className="absolute inset-0" style={{
          background: [
            'linear-gradient(90deg, rgba(14,5,10,.95) 0%, rgba(14,5,10,.72) 40%, rgba(14,5,10,.1) 72%)',
            'linear-gradient(0deg, rgba(14,5,10,.8) 0%, transparent 40%)',
          ].join(', '),
        }} />

        {/* Accent glow */}
        <div className="absolute inset-0 mix-blend-screen pointer-events-none" style={{
          opacity: 0.5,
          background: `radial-gradient(60% 60% at 82% 28%, ${ac}, transparent 62%)`,
          animation: reduced ? 'none' : 'bh-breathe 7s ease infinite',
        }} />

        {/* Film grain */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 h-full flex flex-col justify-center px-12 py-10"
        style={{ maxWidth: '58%' }} aria-live="polite">

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 mb-5 self-start px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide"
          style={{
            fontFamily: 'var(--font-display)',
            background: 'linear-gradient(180deg, #f0d6a0, #E7C27D)',
            color: '#3a2a12',
            boxShadow: '0 6px 18px -8px rgba(231,194,125,.65)',
          }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3a2a12' }} />
          Up Next
        </div>

        {/* Title */}
        <h2 className="text-white font-bold leading-none mb-3"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4.2vw, 54px)',
            letterSpacing: '-0.02em',
            textShadow: '0 2px 30px rgba(0,0,0,.5)',
          }}>
          {game.name}
        </h2>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map(t => (
              <span key={t} className="text-xs font-medium px-3 py-1 rounded-full border border-white/10 text-white/55"
                style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(6px)' }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Blurb */}
        <p className="text-sm leading-relaxed mb-auto" style={{ color: 'var(--muted)', maxWidth: '44ch' }}>
          {buildBlurb(game)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-6 flex-wrap">
          <button
            onClick={() => onMarkPlaying(game.id)}
            className="relative overflow-hidden inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white"
            style={{
              fontFamily: 'var(--font-display)',
              background: `linear-gradient(180deg, #FF3D6B, ${ac})`,
              boxShadow: `0 14px 30px -12px ${ac}, inset 0 1px 0 rgba(255,255,255,.22)`,
              transition: 'transform .3s ease, box-shadow .3s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.02)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = '';
            }}
          >
            <PlayIcon /> Mark as Playing
          </button>

          <div className="flex items-center gap-2.5 text-xs" style={{ color: 'var(--dim)' }}>
            <span>{fmtHltb(game.hltb_main)}</span>
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--dim)' }} />
            <span>{fmtPlayed(game.playtime_minutes)}</span>
          </div>
        </div>
      </div>

      {/* ── Footer nav ─────────────────────────────────────────────────────── */}
      {count > 1 && (
        <div className="absolute z-10 right-10 bottom-7 flex items-center gap-3">
          {(['left', 'right'] as const).map(dir => (
            <button
              key={dir}
              aria-label={dir === 'left' ? 'Previous game' : 'Next game'}
              onClick={() => go(dir === 'left' ? idx - 1 : idx + 1)}
              className="w-9 h-9 rounded-full grid place-items-center text-white border border-white/10 transition-all hover:border-white/20"
              style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
            >
              <ArrowIcon dir={dir} />
            </button>
          ))}
          <span className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {idx + 1}{' '}
            <span style={{ color: 'var(--dim)', fontWeight: 500 }}>/ {count}</span>
          </span>
          <ProgressRing key={`${idx}-${paused || reduced}`} paused={paused || reduced} ac={ac} />
        </div>
      )}
    </div>
  );
}

function ProgressRing({ paused, ac }: { paused: boolean; ac: string }) {
  const r = 10;
  const circ = +(2 * Math.PI * r).toFixed(2);
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="13" cy="13" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
      <circle
        cx="13" cy="13" r={r} fill="none"
        stroke={ac} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={paused ? 0 : circ}
        style={{
          // @ts-expect-error CSS custom property
          '--circ': `${circ}px`,
          animation: paused ? 'none' : `bh-progress ${AUTOPLAY_MS}ms linear forwards`,
        }}
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ArrowIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ transform: dir === 'left' ? 'scaleX(-1)' : 'none' }}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
