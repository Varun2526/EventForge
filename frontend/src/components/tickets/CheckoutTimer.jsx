import React, { useState, useEffect } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

export default function CheckoutTimer({ expiresAt, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const calculateTime = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && onExpired) {
        onExpired();
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 120 && timeLeft > 0;

  return (
    <div
      className={`flex items-center justify-between p-3.5 rounded-xl border backdrop-blur-md transition-all ${
        isUrgent
          ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 animate-pulse'
          : 'bg-brand-500/10 border-brand-500/30 text-brand-300'
      }`}
    >
      <div className="flex items-center gap-2">
        {isUrgent ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <Timer className="w-4 h-4 text-brand-400" />}
        <span className="text-xs font-semibold uppercase tracking-wider">
          {timeLeft > 0 ? 'Checkout Hold Active' : 'Hold Expired'}
        </span>
      </div>

      <div className="font-mono text-base font-bold tracking-wider">
        {timeLeft > 0 ? (
          <span>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        ) : (
          <span className="text-xs text-rose-400 font-sans">00:00 (Expired)</span>
        )}
      </div>
    </div>
  );
}
