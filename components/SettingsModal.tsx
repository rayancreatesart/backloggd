'use client';
import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ onClose, onSaved }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setApiKey(d.steam_api_key || '');
      setSteamId(d.steam_id || '');
      setAnthropicKey(d.anthropic_api_key || '');
      setLoading(false);
    });
  }, []);

  async function save() {
    setError('');
    if (!apiKey.trim() || !steamId.trim()) {
      setError('Both Steam fields are required.');
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
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json(); setError(d.error || 'Failed to save'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-1">Settings</h2>
        <p className="text-sm text-gray-400 mb-6">Credentials stored locally on your machine only.</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-300 block mb-1">Steam API Key</span>
              <input
                type="password"
                placeholder={apiKey ? 'Already set (masked)' : 'Paste your Steam Web API key'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-300 block mb-1">Steam ID (64-bit)</span>
              <input
                type="text"
                placeholder="e.g. 76561198012345678"
                value={steamId}
                onChange={e => setSteamId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-300 block mb-1">
                Anthropic API Key
                <span className="ml-2 text-xs font-normal text-gray-500">(optional — for AI classification)</span>
              </span>
              <input
                type="password"
                placeholder={anthropicKey ? 'Already set (masked)' : 'sk-ant-...'}
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </label>

          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-white/10 text-gray-400 hover:text-white transition text-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving || loading} className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
