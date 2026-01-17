import React from 'react';

export default function MobileSplash({ visible, logoSrc, label = 'HDMarket' }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-white">
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={label}
          className="h-20 w-20 object-contain"
        />
      ) : (
        <span className="text-2xl font-semibold text-gray-900">{label}</span>
      )}
    </div>
  );
}
