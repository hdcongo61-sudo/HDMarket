import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * CountdownTimer — Reusable countdown component for flash sales.
 * Shows HH:MM:SS format with red pulse when < 1 hour remaining.
 *
 * @param {Date|string} endDate - Target end time
 * @param {Function} onExpired - Called when countdown reaches zero
 * @param {string} className - Additional classes
 */
export default function CountdownTimer({ endDate, onExpired, className = '' }) {
  const calcRemaining = useCallback(() => {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      expired: false
    };
  }, [endDate]);

  const [time, setTime] = useState(calcRemaining);
  const expiredCalled = useRef(false);

  useEffect(() => {
    expiredCalled.current = false;
    setTime(calcRemaining());
  }, [calcRemaining]);

  useEffect(() => {
    if (time.expired) {
      if (!expiredCalled.current) {
        expiredCalled.current = true;
        onExpired?.();
      }
      return;
    }

    const timer = setInterval(() => {
      const next = calcRemaining();
      setTime(next);
    }, 1000);

    return () => clearInterval(timer);
  }, [time.expired, calcRemaining, onExpired]);

  const pad = (n) => String(n).padStart(2, '0');

  const isUrgent = !time.expired && time.hours === 0 && time.minutes < 60;

  if (time.expired) {
    return <span className={`text-xs font-bold text-gray-400 ${className}`}>Terminé</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums ${
        isUrgent ? 'animate-pulse text-red-500' : 'text-red-600'
      } ${className}`}
    >
      <span className="rounded bg-red-50 px-1 py-0.5">{pad(time.hours)}</span>
      <span className="text-red-400">:</span>
      <span className="rounded bg-red-50 px-1 py-0.5">{pad(time.minutes)}</span>
      <span className="text-red-400">:</span>
      <span className="rounded bg-red-50 px-1 py-0.5">{pad(time.seconds)}</span>
    </span>
  );
}
