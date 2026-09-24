import React from 'react';

export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-brand-500/20 border-t-brand-500 animate-spin`}
      />
      {text && <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">{text}</span>}
    </div>
  );
}
