'use client';

interface Props {
  text: string;
  children: React.ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50
        opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150">
        <div className="w-2 h-2 bg-gray-900 border-l border-t border-white/10 rotate-45 mx-auto -mb-1" />
        <div className="bg-gray-900 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 shadow-xl w-48 text-center leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}
