import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const DEFAULT_DURATION = 3;

export default function SplashScreen({ splashImage, splashDurationSeconds = DEFAULT_DURATION, onDismiss }) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(splashDurationSeconds);
  const duration = Math.min(30, Math.max(1, Number(splashDurationSeconds) || DEFAULT_DURATION));

  useEffect(() => {
    if (countdown <= 0) {
      onDismiss?.();
      navigate('/', { replace: true });
      return;
    }
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown, navigate, onDismiss]);

  const handleSkip = () => {
    onDismiss?.();
    navigate('/', { replace: true });
  };

  if (!splashImage) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative flex-1 min-h-0">
        <img
          src={splashImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="absolute top-0 right-0 flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={handleSkip}
          className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg hover:bg-white transition-colors"
          aria-label="Passer"
        >
          <span>Passer</span>
          <span className="min-w-[1.25rem] tabular-nums">{countdown}</span>
          <X size={18} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
}
