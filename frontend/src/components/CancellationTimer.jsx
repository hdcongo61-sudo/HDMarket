import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

/**
 * Timer component showing remaining time in 30-minute cancellation window
 */
export default function CancellationTimer({ deadline, remainingMs: initialRemainingMs, isActive, onExpire }) {
  const [remainingMs, setRemainingMs] = useState(initialRemainingMs || 0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!isActive || remainingMs <= 0) {
      setExpired(true);
      if (onExpire) onExpire();
      return;
    }

    const interval = setInterval(() => {
      if (deadline) {
        const now = Date.now();
        const deadlineTime = new Date(deadline).getTime();
        const remaining = deadlineTime - now;
        
        if (remaining <= 0) {
          setRemainingMs(0);
          setExpired(true);
          if (onExpire) onExpire();
          clearInterval(interval);
        } else {
          setRemainingMs(remaining);
        }
      } else {
        // Fallback: decrement from initial remainingMs
        setRemainingMs((prev) => {
          const next = prev - 1000;
          if (next <= 0) {
            setExpired(true);
            if (onExpire) onExpire();
            clearInterval(interval);
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, isActive, onExpire]);

  if (!isActive || expired) {
    return null;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = minutes < 5;

  const formatTime = (mins, secs) => {
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 ${
        isUrgent
          ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
          : 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400'
      }`}
    >
      <Clock
        size={18}
        className={`${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}
      />
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide mb-0.5">
          Délai d'annulation
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black tabular-nums">
            {formatTime(minutes, seconds)}
          </span>
          <span className="text-xs font-medium">
            restant{minutes > 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {isUrgent && (
        <AlertCircle
          size={16}
          className="text-red-600 dark:text-red-400 animate-pulse"
        />
      )}
    </div>
  );
}
