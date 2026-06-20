'use client';

export default function WishlistPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5"
        style={{ background: 'rgba(225,29,72,0.12)', border: '1px solid rgba(225,29,72,0.2)' }}
      >
        ⭐
      </div>
      <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Wishlist coming soon
      </h2>
      <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Track games you want to buy across Steam and PlayStation — before they hit your backlog.
      </p>
    </div>
  );
}
