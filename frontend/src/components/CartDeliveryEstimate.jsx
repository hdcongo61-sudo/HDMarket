import React, { useEffect, useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCountry } from '../context/CountryContext';
import useDeliveryEstimate from '../hooks/useDeliveryEstimate';
import { readDeliveryPreference, saveDeliveryPreference } from '../utils/deliveryPreference';
import { formatPriceWithStoredSettings as price } from '../utils/priceFormatter';

export default function CartDeliveryEstimate({ items, subtotal }) {
  const { cities = [], communes = [] } = useAppSettings();
  const { country } = useCountry();
  const countryId = String(country?.id || country?._id || '');
  const [choice, setChoice] = useState(() => readDeliveryPreference(countryId));
  const { cityId = '', communeId = '', deliveryMode = 'PICKUP' } = choice;
  const deliveryUnavailable = items.some((item) => item.product?.deliveryAvailable === false);
  const pickupUnavailable = items.some((item) => item.product?.pickupAvailable === false);
  const mode = deliveryUnavailable ? 'PICKUP' : pickupUnavailable ? 'DELIVERY' : deliveryMode;
  const estimate = useDeliveryEstimate({ items, cityId, communeId, enabled: mode === 'DELIVERY', countryId });
  useEffect(() => { saveDeliveryPreference(countryId, { deliveryMode: mode, cityId, communeId }); }, [countryId, mode, cityId, communeId]);
  const districts = communes.filter((commune) => String(commune.cityId?._id || commune.cityId) === cityId);
  const total = mode === 'PICKUP' ? subtotal : estimate.data?.total;
  const fieldClass = 'min-h-11 w-full rounded-xl border border-[#e2dcd2] bg-white px-3 text-sm';
  return <section className="space-y-3 border-t border-[#e2dcd2] pt-4" aria-label="Estimation de livraison">
    <label className="block text-sm font-bold">Mode de réception
      <select className={`${fieldClass} mt-2`} value={mode} onChange={(event) => setChoice({ ...choice, deliveryMode: event.target.value })}>
        <option value="PICKUP" disabled={pickupUnavailable}>Retrait en boutique · Gratuit</option>
        <option value="DELIVERY" disabled={deliveryUnavailable}>Livraison à domicile</option>
      </select>
    </label>
    {mode === 'DELIVERY' && <>
      <label className="block text-sm">Ville<select className={fieldClass} value={cityId} onChange={(event) => setChoice({ ...choice, deliveryMode: mode, cityId: event.target.value, communeId: '' })}><option value="">Choisir la ville</option>{cities.map((city) => <option key={city._id} value={city._id}>{city.name}</option>)}</select></label>
      <label className="block text-sm">Commune<select className={fieldClass} value={communeId} disabled={!cityId} onChange={(event) => setChoice({ ...choice, deliveryMode: mode, communeId: event.target.value })}><option value="">Choisir la commune</option>{districts.map((commune) => <option key={commune._id} value={commune._id}>{commune.name}</option>)}</select></label>
      <p className="text-xs text-[#6b6459]" role="status">{estimate.error || (estimate.loading ? 'Calcul de la livraison…' : estimate.data ? `Livraison : ${price(estimate.data.deliveryFeeTotal)}. Offerte avec un paiement intégral PawaPay.` : 'Choisissez votre destination pour voir le total livré.')}</p>
      {estimate.error && <button type="button" onClick={estimate.retry} className="text-sm font-bold text-[#e85d00] underline">Réessayer le calcul</button>}
    </>}
    <div className="flex justify-between gap-3 font-black"><span>{mode === 'PICKUP' ? 'Total au retrait' : 'Total livré estimé'}</span><span>{total == null ? 'À calculer' : price(total)}</span></div>
  </section>;
}
