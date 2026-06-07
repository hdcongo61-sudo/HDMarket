import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCcw } from 'lucide-react';

/**
 * PullToRefresh — Wraps children and enables pull-down-to-refresh gesture.
 * Calls onRefresh() when the user pulls down past the threshold.
 * Shows a subtle indicator at the top.
 */
export default function PullToRefresh({ onRefresh, children, disabled = false, className = '' }) {
  const containerRef = useRef(null);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const THRESHOLD = 60;

  const handleTouchStart = useCallback((e) => {
    if (disabled || refreshing) return;
    // Only activate when scrolled to top
    if (window.scrollY > 5) return;
    startYRef.current = e.touches[0].clientY;
    setPulling(true);
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startYRef.current);
    if (distance > 10) {
      setPullDistance(Math.min(distance * 0.5, 100));
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || refreshing) {
      setPulling(false);
      setPullDistance(0);
      return;
    }
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh?.();
      } catch { /* ignore */ }
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {(pulling || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: Math.max(0, pullDistance) }}
        >
          <RefreshCcw
            size={20}
            className={`text-gray-400 transition-all ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: Math.min(1, pullDistance / THRESHOLD) }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
