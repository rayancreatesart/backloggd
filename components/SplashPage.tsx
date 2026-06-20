'use client';
import { useState } from 'react';

interface Props {
  onConnected: () => void;
}

type View = 'home' | 'steam' | 'playstation';

function SteamLogo({ className }: { className?: string }) {
  return (
    <div className={`bg-white flex items-center justify-center p-2 ${className}`}>
      <img src="/steam-1-logo.png" alt="Steam" className="w-full h-full object-contain" />
    </div>
  );
}

function PlayStationLogo({ className }: { className?: string }) {
  return (
    <div className={`bg-white flex items-center justify-center p-2 ${className}`}>
      <img src="/PlayStation_logo.svg.png" alt="PlayStation" className="w-full h-full object-contain" />
    </div>
  );
}

const PLATFORMS = [
  {
    id: 'steam',
    name: 'Steam',
    description: 'Import your full Steam library with playtime, tags and AI analysis.',
    color: '#66c0f4',
  },
  {
    id: 'playstation',
    name: 'PlayStation',
    description: 'Connect your PSN account to import your PS4 and PS5 library.',
    color: '#0070d1',
  },
];

export default function SplashPage({ onConnected }: Props) {
  const [view, setView] = useState<View>('home');
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [error, setError] = useState('');

  // PSN state
  const [npsso, setNpsso] = useState('');
  const [psnConnecting, setPsnConnecting] = useState(false);
  const [psnSyncing, setPsnSyncing] = useState(false);
  const [psnSyncMsg, setPsnSyncMsg] = useState('');
  const [psnError, setPsnError] = useState('');

  async function saveAndSync() {
    setError('');
    if (!apiKey.trim() || !steamId.trim()) {
      setError('Both fields are required to connect your Steam library.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steam_api_key: apiKey.trim(),
        steam_id: steamId.trim(),
        anthropic_api_key: anthropicKey.trim(),
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save'); return; }

    setSyncing(true);
    setSyncMsg('Connecting to Steam…');
    const syncRes = await fetch('/api/steam/sync', { method: 'POST' });
    const syncData = await syncRes.json();
    setSyncing(false);
    if (!syncRes.ok) { setError(syncData.error || 'Sync failed'); return; }

    setSyncMsg(`Found ${syncData.synced} games!`);
    await new Promise(r => setTimeout(r, 800));
    onConnected();
  }

  async function connectPsn() {
    setPsnError('');
    if (!npsso.trim()) { setPsnError('Please paste your NPSSO token first.'); return; }
    setPsnConnecting(true);
    const authRes = await fetch('/api/psn/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npsso: npsso.trim() }),
    });
    const authData = await authRes.json();
    if (!authRes.ok) { setPsnConnecting(false); setPsnError(authData.error ?? 'Connection failed.'); return; }

    setPsnConnecting(false);
    setPsnSyncing(true);
    setPsnSyncMsg('Importing your PlayStation library…');
    const syncRes = await fetch('/api/psn/sync', { method: 'POST' });
    const syncData = await syncRes.json();
    setPsnSyncing(false);
    if (!syncRes.ok) { setPsnError(syncData.error ?? 'Sync failed.'); return; }
    setPsnSyncMsg(`Found ${syncData.synced} games!`);
    await new Promise(r => setTimeout(r, 800));
    onConnected();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ background: 'var(--bg-900)' }}>
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(225,29,72,0.07)' }} />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(142,91,224,0.06)' }} />

      <div className="relative w-full max-w-2xl">

        {/* ── Home ─────────────────────────────────────────────────────── */}
        {view === 'home' && (
          <div>
            {/* Hero */}
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl mx-auto mb-5 shadow-2xl shadow-blue-500/30">
                🎮
              </div>
              <h1 className="text-4xl font-bold text-white mb-3">Game Backlog</h1>
              <p className="text-gray-400 text-lg mb-2">Stop feeling guilty about your backlog.</p>
              <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
                Connect your game library, get an AI-powered read on what you actually want to play,
                and finally make some decisions.
              </p>
            </div>

            {/* Platform cards */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 text-center">
              Choose a platform to get started
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setView(p.id === 'steam' ? 'steam' : 'playstation')}
                  className="relative rounded-2xl border p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl cursor-pointer border-white/10 hover:border-white/20 bg-white/5"
                >
                  <div className="mb-4">
                    {p.id === 'steam' && <SteamLogo className="w-12 h-12 rounded-xl" />}
                    {p.id === 'playstation' && <PlayStationLogo className="w-12 h-12 rounded-xl" />}
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">{p.name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>

                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: p.color }}>
                    Connect →
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PlayStation setup ─────────────────────────────────────────── */}
        {view === 'playstation' && (
          <div>
            <button
              onClick={() => { setView('home'); setPsnError(''); }}
              className="text-gray-500 hover:text-gray-300 text-sm mb-8 flex items-center gap-1.5 transition"
            >
              ← Back
            </button>

            <div className="flex items-center gap-3 mb-6">
              <PlayStationLogo className="w-10 h-10 rounded-xl flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-white">Connect PlayStation</h2>
                <p className="text-gray-500 text-sm">Import your PS4 and PS5 library in a few steps.</p>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">How it works</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Sony doesn&apos;t offer a public API, so this uses a session token called an <strong className="text-gray-300">NPSSO</strong> — it&apos;s automatically
                generated when you&apos;re logged into PlayStation on your browser. You copy it once and
                paste it here. It lasts up to 2 years.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {/* Step 1 */}
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0070d1] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">Sign in to PlayStation</p>
                    <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                      Open the link below and sign in with your PSN account. Use a browser where
                      you&apos;re not already signed in to another PlayStation session to avoid conflicts.
                    </p>
                    <a
                      href="https://www.playstation.com/en-gb/sign-in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
                    >
                      playstation.com → Sign In
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0070d1] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">Get your NPSSO token</p>
                    <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                      While still signed in, open a new tab and go to this URL. You&apos;ll see a short
                      page that looks like: <span className="text-gray-200 font-mono bg-white/5 px-1 rounded">{"{ \"npsso\": \"AbCd1234...\" }"}</span>
                    </p>
                    <a
                      href="https://ca.account.sony.com/api/v1/ssocookie"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition font-mono"
                    >
                      ca.account.sony.com/api/v1/ssocookie →
                    </a>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      Copy the long string of letters and numbers between the quotes after <span className="text-gray-300">"npsso":</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#0070d1] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">Paste it here</p>
                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                      Paste the entire token string. It should be about 64 characters long.
                    </p>
                    <input
                      type="password"
                      placeholder="Paste your NPSSO token here"
                      value={npsso}
                      onChange={e => setNpsso(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0070d1] transition font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {psnError && (
              <p className="text-red-400 text-sm mb-4 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {psnError}
              </p>
            )}

            {(psnConnecting || psnSyncing) && (
              <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 mb-4">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="text-blue-300 text-sm">{psnSyncMsg || 'Connecting to PlayStation…'}</span>
              </div>
            )}

            <button
              onClick={connectPsn}
              disabled={psnConnecting || psnSyncing}
              className="w-full py-4 bg-[#0070d1] hover:bg-[#0060b8] disabled:opacity-50 rounded-xl text-white font-bold text-base transition shadow-lg shadow-blue-900/30"
            >
              {psnConnecting ? 'Verifying token…' : psnSyncing ? 'Importing library…' : 'Connect & Import Library →'}
            </button>

            <p className="text-center text-xs text-gray-600 mt-3">
              Your token is stored locally on your machine only.
            </p>
          </div>
        )}

        {/* ── Steam setup ───────────────────────────────────────────────── */}
        {view === 'steam' && (
          <div>
            <button
              onClick={() => { setView('home'); setError(''); }}
              className="text-gray-500 hover:text-gray-300 text-sm mb-8 flex items-center gap-1.5 transition"
            >
              ← Back
            </button>

            <div className="flex items-center gap-3 mb-6">
              <SteamLogo className="w-10 h-10 rounded-xl flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-white">Connect Steam</h2>
                <p className="text-gray-500 text-sm">Two things needed — takes about a minute.</p>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="space-y-3 mb-6">
              {/* Step 1 */}
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">Get your Steam API key</p>
                    <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                      Log into Steam, then visit the link below. Enter any domain name (e.g. <span className="text-gray-300">localhost</span>) and copy the key shown.
                    </p>
                    <a
                      href="https://steamcommunity.com/dev/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
                    >
                      steamcommunity.com/dev/apikey →
                    </a>
                    <input
                      type="password"
                      placeholder="Paste your Steam API key here"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      className="mt-3 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E11D48] transition"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white/5 border border-white/8 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-1">Find your Steam ID</p>
                    <p className="text-xs text-gray-400 mb-2 leading-relaxed">
                      Your Steam ID is a 17-digit number. The easiest way to find it is to visit the link below and search for your Steam username.
                    </p>
                    <a
                      href="https://steamid.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
                    >
                      steamid.io →
                    </a>
                    <input
                      type="text"
                      placeholder="e.g. 76561198012345678"
                      value={steamId}
                      onChange={e => setSteamId(e.target.value)}
                      className="mt-3 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E11D48] transition"
                    />
                  </div>
                </div>
              </div>

              {/* Optional: Anthropic */}
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-white/10 text-gray-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">Anthropic API key</p>
                      <span className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Optional</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                      Powers AI game classification (game type, multiplayer detection). Without it, community tags are still fetched from SteamSpy.
                    </p>
                    <input
                      type="password"
                      placeholder="sk-ant-..."
                      value={anthropicKey}
                      onChange={e => setAnthropicKey(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E11D48] transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm mb-4 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {syncing && (
              <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 mb-4">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="text-blue-300 text-sm">{syncMsg}</span>
              </div>
            )}

            <button
              onClick={saveAndSync}
              disabled={saving || syncing}
              className="w-full py-4 disabled:opacity-50 rounded-xl text-white font-bold text-base transition" style={{ background: 'var(--accent)', boxShadow: '0 14px 30px -12px var(--accent)' }}
            >
              {saving ? 'Saving…' : syncing ? 'Importing library…' : 'Connect & Import Library →'}
            </button>

            <p className="text-center text-xs text-gray-600 mt-3">
              Your credentials are stored locally on your machine only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
