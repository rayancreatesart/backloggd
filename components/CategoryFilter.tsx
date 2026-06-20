'use client';
import type { Category } from '@/lib/types';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

type FilterTab = 'all' | Category;

interface Props {
  active: FilterTab;
  counts: Record<string, number>;
  onChange: (tab: FilterTab) => void;
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',           label: 'All' },
  { key: 'play_now',      label: CATEGORY_LABELS.play_now },
  { key: 'play_later',    label: CATEGORY_LABELS.play_later },
  { key: 'in_progress',   label: CATEGORY_LABELS.in_progress },
  { key: 'completed',     label: CATEGORY_LABELS.completed },
  { key: 'dropped',       label: CATEGORY_LABELS.dropped },
  { key: 'dont_bother',   label: CATEGORY_LABELS.dont_bother },
  { key: 'na',            label: CATEGORY_LABELS.na },
  { key: 'uncategorised', label: CATEGORY_LABELS.uncategorised },
];

export default function CategoryFilter({ active, counts, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 justify-center" style={{ scrollbarWidth: 'none' }}>
      {TABS.map(tab => {
        const isActive = active === tab.key;
        const count = counts[tab.key] ?? 0;
        const color = tab.key === 'all' ? '#e2e8f0' : CATEGORY_COLORS[tab.key as Category];

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="flex-shrink-0 flex flex-col items-start px-3 py-3 rounded-2xl border transition-all duration-200"
            style={isActive ? { minWidth: 110,
              backgroundColor: tab.key === 'all' ? 'rgba(255,255,255,0.1)' : color + '1a',
              borderColor: tab.key === 'all' ? 'rgba(255,255,255,0.3)' : color + 'aa',
              boxShadow: `0 0 12px ${tab.key === 'all' ? 'rgba(255,255,255,0.05)' : color + '22'}`,
            } : {
              minWidth: 110,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <span
              className="text-2xl font-bold leading-none tabular-nums"
              style={{ color: isActive ? (tab.key === 'all' ? 'white' : color) : 'white' }}
            >
              {count}
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              {tab.key !== 'all' && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isActive ? color : 'rgba(255,255,255,0.3)' }}
                />
              )}
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: isActive ? (tab.key === 'all' ? 'rgba(255,255,255,0.9)' : color) : 'rgba(255,255,255,0.4)' }}
              >
                {tab.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
