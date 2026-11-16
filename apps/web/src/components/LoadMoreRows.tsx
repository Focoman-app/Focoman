"use client";

import { useEffect, useRef } from 'react';

/** Observe the nearest scrolling panel, not the browser window. */
export function LoadMoreRows({ hasMore, loading, error, onLoad }: {
  hasMore: boolean; loading: boolean; error?: string | null; onLoad: () => void;
}) {
  const marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loading || error || !marker.current || typeof IntersectionObserver === 'undefined') return;
    let root = marker.current.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onLoad();
    }, { root, rootMargin: '150px' });
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, onLoad]);
  if (!hasMore && !error) return null;
  return <div ref={marker} className="p-4 text-center text-xs">
    {error && <p role="alert" className="mb-2 text-red-700">{error}</p>}
    <button type="button" disabled={loading} onClick={onLoad} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">
      {loading ? 'Loading more…' : error ? 'Retry' : 'Load more'}
    </button>
  </div>;
}
