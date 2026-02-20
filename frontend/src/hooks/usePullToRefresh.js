import { useRef, useState } from 'react';

export default function usePullToRefresh(onRefresh, options = {}) {
  const { threshold = 80, maxPull = 120, enabled = true } = options;
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const reset = () => {
    pullingRef.current = false;
    setPullDistance(0);
  };

  const handleTouchStart = (event) => {
    if (!enabled || refreshing) return;
    if ((typeof window !== 'undefined' && window.scrollY > 0) || !event.touches?.length) return;
    startYRef.current = event.touches[0].clientY;
    pullingRef.current = true;
  };

  const handleTouchMove = (event) => {
    if (!enabled || refreshing || !pullingRef.current || !event.touches?.length) return;
    const delta = event.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    const limited = Math.min(maxPull, delta * 0.55);
    setPullDistance(limited);
    if (delta > 4) {
      event.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!enabled || refreshing || !pullingRef.current) {
      reset();
      return;
    }
    pullingRef.current = false;

    if (pullDistance < threshold) {
      setPullDistance(0);
      return;
    }

    setRefreshing(true);
    setPullDistance(threshold);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  };

  return {
    pullDistance,
    refreshing,
    bind: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd
    }
  };
}
