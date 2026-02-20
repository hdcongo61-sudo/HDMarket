import React from 'react';
import { MapPin } from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';

export default function CitySelector({ className = '' }) {
  const { city, cities, setCity, loading } = useAppSettings();
  const safeValue =
    (cities || []).some((item) => item.name === city)
      ? city
      : cities?.[0]?.name || '';

  return (
    <label className={`flex items-center gap-3 ${className}`}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 dark:border-neutral-700 dark:text-neutral-300">
        <MapPin size={16} />
      </span>
      <select
        value={safeValue}
        disabled={loading || !cities?.length}
        onChange={(e) => setCity(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40"
      >
        {(cities || []).map((item) => (
          <option key={item._id || item.name} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
