import { useEffect, useState } from 'react';
import api from '../services/api';
import { guestCartSelections } from '../utils/guestCart';

export default function useDeliveryEstimate({ items, cityId, communeId, enabled, countryId }) {
  const signature = JSON.stringify({ items: guestCartSelections({ items }), cityId, communeId, countryId });
  const [state, setState] = useState({ signature: '', data: null, error: '' });
  const [retryKey, setRetryKey] = useState(0);
  const ready = enabled && items.length > 0 && cityId && communeId;
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const { countryId: requestCountryId, ...payload } = JSON.parse(signature);
    api.post('/cart/delivery-estimate', payload, { silentGlobalError: true, headers: { 'x-country-id': requestCountryId } })
      .then(({ data }) => { if (active) setState({ signature, data, error: '' }); })
      .catch((error) => { if (active) setState({ signature, data: null, error: error.response?.data?.message || 'Estimation indisponible. Réessayez avant de payer.' }); });
    return () => { active = false; };
  }, [ready, signature, retryKey]);
  const current = ready && state.signature === signature;
  return { data: current ? state.data : null, error: current ? state.error : '', loading: Boolean(ready && !current), retry: () => { setState({ signature: '', data: null, error: '' }); setRetryKey((value) => value + 1); } };
}
