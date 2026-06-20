'use client';
import { useEffect, useState, useRef } from 'react';
import type { FilteredGame } from '@/lib/types';

interface Props {
  onComplete: (filtered: FilteredGame[]) => void;
}

interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'warning';
  phase?: 'tags' | 'claude';
  current?: number;
  total?: number;
  game?: string;
  filtered?: FilteredGame[];
  message?: string;
}

export default function AnalysisProgress({ onComplete }: Props) {
  const [phase, setPhase] = useState<'tags' | 'claude' | 'done'>('tags');
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentGame, setCurrentGame] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/games/analyze');
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as ProgressEvent;

      if (data.type === 'start') {
        setTotal(data.total ?? 0);
      } else if (data.type === 'progress') {
        setCurrent(data.current ?? 0);
        setPhase(data.phase ?? 'tags');
        setCurrentGame(data.game ?? '');
      } else if (data.type === 'warning') {
        setWarnings(w => [...w, data.message ?? 'Unknown warning']);
      } else if (data.type === 'complete') {
        setPhase('done');
        es.close();
        onComplete(data.filtered ?? []);
      } else if (data.type === 'error') {
        setError(data.message ?? 'Unknown error');
        es.close();
      }
    };

    es.onerror = () => {
      setError('Connection to analysis stream lost. Please refresh and try again.');
      es.close();
    };

    return () => { es.close(); };
  }, [onComplete]);

  const progress = total > 0 ? (current / total) * 100 : 0;
  const phaseLabel = phase === 'tags' ? 'Fetching tags & completion times' : phase === 'claude' ? 'AI classification' : 'Wrapping up…';

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-blue-500/20">
            🔍
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Analysing your library</h2>
          <p className="text-gray-400 text-sm">
            {total > 0 ? `Checking ${total} games — this may take a minute` : 'Starting…'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white/5 rounded-full h-2 mb-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 mb-6">
          <span>{phaseLabel}</span>
          <span>{total > 0 ? `${current} / ${total}` : ''}</span>
        </div>

        {/* Current game */}
        {currentGame && (
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm text-gray-300 truncate">{currentGame}</span>
          </div>
        )}

        {/* Phase steps */}
        <div className="space-y-2 mb-4">
          {[
            { key: 'tags', label: 'Fetching SteamSpy tags & HowLongToBeat data' },
            { key: 'claude', label: 'AI classification (game types, multiplayer detection)' },
            { key: 'done', label: 'Applying auto-filter rules' },
          ].map(step => {
            const phases = ['tags', 'claude', 'done'];
            const stepIdx = phases.indexOf(step.key);
            const currentIdx = phases.indexOf(phase);
            const done = stepIdx < currentIdx || phase === 'done';
            const active = step.key === phase;

            return (
              <div key={step.key} className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg transition-all ${active ? 'bg-blue-500/10' : ''}`}>
                <span className="flex-shrink-0">
                  {done ? '✅' : active ? <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : '⏳'}
                </span>
                <span className={done ? 'text-gray-400 line-through' : active ? 'text-white' : 'text-gray-600'}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {warnings.map((w, i) => (
          <p key={i} className="text-yellow-400 text-xs bg-yellow-400/10 rounded-lg px-3 py-2 mb-2">
            ⚠ {w}
          </p>
        ))}

        {error && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-4 mt-4">
            <p className="text-red-400 text-sm font-medium mb-1">Analysis failed</p>
            <p className="text-red-300/70 text-xs">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
