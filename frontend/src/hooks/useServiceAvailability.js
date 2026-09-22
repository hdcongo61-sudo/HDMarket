import { useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AuthContext from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { useAppSettings } from '../context/AppSettingsContext';
import api from '../services/api';
import { subscribeToSettingsRefresh } from '../utils/settingsRefresh';

const flag = (value) => ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());

// One shared cache for home, navigation and informational pages. Disabled or
// unavailable services never retain a stale promotional link.
export default function useServiceAvailability() {
  const { user } = useContext(AuthContext);
  const { country } = useCountry();
  const { getRuntimeValue, isFeatureEnabled } = useAppSettings();
  const queryClient = useQueryClient();
  const countryId = String(country?.id || country?._id || '');
  const userId = String(user?._id || user?.id || '');
  const buyFlag = isFeatureEnabled('enable_buy_for_me', { defaultValue: true });
  const parcelFlag = isFeatureEnabled('enable_parcel_delivery', { defaultValue: true }) && flag(getRuntimeValue('enable_parcel_delivery', true));
  const capabilities = useQuery({
    queryKey: ['service-availability', countryId, userId, buyFlag, parcelFlag],
    queryFn: async () => {
      const config = { skipCache: true, silentGlobalError: true, headers: countryId ? { 'x-country-id': countryId } : {} };
      const [buy, parcel] = await Promise.allSettled([
        buyFlag ? api.get('/buy-for-me/capabilities', config) : Promise.resolve(null),
        parcelFlag ? api.get('/parcels/capabilities', config) : Promise.resolve(null)
      ]);
      return {
        buy: buy.status === 'fulfilled' && flag(buy.value?.data?.enabled),
        parcel: parcel.status === 'fulfilled' && flag(parcel.value?.data?.enabled)
      };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always'
  });
  useEffect(() => subscribeToSettingsRefresh(() => {
    void queryClient.invalidateQueries({ queryKey: ['service-availability'] }, { cancelRefetch: false });
  }), [queryClient]);
  return {
    buyForMeEnabled: buyFlag && capabilities.data?.buy === true,
    parcelDeliveryEnabled: parcelFlag && capabilities.data?.parcel === true,
    payForOtherEnabled: isFeatureEnabled('enable_pay_for_other', { defaultValue: false }) && flag(getRuntimeValue('enable_pay_for_other', false)),
    fullPaymentFreeDeliveryEnabled: flag(getRuntimeValue('enable_full_payment_free_delivery', true)) && flag(getRuntimeValue('full_payment_promotion_enabled', true))
  };
}
