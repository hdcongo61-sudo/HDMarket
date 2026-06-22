import React, { useMemo } from 'react';
import { MapPin, Navigation, Package, Home, Store } from 'lucide-react';

/**
 * OrderTrackingMap — Lightweight order tracking with OSM map + timeline.
 * No Leaflet dependency — uses OpenStreetMap static tiles via iframe.
 * Perfect for low-connectivity zones (Congo/Brazzaville).
 *
 * Props:
 *   trackingData — from GET /api/orders/:id/tracking
 */

export default function OrderTrackingMap({ trackingData }) {
  if (!trackingData) return null;

  const { checkpoints = [], currentPosition, mapCenter, courierName, status } = trackingData;

  // Filter checkpoints with coordinates for map markers
  const mapCheckpoints = useMemo(
    () => checkpoints.filter((cp) => cp.coordinates?.lat && cp.coordinates?.lng),
    [checkpoints]
  );

  // Build OSM iframe URL
  const mapUrl = useMemo(() => {
    const lat = mapCenter?.lat || -4.2634;
    const lng = mapCenter?.lng || 15.2429;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}&layer=mapnik&marker=${lat},${lng}`;
  }, [mapCenter]);

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="relative aspect-[4/3] w-full">
          <iframe
            src={mapUrl}
            title="Carte de suivi"
            className="h-full w-full border-0"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
          />
          {/* Overlay: Courier info */}
          {courierName && (
            <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-3 py-1.5 shadow backdrop-blur-sm">
              <p className="text-xs font-semibold text-gray-800">
                🚚 {courierName}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-900">📋 Suivi de la commande</h3>
        <div className="relative space-y-0">
          {checkpoints.map((cp, idx) => {
            const isLast = idx === checkpoints.length - 1;
            const isCurrent = cp.isCurrent;
            return (
              <div key={`${cp.type}-${idx}`} className="relative flex gap-3 pb-4">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[15px] top-8 h-full w-0.5 bg-gray-200" />
                )}

                {/* Icon */}
                <div
                  className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                    isCurrent
                      ? 'bg-gray-1000 text-white shadow-md ring-4 ring-gray-200'
                      : cp.active
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-gray-50 text-gray-300'
                  }`}
                >
                  {cp.icon || '📍'}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${isCurrent ? 'text-orange-600' : 'text-gray-800'}`}>
                      {cp.label}
                    </p>
                    {isCurrent && (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                        Actuel
                      </span>
                    )}
                  </div>
                  {cp.time && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(cp.time).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                  {cp.description && (
                    <p className="mt-1 text-xs text-gray-600">{cp.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* No checkpoints */}
        {checkpoints.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">
            Aucune information de suivi disponible pour le moment.
          </p>
        )}
      </div>

      {/* Map markers summary */}
      {mapCheckpoints.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h4 className="mb-2 text-xs font-semibold text-gray-600">📍 Points de repère</h4>
          <div className="flex flex-wrap gap-2">
            {mapCheckpoints.map((cp, idx) => (
              <span
                key={`pin-${idx}`}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
              >
                {cp.icon} {cp.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
