'use client';

export type AppView = 'home' | 'library' | 'wishlist' | 'settings';

interface Props {
  view: AppView;
  setView: (v: AppView) => void;
  gameCount?: number;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#E11D48' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#E11D48' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="7" height="18" rx="1"/>
      <rect x="9" y="3" width="7" height="18" rx="1"/>
      <rect x="16" y="8" width="6" height="13" rx="1"/>
    </svg>
  );
}

function WishlistIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#E11D48' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#E11D48' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

const NAV: { id: AppView; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'library', label: 'My Games', Icon: LibraryIcon },
  { id: 'wishlist', label: 'Your Wishlist', Icon: WishlistIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

import React from 'react';

export default function Sidebar({ view, setView, gameCount }: Props) {
  return (
    <aside
      className="flex flex-col flex-shrink-0 border-r border-white/5"
      style={{ width: 220, background: 'var(--bg-800)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #E11D48, #8E5BE0)' }}
        >
          🎮
        </div>
        <span className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
          Backlog
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {NAV.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full"
              style={active ? {
                background: 'rgba(225,29,72,0.12)',
                color: 'white',
                boxShadow: 'inset 0 0 0 1px rgba(225,29,72,0.2)',
              } : {
                color: 'rgba(255,255,255,0.45)',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; } }}
            >
              <Icon active={active} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {gameCount !== undefined && (
        <div className="px-6 py-4 border-t border-white/5">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {gameCount} games in library
          </p>
        </div>
      )}
    </aside>
  );
}
