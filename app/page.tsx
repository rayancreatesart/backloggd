'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Game, Category, FilteredGame, CompletionReview, DroppedReview } from '@/lib/types';
import { AUTO_FILTER_LABELS } from '@/lib/types';
import GameCard from '@/components/GameCard';
import CategoryFilter from '@/components/CategoryFilter';
import SettingsModal from '@/components/SettingsModal';
import SplashPage from '@/components/SplashPage';
import AnalysisProgress from '@/components/AnalysisProgress';
import RecommendModal from '@/components/RecommendModal';
import CompletionReviewModal from '@/components/CompletionReviewModal';
import DroppedReviewModal from '@/components/DroppedReviewModal';
import SuggestCategoriesModal from '@/components/SuggestCategoriesModal';
import Tooltip from '@/components/Tooltip';
import Sidebar, { type AppView } from '@/components/Sidebar';
import HomePage from '@/components/HomePage';
import SettingsPage from '@/components/SettingsPage';
import WishlistPage from '@/components/WishlistPage';

type Phase = 'loading' | 'setup' | 'needs_analysis' | 'analysing' | 'recommending' | 'ready';
type FilterTab = 'all' | Category;

function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>('loading');
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<FilteredGame[]>([]);
  const [search, setSearch] = useState('');
  const view = (searchParams.get('page') ?? 'home') as AppView;
  function setView(v: AppView) {
    const params = new URLSearchParams(searchParams.toString());
    if (v === 'home') params.delete('page');
    else params.set('page', v);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const filter = (searchParams.get('tab') ?? 'all') as FilterTab;
  function setFilter(tab: FilterTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'all') params.delete('tab');
    else params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }
  const [showSettings, setShowSettings] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [psnConnected, setPsnConnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dedupeCount, setDedupeCount] = useState<number | null>(null);
  const [deduping, setDeduping] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'playtime' | 'recommended'>('name');
  const [completionReviewGame, setCompletionReviewGame] = useState<Game | null>(null);
  const [droppedReviewGame, setDroppedReviewGame] = useState<Game | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestSource, setSuggestSource] = useState<'uncategorised' | 'play_later' | 'play_now'>('uncategorised');

  useEffect(() => { init(); }, []);

  async function init() {
    const [settingsRes, gamesRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/games'),
    ]);
    const settings = await settingsRes.json();
    const gamesData: Game[] = await gamesRes.json();
    setGames(gamesData);
    setPsnConnected(Boolean(settings.psn_npsso));
    if (settings.psn_npsso) {
      fetch('/api/games/deduplicate').then(r => r.json()).then(d => setDedupeCount(d.count));
    }

    if (!settings.configured) {
      setPhase('setup');
      return;
    }

    if (gamesData.length === 0) {
      setPhase('setup');
      return;
    }

    const needsAnalysis = gamesData.some(g => !g.analysis_done);
    if (needsAnalysis) {
      setPhase('needs_analysis');
      return;
    }

    setPhase('ready');
  }

  async function loadGames() {
    const res = await fetch('/api/games');
    setGames(await res.json());
  }

  async function checkForNewGames() {
    setChecking(true);
    setSyncMsg('');
    const results: string[] = [];
    const errors: string[] = [];

    const steamRes = await fetch('/api/steam/sync', { method: 'POST' });
    const steamData = await steamRes.json();
    if (steamRes.ok) results.push(`Steam: ${steamData.synced} games`);
    else errors.push(steamData.error ?? 'Steam sync failed');

    if (psnConnected) {
      const psnRes = await fetch('/api/psn/sync', { method: 'POST' });
      const psnData = await psnRes.json();
      if (psnRes.ok) results.push(`PSN: ${psnData.synced} games`);
      else errors.push(psnData.error ?? 'PSN sync failed');
    }

    await loadGames();

    if (errors.length) {
      setSyncMsg(`❌ ${errors.join(' · ')}`);
      setTimeout(() => setSyncMsg(''), 6000);
    } else {
      setSyncMsg(`✅ ${results.join(' · ')}`);
      setTimeout(() => setSyncMsg(''), 4000);
    }

    setChecking(false);
  }

  async function dedupeGames() {
    setDeduping(true);
    const res = await fetch('/api/games/deduplicate', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setSyncMsg(`✅ Removed ${data.removed} duplicate${data.removed !== 1 ? 's' : ''}`);
      setDedupeCount(0);
      await loadGames();
      setTimeout(() => setSyncMsg(''), 4000);
    } else {
      setSyncMsg('❌ Deduplication failed');
      setTimeout(() => setSyncMsg(''), 4000);
    }
    setDeduping(false);
  }

  function handleAnalysisComplete(filtered: FilteredGame[]) {
    setFilteredGames(filtered);
    loadGames().then(() => {
      const completedOnes = filtered.filter(g => g.reason === 'likely_completed');
      setPhase(completedOnes.length > 0 ? 'recommending' : 'ready');
    });
  }

  function handleCategoryChange(id: string, category: Category) {
    fetch(`/api/games/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    setGames(prev => prev.map(g => g.id === id ? { ...g, category } : g));
    if (category === 'completed') {
      const game = games.find(g => g.id === id);
      if (game && !game.completion_review) setCompletionReviewGame({ ...game, category: 'completed' });
    }
    if (category === 'dropped') {
      const game = games.find(g => g.id === id);
      if (game && !game.dropped_review) setDroppedReviewGame({ ...game, category: 'dropped' });
    }
  }

  const libraryGames = games.filter(g => !g.auto_filtered || g.category === 'completed');
  const uncategorisedGames = libraryGames.filter(g => g.category === 'uncategorised');

  const filtered = useMemo(() => {
    let list = libraryGames;
    if (filter !== 'all') list = list.filter(g => g.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q));
    }
    if (sortBy === 'playtime') list = [...list].sort((a, b) => b.playtime_minutes - a.playtime_minutes);
    if (sortBy === 'recommended') list = [...list].sort((a, b) => (b.steamspy_sentiment ?? -1) - (a.steamspy_sentiment ?? -1));
    return list;
  }, [libraryGames, filter, search, sortBy]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: libraryGames.length };
    for (const g of libraryGames) c[g.category] = (c[g.category] ?? 0) + 1;
    return c;
  }, [libraryGames]);

  const autoFilteredCount = games.filter(g => g.auto_filtered).length;

  // ── Render phases ─────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-900)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (phase === 'setup') {
    return <SplashPage onConnected={() => { loadGames(); setPhase('needs_analysis'); }} />;
  }

  if (phase === 'needs_analysis') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-900)' }}>
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E11D48] to-[#8E5BE0] flex items-center justify-center text-4xl mx-auto mb-6 shadow-2xl shadow-blue-500/30">
            🧠
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {games.length > 0 ? `${games.length} games imported` : 'Library imported'}
          </h2>
          <p className="text-gray-400 mb-2">Ready to analyse your library.</p>
          <p className="text-gray-500 text-sm mb-8">
            This fetches community tags, completion times, and uses AI to classify every game.
            Games you&apos;ve already played enough of will be removed automatically.
          </p>
          <button
            onClick={() => setPhase('analysing')}
            className="w-full py-4 bg-[#E11D48] hover:bg-[#c8173f] rounded-xl text-white font-bold text-lg transition shadow-lg shadow-blue-500/25 mb-4"
          >
            Analyse Library →
          </button>
          <button
            onClick={() => setPhase('ready')}
            className="w-full py-3 border border-white/10 rounded-xl text-gray-400 hover:text-white text-sm transition"
          >
            Skip analysis, go to library
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition"
          >
            ⚙ Settings
          </button>
        </div>
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} onSaved={() => {}} />
        )}
      </div>
    );
  }

  if (phase === 'analysing') {
    return <AnalysisProgress onComplete={handleAnalysisComplete} />;
  }

  if (phase === 'recommending') {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-900)' }}>
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">🏁</div>
            <h2 className="text-xl font-bold text-white mb-2">Analysis complete</h2>
            {filteredGames.length > 0 && (
              <div className="mt-4 space-y-2 text-left mb-6">
                {Object.entries(
                  filteredGames.reduce((acc, g) => {
                    acc[g.reason] = (acc[g.reason] ?? 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([reason, count]) => (
                  <div key={reason} className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-green-400">✓</span>
                    {count} game{count > 1 ? 's' : ''} — {AUTO_FILTER_LABELS[reason as keyof typeof AUTO_FILTER_LABELS]}
                  </div>
                ))}
              </div>
            )}
            <p className="text-gray-400 text-sm mb-4">
              Quick question about the games you&apos;ve completed — helps rank similar games.
            </p>
          </div>
        </div>
        <RecommendModal games={filteredGames} onDone={() => setPhase('ready')} />
      </>
    );
  }

  // ── Main app shell (ready) ────────────────────────────────────────────────

  const modals = (
    <>
      {completionReviewGame && (
        <CompletionReviewModal
          game={completionReviewGame}
          onClose={() => setCompletionReviewGame(null)}
          onSaved={(review: CompletionReview) => {
            setGames(prev => prev.map(g =>
              g.id === completionReviewGame.id ? { ...g, completion_review: review } : g
            ));
            setCompletionReviewGame(null);
          }}
        />
      )}
      {droppedReviewGame && (
        <DroppedReviewModal
          game={droppedReviewGame}
          onClose={() => setDroppedReviewGame(null)}
          onSaved={(review: DroppedReview) => {
            setGames(prev => prev.map(g =>
              g.id === droppedReviewGame.id ? { ...g, dropped_review: review } : g
            ));
            setDroppedReviewGame(null);
          }}
        />
      )}
      {showSuggest && (
        <SuggestCategoriesModal
          source={suggestSource}
          onClose={() => setShowSuggest(false)}
          onApplied={() => { loadGames(); setShowSuggest(false); }}
        />
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden text-white" style={{ background: 'var(--bg-900)' }}>
      <Sidebar view={view} setView={setView} gameCount={libraryGames.length} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Home view ── */}
        {view === 'home' && (
          <div className="flex-1 overflow-y-auto">
            <HomePage
              games={games}
              onCategoryChange={handleCategoryChange}
              onViewLibrary={() => setView('library')}
              onViewQueue={() => { setView('library'); setFilter('play_now'); }}
            />
          </div>
        )}

        {/* ── Library view ── */}
        {view === 'library' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Library header */}
            <header className="flex-shrink-0 border-b border-white/5 backdrop-blur-xl z-40" style={{ background: 'rgba(22,8,18,0.95)' }}>
              <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-lg font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>My Games</h1>
                  <p className="text-xs text-gray-500">{libraryGames.length} games{autoFilteredCount > 0 ? ` · ${autoFilteredCount} auto-sorted` : ''}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {syncMsg && (
                    <span className="text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-1.5 border border-white/10">{syncMsg}</span>
                  )}

                  <Tooltip text={`Checks ${psnConnected ? 'Steam and PSN' : 'your Steam account'} for any games added since your last sync`}>
                    <button
                      onClick={checkForNewGames}
                      disabled={checking}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-sm font-medium text-gray-300 hover:text-white transition"
                    >
                      {checking ? '⟳ Checking…' : '↻ Check for New Games'}
                    </button>
                  </Tooltip>

                  {psnConnected && dedupeCount !== null && dedupeCount > 0 && (
                    <Tooltip text={`${dedupeCount} game${dedupeCount !== 1 ? 's' : ''} appear on both Steam and PSN — removes PSN duplicates and keeps the Steam version`}>
                      <button
                        onClick={dedupeGames}
                        disabled={deduping || checking}
                        className="px-4 py-2 bg-amber-900/30 hover:bg-amber-800/40 disabled:opacity-40 border border-amber-500/30 rounded-xl text-sm font-medium text-amber-300 hover:text-amber-200 transition"
                      >
                        {deduping ? '⟳ Removing…' : `✕ ${dedupeCount} Duplicate${dedupeCount !== 1 ? 's' : ''}`}
                      </button>
                    </Tooltip>
                  )}

                  {uncategorisedGames.length > 0 && (
                    <Tooltip text="Uses your library history to automatically suggest a category for each uncategorised game">
                      <button
                        onClick={() => { setSuggestSource('uncategorised'); setShowSuggest(true); }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-gray-300 hover:text-white transition"
                      >
                        💡 Suggest
                      </button>
                    </Tooltip>
                  )}

                  {(filter === 'play_later' || filter === 'play_now') && (
                    <Tooltip text={`Reviews your ${filter === 'play_now' ? 'Play Now' : 'Play Later'} list and suggests games that may belong elsewhere`}>
                      <button
                        onClick={() => { setSuggestSource(filter); setShowSuggest(true); }}
                        className="px-4 py-2 bg-purple-900/40 hover:bg-purple-800/50 border border-purple-500/30 rounded-xl text-sm font-medium text-purple-300 hover:text-purple-200 transition"
                      >
                        ↻ Re-analyse
                      </button>
                    </Tooltip>
                  )}

                  <Tooltip text="Re-fetches community ratings, completion times and re-runs AI classification across your whole library">
                    <button
                      onClick={() => setPhase('analysing')}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-gray-300 hover:text-white transition"
                    >
                      🧠 Refresh Recommendations
                    </button>
                  </Tooltip>
                </div>
              </div>
            </header>

            {/* Library body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-6">
                {/* Search + sort */}
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
                    <input
                      type="text"
                      placeholder="Search games…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition"
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = '')}
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as 'name' | 'playtime' | 'recommended')}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none transition cursor-pointer"
                  >
                    <option value="name">Sort: A–Z</option>
                    <option value="playtime">Sort: Playtime</option>
                    <option value="recommended">Sort: Most Recommended</option>
                  </select>
                </div>

                {/* Filter tabs */}
                <div className="mb-6">
                  <CategoryFilter active={filter} counts={counts} onChange={setFilter} />
                </div>

                {/* Game grid */}
                {filtered.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">No games match your filters.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filtered.map(game => (
                      <GameCard
                        key={game.id}
                        game={game}
                        onCategoryChange={handleCategoryChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Wishlist view ── */}
        {view === 'wishlist' && (
          <div className="flex-1 overflow-y-auto">
            <WishlistPage />
          </div>
        )}

        {/* ── Settings view ── */}
        {view === 'settings' && (
          <div className="flex-1 overflow-y-auto">
            <SettingsPage onSaved={() => {}} />
          </div>
        )}
      </div>

      {modals}
    </div>
  );
}

import { Suspense } from 'react';
function HomeShell() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-900)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <Home />
    </Suspense>
  );
}
export default HomeShell;
