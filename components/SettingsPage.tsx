'use client';
import { useState, useEffect } from 'react';

interface Props {
  onSaved: () => void;
}

function Field({
  label,
  hint,
  type = 'text',
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  type?: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-white/30">{hint}</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none transition"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(225,29,72,0.5)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      />
    </div>
  );
}

export default function SettingsPage({ onSaved }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [npsso, setNpsso] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [psnMsg, setPsnMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setApiKey(d.steam_api_key || '');
        setSteamId(d.steam_id || '');
        setAnthropicKey(d.anthropic_api_key || '');
        setNpsso(d.psn_npsso || '');
        setLoading(false);
      });
  }, []);

  async function save() {
    if (!apiKey.trim() || !steamId.trim()) {
      setMsg({ type: 'err', text: 'Steam API Key and Steam ID are required.' });
      return;
    }
    setSaving(true);
    setMsg(null);
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
    if (res.ok) {
      setMsg({ type: 'ok', text: 'Settings saved.' });
      onSaved();
      setTimeout(() => setMsg(null), 3000);
    } else {
      const d = await res.json();
      setMsg({ type: 'err', text: d.error || 'Failed to save.' });
    }
  }

  async function reconnectPsn() {
    if (!npsso.trim()) {
      setPsnMsg({ type: 'err', text: 'Paste your NPSSO token first.' });
      return;
    }
    setReconnecting(true);
    setPsnMsg(null);
    const res = await fetch('/api/psn/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npsso: npsso.trim() }),
    });
    if (res.ok) {
      setPsnMsg({ type: 'ok', text: 'PSN connected successfully.' });
      setTimeout(() => setPsnMsg(null), 4000);
    } else {
      const d = await res.json();
      setPsnMsg({ type: 'err', text: d.error || 'PSN authentication failed.' });
    }
    setReconnecting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        Settings
      </h1>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Credentials are stored locally on your machine only.
      </p>

      {/* Steam section */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Steam
        </h2>
        <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-800)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Field
            label="Steam API Key"
            type="password"
            value={apiKey}
            placeholder={apiKey ? '••••••••••••••••' : 'Paste your Steam Web API key'}
            onChange={setApiKey}
          />
          <Field
            label="Steam ID (64-bit)"
            value={steamId}
            placeholder="e.g. 76561198012345678"
            onChange={setSteamId}
          />
        </div>
      </section>

      {/* AI section */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
          AI Classification
        </h2>
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-800)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Field
            label="Anthropic API Key"
            hint="(optional — for AI classification)"
            type="password"
            value={anthropicKey}
            placeholder={anthropicKey ? '••••••••••••••••' : 'sk-ant-...'}
            onChange={setAnthropicKey}
          />
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {msg && (
          <span className={`text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>

      {/* PSN section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
          PlayStation Network
        </h2>
        <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-800)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
            To get your NPSSO token: sign in at{' '}
            <span className="text-white/60">store.playstation.com</span>, then visit{' '}
            <span className="font-mono text-white/60">ca.account.sony.com/api/v1/ssocookie</span>{' '}
            in the same browser. Copy the <span className="font-mono">npsso</span> value.
          </p>
          <Field
            label="NPSSO Token"
            type="password"
            value={npsso}
            placeholder={npsso ? '••••••••••••••••' : 'Paste your NPSSO token'}
            onChange={setNpsso}
          />
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={reconnectPsn}
              disabled={reconnecting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ background: 'rgba(225,29,72,0.2)', border: '1px solid rgba(225,29,72,0.3)' }}
            >
              {reconnecting ? 'Connecting…' : 'Save & Connect PSN'}
            </button>
            {psnMsg && (
              <span className={`text-sm ${psnMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {psnMsg.text}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
