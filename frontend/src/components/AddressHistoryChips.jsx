import { ClockIcon } from '@heroicons/react/24/outline';
import { resolveAddressNames } from '../utils/addressHistory';

export default function AddressHistoryChips({ items, cities, communes, onPick, label = 'Adresses récentes' }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-gray-400">
        <ClockIcon className="text-[#FF5000] h-3 w-3" /> {label}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, index) => {
          const { cityName, communeName } = resolveAddressNames(item, cities, communes);
          const text = `${communeName || cityName || 'Adresse'} · ${item.address}`;
          return (
            <button
              key={`${item.usedAt || index}-${index}`}
              type="button"
              title={text}
              onClick={() => onPick(item)}
              className="shrink-0 max-w-[220px] truncate rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-colors active:border-[#FF5000] active:text-[#FF5000]"
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
