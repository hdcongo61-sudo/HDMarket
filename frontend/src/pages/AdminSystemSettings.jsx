import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdjustmentsHorizontalIcon, ArrowLeftIcon, ArrowPathIcon, Bars2Icon, BuildingLibraryIcon, CheckIcon, ChevronDownIcon, CurrencyDollarIcon, GlobeAltIcon, LanguageIcon, MagnifyingGlassIcon, MapPinIcon, PlusIcon, QuestionMarkCircleIcon, TrashIcon, TruckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { emitSettingsRefresh } from '../utils/settingsRefresh';
import useIsMobile from '../hooks/useIsMobile';
import { appConfirm } from '../utils/appDialog';
import { AdminCommandHero } from '../components/admin/AdminCommandSurface';

const FEE_FIELDS = [
  { key: 'commissionRate', label: 'Taux commission (%)', type: 'number', step: 0.1 },
  { key: 'boostEnabled', label: 'Boost activé', type: 'boolean' },
  { key: 'installmentMinPercent', label: 'Tranche min (%)', type: 'number', step: 1 },
  { key: 'installmentMaxDuration', label: 'Durée max tranche (jours)', type: 'number', step: 1 },
  { key: 'shopConversionAmount', label: 'Montant devenir boutique', type: 'number', step: 1 },
  {
    key: 'analyticsViewWeight',
    label: 'Importance des vues',
    type: 'number',
    step: 0.01,
    help: 'PlusIcon la valeur est élevée, plus le nombre de vues influence le score produit.'
  },
  {
    key: 'analyticsConversionWeight',
    label: 'Importance de la conversion',
    type: 'number',
    step: 0.01,
    help: 'Poids du taux de conversion (commandes / vues) dans le score produit.'
  },
  {
    key: 'analyticsRevenueWeight',
    label: 'Importance du revenu',
    type: 'number',
    step: 0.001,
    help: 'Poids du revenu généré par le produit dans le score final.'
  },
  { key: 'analyticsRefundPenalty', label: 'Pénalité score litige', type: 'number', step: 0.1 },
  { key: 'disputeWindowHours', label: 'Fenêtre litige (heures)', type: 'number', step: 1 },
  { key: 'escrowAutoReleaseDelayMinutes', label: 'Libération automatique (minutes)', type: 'number', step: 1 },
  { key: 'escrowDisputeEnabled', label: 'Litiges escrow activés', type: 'boolean' },
  { key: 'escrowMaximumDisputeTimeMinutes', label: 'Délai maximum de litige (minutes)', type: 'number', step: 1 },
  { key: 'escrowMinimumDepositPercent', label: 'Acompte minimum escrow (%)', type: 'number', step: 1 },
  { key: 'escrowHighValueOrderThreshold', label: 'Seuil commande grande valeur (FCFA)', type: 'number', step: 1000 },
  { key: 'deliveryOTPExpirationMinutes', label: 'Expiration OTP livraison (min)', type: 'number', step: 1 },
  { key: 'maxDisputesPerMonth', label: 'Max litiges / mois', type: 'number', step: 1 },
  { key: 'maxUploadImages', label: 'Max images upload', type: 'number', step: 1 }
];

const FEE_GROUPS = [
  {
    title: 'Commissions & boosts',
    keys: ['commissionRate', 'boostEnabled', 'shopConversionAmount', 'maxUploadImages']
  },
  {
    title: 'Paiement par tranches',
    keys: ['installmentMinPercent', 'installmentMaxDuration', 'deliveryOTPExpirationMinutes']
  },
  {
    title: 'Séquestre vendeur (escrow)',
    keys: [
      'escrowAutoReleaseDelayMinutes',
      'escrowDisputeEnabled',
      'escrowMaximumDisputeTimeMinutes',
      'escrowMinimumDepositPercent',
      'escrowHighValueOrderThreshold'
    ]
  },
  {
    title: 'Scores & litiges',
    keys: [
      'analyticsViewWeight',
      'analyticsConversionWeight',
      'analyticsRevenueWeight',
      'analyticsRefundPenalty',
      'disputeWindowHours',
      'maxDisputesPerMonth'
    ]
  }
];

const FEE_RUNTIME_KEY_MAP = {
  commissionRate: 'commission_rate',
  boostEnabled: 'enable_boost',
  installmentMinPercent: 'installmentMinPercent',
  installmentMaxDuration: 'installmentMaxDuration',
  shopConversionAmount: 'shopConversionAmount',
  analyticsViewWeight: 'analyticsViewWeight',
  analyticsConversionWeight: 'analyticsConversionWeight',
  analyticsRevenueWeight: 'analyticsRevenueWeight',
  analyticsRefundPenalty: 'analyticsRefundPenalty',
  disputeWindowHours: 'dispute_window_hours',
  escrowAutoReleaseDelayMinutes: 'escrow_auto_release_delay_minutes',
  escrowDisputeEnabled: 'escrow_dispute_enabled',
  escrowMaximumDisputeTimeMinutes: 'escrow_max_dispute_time_minutes',
  escrowMinimumDepositPercent: 'escrow_minimum_deposit_percent',
  escrowHighValueOrderThreshold: 'escrow_high_value_order_threshold',
  deliveryOTPExpirationMinutes: 'otp_expiration_minutes',
  maxDisputesPerMonth: 'dispute_client_monthly_limit',
  maxUploadImages: 'max_image_upload'
};

const RUNTIME_FEE_KEY_MAP = Object.entries(FEE_RUNTIME_KEY_MAP).reduce((acc, [feeKey, runtimeKey]) => {
  acc[runtimeKey] = feeKey;
  return acc;
}, {});

const NOTIFICATION_RUNTIME_FLAGS = [
  {
    key: 'push_enabled',
    label: 'Push notifications globales',
    fallbackDescription: 'Active ou coupe l’envoi push côté plateforme.'
  },
  {
    key: 'push_when_online',
    label: 'Push quand utilisateur en ligne',
    fallbackDescription: 'Envoie aussi un push même si l’utilisateur est connecté dans l’app.'
  },
  {
    key: 'push_for_priority_high_only',
    label: 'Push HIGH/CRITICAL uniquement',
    fallbackDescription: 'Réduit le volume push en limitant aux priorités élevées.'
  }
];

const NETWORK_RUNTIME_QUICK_FLAGS = [
  {
    key: 'enable_rapid_3g_mode',
    label: 'Mode Rapide 3G',
    fallbackDescription: 'Allège le chargement sur connexions lentes et mode économie de données.'
  },
  {
    key: 'enable_offline_browsing',
    label: 'Navigation hors ligne',
    fallbackDescription: 'Autorise l’affichage du catalogue à partir des derniers snapshots en cache.'
  }
];

const COMMERCE_RUNTIME_CONTROLS = [
  {
    key: 'enable_selling',
    label: 'Fonction Vendre',
    fallbackDescription: 'Active ou coupe la publication de nouvelles annonces.'
  },
  {
    key: 'enable_shop_conversion',
    label: 'Devenir une boutique',
    fallbackDescription: 'Active ou coupe les demandes de conversion en boutique.'
  },
  {
    key: 'shop_creation_limit_count',
    label: 'Boutiques créées / période',
    fallbackDescription: 'Nombre maximum de boutiques pouvant être créées pendant la fenêtre.'
  },
  {
    key: 'shop_creation_limit_period_days',
    label: 'Période création boutique (jours)',
    fallbackDescription: 'Durée de la fenêtre utilisée pour limiter les créations de boutiques.'
  },
  {
    key: 'seller_max_product_limit',
    label: 'Produits max par boutique',
    fallbackDescription: 'Nombre maximum de produits publiables par une boutique.'
  },
  {
    key: 'user_max_product_limit',
    label: 'Produits max par utilisateur simple',
    fallbackDescription: 'Nombre maximum de produits publiables par un compte particulier.'
  }
];

const SYSTEM_SECTIONS = [
  { value: 'fees', label: 'Frais & règles', icon: BuildingLibraryIcon },
  { value: 'runtime', label: 'Configuration', icon: AdjustmentsHorizontalIcon },
  { value: 'flags', label: 'Fonctionnalités', icon: Bars2Icon },
  { value: 'languages', label: 'Langues', icon: LanguageIcon },
  { value: 'currencies', label: 'Devises', icon: CurrencyDollarIcon },
  { value: 'cities', label: 'Villes', icon: MapPinIcon },
  { value: 'communes', label: 'Communes', icon: TruckIcon }
];

const CURATED_RUNTIME_KEYS = new Set([
  ...COMMERCE_RUNTIME_CONTROLS.map((entry) => entry.key),
  ...NOTIFICATION_RUNTIME_FLAGS.map((entry) => entry.key),
  ...NETWORK_RUNTIME_QUICK_FLAGS.map((entry) => entry.key)
]);

// Fee keys live in the fees tab: exclude both their fee key and mapped runtime key
// from the generic runtime renderer so each setting is rendered exactly once.
const FEE_RELATED_RUNTIME_KEYS = new Set([
  ...Object.keys(FEE_RUNTIME_KEY_MAP),
  ...Object.values(FEE_RUNTIME_KEY_MAP)
]);

const emptyCurrencyForm = {
  code: '',
  symbol: '',
  name: '',
  decimals: 0,
  exchangeRateToDefault: 1,
  isDefault: false,
  isActive: true
};

const buildEmptyLanguage = () => ({
  code: '',
  name: '',
  isActive: true
});

const normalizeLabel = (value) => String(value || '').trim().toLowerCase();

const sortCities = (list = []) =>
  [...list].sort((a, b) => {
    const defaultDelta = Number(Boolean(b?.isDefault)) - Number(Boolean(a?.isDefault));
    if (defaultDelta !== 0) return defaultDelta;
    const orderDelta = Number(a?.order || 0) - Number(b?.order || 0);
    if (orderDelta !== 0) return orderDelta;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
  });

const sortCommunes = (list = []) =>
  [...list].sort((a, b) => {
    const orderDelta = Number(a?.order || 0) - Number(b?.order || 0);
    if (orderDelta !== 0) return orderDelta;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
  });

const parseBooleanSetting = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return false;
};

const parseNumberSetting = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLanguagesPayload = (languages = []) =>
  (languages || []).map((item) => ({
    code: String(item?.code || '').trim().toLowerCase(),
    name: String(item?.name || '').trim(),
    isActive: item?.isActive !== false
  }));

const serializeLanguagesConfig = (languages = [], defaultLanguage = '') =>
  JSON.stringify({
    defaultLanguage: String(defaultLanguage || '').trim().toLowerCase(),
    languages: normalizeLanguagesPayload(languages)
      .sort((a, b) => a.code.localeCompare(b.code, 'fr', { sensitivity: 'base' }))
  });

const normalizeFeesPayload = (payload = {}) =>
  FEE_FIELDS.reduce((acc, field) => {
    const rawValue = payload?.[field.key];
    acc[field.key] = field.type === 'boolean' ? parseBooleanSetting(rawValue) : parseNumberSetting(rawValue);
    return acc;
  }, {});

const resolveFeeValueFromRuntime = (feeKey, runtimeItems = [], fallbackValue = undefined) => {
  const runtimeKey = FEE_RUNTIME_KEY_MAP[feeKey] || feeKey;
  const candidates = [runtimeKey, feeKey];
  const runtimeMatch = (runtimeItems || []).find((item) =>
    candidates.includes(String(item?.key || ''))
  );
  if (!runtimeMatch) return fallbackValue;
  const raw = runtimeMatch?.value;
  const field = FEE_FIELDS.find((entry) => entry.key === feeKey);
  if (!field) return raw;
  return field.type === 'boolean' ? parseBooleanSetting(raw) : parseNumberSetting(raw);
};

const resolveCityName = (cityId, sourceCities = []) => {
  const normalizedId = String(cityId || '').trim();
  if (!normalizedId) return '';
  const match = (sourceCities || []).find((city) => String(city?._id || '') === normalizedId);
  return match?.name || '';
};

const normalizeCommuneWithCities = (commune, sourceCities = []) => {
  const rawCity = commune?.cityId;
  const normalizedCityId = String(rawCity?._id || rawCity || '').trim();
  const cityName = rawCity?.name || commune?.cityName || resolveCityName(normalizedCityId, sourceCities) || '';
  return {
    ...commune,
    cityId: normalizedCityId,
    cityName
  };
};

// Unified control styles
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950';
const INPUT_COMPACT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950';
const TEXTAREA_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950';
const SAVE_BUTTON_CLASS =
  'inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200 sm:min-h-9';

const Switch = ({ checked, onChange, disabled = false, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={Boolean(checked)}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e85d00] disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
    }`}
  >
    <span
      className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
      }`}
    />
  </button>
);

const SectionShell = ({ icon: Icon, title, description, badge, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF0E4] text-[#e85d00] dark:bg-[#e85d00]/15 dark:text-[#ff9a55]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2>
          {description ? (
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{description}</p>
          ) : null}
        </div>
      </div>
      {badge || null}
    </div>
    {children}
  </section>
);

const SectionNavButton = ({ section, active, onSelect, variant, dirtyCount = 0 }) => {
  const Icon = section.icon;
  const activeClass = 'bg-[#FFF0E4] font-black text-[#e85d00] dark:bg-[#e85d00]/15 dark:text-[#ff9a55]';
  const dot = dirtyCount > 0 ? (
    <span
      className={`ml-auto inline-flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-black ${
        active ? 'bg-[#e85d00] text-white' : 'bg-[#e85d00]/15 text-[#e85d00]'
      }`}
      aria-label={`${dirtyCount} modification${dirtyCount > 1 ? 's' : ''} non enregistrée${dirtyCount > 1 ? 's' : ''}`}
    >
      {dirtyCount}
    </span>
  ) : null;
  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={() => onSelect(section.value)}
        aria-pressed={active}
        className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs transition ${
          active
            ? `border-transparent ${activeClass}`
            : 'border-slate-200 bg-white font-semibold text-slate-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {section.label}
        {dot}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(section.value)}
      aria-pressed={active}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition ${
        active
          ? activeClass
          : 'font-semibold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      <Icon className="h-4 w-4" />
      {section.label}
      {dot}
    </button>
  );
};

const SectionSearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative mb-3">
    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 h-3.5 w-3.5" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-8 text-sm dark:border-neutral-700 dark:bg-neutral-950"
    />
    {value ? (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Effacer la recherche"
        className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:text-neutral-500 dark:hover:bg-neutral-800"
      >
        <XMarkIcon className="h-3 w-3" />
      </button>
    ) : null}
  </div>
);

const matchesQuery = (query, ...haystack) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((value) => String(value || '').toLowerCase().includes(needle));
};

const ACCENT_STYLES = {
  emerald: {
    panel: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20',
    title: 'text-emerald-700 dark:text-emerald-300',
    description: 'text-emerald-700/90 dark:text-emerald-200/90',
    item: 'border-emerald-100 bg-white/75 dark:border-emerald-900/70 dark:bg-neutral-950/40'
  },
  indigo: {
    panel: 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/20',
    title: 'text-indigo-700 dark:text-indigo-300',
    description: 'text-indigo-700/90 dark:text-indigo-200/90',
    item: 'border-indigo-100 bg-white/70 dark:border-indigo-900/70 dark:bg-neutral-950/40'
  },
  sky: {
    panel: 'border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20',
    title: 'text-sky-700 dark:text-sky-300',
    description: 'text-sky-700/90 dark:text-sky-200/90',
    item: 'border-sky-100 bg-white/70 dark:border-sky-900/70 dark:bg-neutral-950/40'
  }
};

const RuntimeFlagGroup = ({
  title,
  description,
  accent = 'emerald',
  items = [],
  grid = false,
  runtimeDrafts,
  runtimeSavingKey,
  onDraftChange,
  onSave,
  onResetOverride,
  tSetting,
  keyLabel
}) => {
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.emerald;
  return (
    <div className={`rounded-xl border p-3 ${styles.panel}`}>
      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${styles.title}`}>{title}</p>
      <p className={`mb-3 text-xs ${styles.description}`}>{description}</p>
      <div className={grid ? 'grid gap-2.5 md:grid-cols-2' : 'space-y-2.5'}>
        {items.map((entry) => {
          const setting = entry.setting;
          const key = entry.key;
          const isSaving = runtimeSavingKey === key;
          const draftValue = runtimeDrafts[key] ?? setting?.value;
          const label = tSetting(key, entry.label);
          return (
            <div key={key} className={`rounded-lg border p-2.5 ${styles.item}`}>
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-neutral-100">{label}</p>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                  {tSetting(key, setting?.description || entry.fallbackDescription, 'desc')}
                </p>
                <p className="mt-1 text-[10px] text-slate-400 dark:text-neutral-500">
                  {keyLabel}: <code className="rounded bg-white px-1 py-0.5 dark:bg-neutral-900">{key}</code>
                </p>
              </div>
              {setting ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {setting.valueType === 'boolean' ? (
                    <div className="flex min-h-9 items-center gap-2">
                      <Switch
                        checked={parseBooleanSetting(draftValue)}
                        onChange={(next) => onDraftChange(key, next)}
                        disabled={isSaving}
                        ariaLabel={label}
                      />
                      <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                        {parseBooleanSetting(draftValue) ? 'Activé' : 'Désactivé'}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={Number.isFinite(Number(setting?.min)) ? Number(setting.min) : 0}
                      max={Number.isFinite(Number(setting?.max)) ? Number(setting.max) : undefined}
                      value={draftValue ?? 0}
                      onChange={(event) => onDraftChange(key, event.target.value)}
                      className={INPUT_COMPACT_CLASS}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onSave(setting)}
                    disabled={isSaving}
                    className={SAVE_BUTTON_CLASS}
                  >
                    <CheckIcon className="h-3 w-3" />
                    {isSaving ? '…' : 'Enregistrer'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-red-600 dark:text-red-300">
                  Clé runtime introuvable côté API.
                </p>
              )}
              {setting?.countryOverride ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[#fff3e6] px-2 py-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#c84d00]">Valeur propre à ce pays</span>
                  <button
                    type="button"
                    onClick={() => onResetOverride?.(setting)}
                    disabled={isSaving}
                    className="text-[11px] font-bold text-[#c84d00] underline disabled:opacity-50"
                  >
                    Réinitialiser
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function AdminSystemSettings() {
  const { showToast } = useToast();
  const { user } = useContext(AuthContext);
  const { t, language } = useAppSettings();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Translate a runtime setting label or description
  const tSetting = useCallback((key, fallback, type = 'settings') => {
    const result = t(`admin.${type}.${key}`);
    return result && result !== `admin.${type}.${key}` ? result : (fallback || key);
  }, [t]);
  const isFounder = user?.role === 'founder';
  const isScopedCountryAdmin =
    user?.role === 'admin' && Array.isArray(user?.adminCountryIds) && user.adminCountryIds.length > 0;
  const [countryScope, setCountryScope] = useState('');
  const [adminCountries, setAdminCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState({});
  const [initialFees, setInitialFees] = useState({});
  const [savingFeeKey, setSavingFeeKey] = useState('');
  const [savingAllFees, setSavingAllFees] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [currencyForm, setCurrencyForm] = useState(emptyCurrencyForm);
  const [creatingCurrency, setCreatingCurrency] = useState(false);
  const [cities, setCities] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState('fr');
  const [initialLanguagesSignature, setInitialLanguagesSignature] = useState('');
  const [savingLanguages, setSavingLanguages] = useState(false);
  const [currencyRateDrafts, setCurrencyRateDrafts] = useState({});
  const [savingCurrencyCode, setSavingCurrencyCode] = useState('');
  const [runtimeSettings, setRuntimeSettings] = useState([]);
  const [runtimeDrafts, setRuntimeDrafts] = useState({});
  const [runtimeSavingKey, setRuntimeSavingKey] = useState('');
  const [runtimeEnvironment, setRuntimeEnvironment] = useState('');
  const [featureFlags, setFeatureFlags] = useState([]);
  const [featureSavingName, setFeatureSavingName] = useState('');
  const [activeSystemSection, setActiveSystemSection] = useState('fees');
  const [feeSearch, setFeeSearch] = useState('');
  const [runtimeSearch, setRuntimeSearch] = useState('');
  const [otherRuntimeManuallyOpen, setOtherRuntimeManuallyOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsResponse, runtimeResponse, featureFlagsResponse, countriesResponse] = await Promise.all([
        api.get('/admin/settings').catch(() => ({ data: {} })),
        api
          .get('/admin/config/runtime', {
            params: {
              includeHidden: isFounder ? 'true' : 'false',
              ...(countryScope ? { countryId: countryScope } : {})
            }
          })
          .catch(() => ({ data: { items: [] } })),
        api.get('/admin/config/feature-flags').catch(() => ({ data: { items: [] } })),
        api.get('/admin/countries').catch(() => ({ data: { items: [] } }))
      ]);
      setAdminCountries(Array.isArray(countriesResponse?.data?.items) ? countriesResponse.data.items : []);
      const data = settingsResponse?.data || {};
      const feeSource = data?.feesAndRules || data?.app || data?.fees || {};
      const runtimeItems = Array.isArray(runtimeResponse?.data?.items) ? runtimeResponse.data.items : [];
      const nextFees = normalizeFeesPayload(feeSource);
      const mergedFees = Object.keys(nextFees).reduce((acc, key) => {
        acc[key] = resolveFeeValueFromRuntime(key, runtimeItems, nextFees[key]);
        return acc;
      }, {});
      setFees(mergedFees);
      setInitialFees(mergedFees);
      setCurrencies(Array.isArray(data?.currencies) ? data.currencies : []);
      const nextCities = sortCities(Array.isArray(data?.cities) ? data.cities : []);
      const nextCommunesRaw = Array.isArray(data?.communes) ? data.communes : [];
      const nextCommunes = sortCommunes(
        nextCommunesRaw.map((commune) => normalizeCommuneWithCities(commune, nextCities))
      );
      setCities(nextCities);
      setCommunes(nextCommunes);
      const langs = Array.isArray(data?.languages?.languages) ? data.languages.languages : [];
      const resolvedDefaultLanguage = data?.languages?.defaultLanguage || langs[0]?.code || 'fr';
      setLanguages(langs);
      setDefaultLanguage(resolvedDefaultLanguage);
      setInitialLanguagesSignature(serializeLanguagesConfig(langs, resolvedDefaultLanguage));

      setRuntimeSettings(runtimeItems);
      setRuntimeEnvironment(String(runtimeResponse?.data?.environment || '').trim().toLowerCase() || 'all');
      setRuntimeDrafts(
        runtimeItems.reduce((acc, item) => {
          if (item?.valueType === 'array' || item?.valueType === 'json') {
            acc[item.key] = JSON.stringify(item.value ?? (item.valueType === 'array' ? [] : {}), null, 2);
          } else {
            acc[item.key] = item.value;
          }
          return acc;
        }, {})
      );

      const featureItems = Array.isArray(featureFlagsResponse?.data?.items)
        ? featureFlagsResponse.data.items
        : [];
      setFeatureFlags(featureItems);
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur chargement des parametres.', {
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, isFounder, countryScope]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Lock scoped admins to their assigned country; keep URL param for others.
  useEffect(() => {
    if (isScopedCountryAdmin) {
      const ownCountry = String(user?.adminCountryIds?.[0] || '');
      if (ownCountry && countryScope !== ownCountry) setCountryScope(ownCountry);
      return;
    }
    const fromUrl = String(searchParams.get('countryId') || '');
    if (fromUrl !== countryScope) setCountryScope(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isScopedCountryAdmin, user?.adminCountryIds]);

  const selectCountryScope = (value) => {
    setCountryScope(String(value || ''));
    if (value) setSearchParams({ countryId: String(value) }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  const scopeCountryName = useMemo(() => {
    if (!countryScope) return 'Global';
    const found = adminCountries.find((country) => String(country._id) === String(countryScope));
    return found?.name || countryScope;
  }, [adminCountries, countryScope]);

  useEffect(() => {
    const nextDrafts = {};
    currencies.forEach((currency) => {
      nextDrafts[currency.code] = String(currency.exchangeRateToDefault ?? 1);
    });
    setCurrencyRateDrafts(nextDrafts);
  }, [currencies]);

  useEffect(() => {
    const activeCodes = languages
      .filter((item) => item.isActive !== false)
      .map((item) => String(item.code || '').toLowerCase())
      .filter(Boolean);
    if (!activeCodes.length) return;
    const current = String(defaultLanguage || '').toLowerCase();
    if (!activeCodes.includes(current)) {
      setDefaultLanguage(activeCodes[0]);
    }
  }, [languages, defaultLanguage]);

  const saveFee = async (key) => {
    setSavingFeeKey(key);
    try {
      await api.patch(`/admin/settings/${key}`, { value: fees[key] });
      const mappedRuntimeKey = FEE_RUNTIME_KEY_MAP[key] || key;
      const possibleRuntimeKeys = [mappedRuntimeKey, key];
      setRuntimeSettings((prev) =>
        prev.map((entry) =>
          possibleRuntimeKeys.includes(String(entry?.key || ''))
            ? { ...entry, value: fees[key], updatedAt: new Date().toISOString() }
            : entry
        )
      );
      setRuntimeDrafts((prev) => ({
        ...prev,
        ...possibleRuntimeKeys.reduce((acc, runtimeKey) => {
          if (Object.prototype.hasOwnProperty.call(prev, runtimeKey)) {
            acc[runtimeKey] = fees[key];
          }
          return acc;
        }, {})
      }));
      setInitialFees((prev) => ({
        ...prev,
        [key]: fees[key]
      }));
      showToast('Parametre enregistre.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement parametre.', { variant: 'error' });
    } finally {
      setSavingFeeKey('');
    }
  };

  const notificationRuntimeQuickFlags = useMemo(() => {
    const byKey = new Map((runtimeSettings || []).map((item) => [String(item?.key || ''), item]));
    return NOTIFICATION_RUNTIME_FLAGS.map((entry) => ({
      ...entry,
      setting: byKey.get(entry.key) || null
    }));
  }, [runtimeSettings]);
  const networkRuntimeQuickFlags = useMemo(() => {
    const byKey = new Map((runtimeSettings || []).map((item) => [String(item?.key || ''), item]));
    return NETWORK_RUNTIME_QUICK_FLAGS.map((entry) => ({
      ...entry,
      setting: byKey.get(entry.key) || null
    }));
  }, [runtimeSettings]);
  const commerceRuntimeControls = useMemo(() => {
    const byKey = new Map((runtimeSettings || []).map((item) => [String(item?.key || ''), item]));
    return COMMERCE_RUNTIME_CONTROLS.map((entry) => ({
      ...entry,
      setting: byKey.get(entry.key) || null
    }));
  }, [runtimeSettings]);

  // Generic runtime list excludes curated groups and fee-linked keys so each
  // setting is rendered exactly once across the page.
  const otherRuntimeByCategory = useMemo(() => {
    return (runtimeSettings || []).reduce((acc, item) => {
      const key = String(item?.key || '');
      if (CURATED_RUNTIME_KEYS.has(key) || FEE_RELATED_RUNTIME_KEYS.has(key)) return acc;
      const category = String(item?.category || 'general');
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});
  }, [runtimeSettings]);
  const otherRuntimeCount = useMemo(
    () => Object.values(otherRuntimeByCategory).reduce((sum, items) => sum + items.length, 0),
    [otherRuntimeByCategory]
  );
  const filteredOtherRuntimeByCategory = useMemo(() => {
    if (!runtimeSearch.trim()) return otherRuntimeByCategory;
    return Object.entries(otherRuntimeByCategory).reduce((acc, [category, items]) => {
      const filtered = (items || []).filter((item) =>
        matchesQuery(runtimeSearch, item?.key, item?.category, tSetting(item?.key, item?.description || '', 'desc'))
      );
      if (filtered.length) acc[category] = filtered;
      return acc;
    }, {});
  }, [otherRuntimeByCategory, runtimeSearch, tSetting]);
  const filteredOtherRuntimeCount = useMemo(
    () => Object.values(filteredOtherRuntimeByCategory).reduce((sum, items) => sum + items.length, 0),
    [filteredOtherRuntimeByCategory]
  );
  const otherRuntimeOpen = otherRuntimeManuallyOpen || Boolean(runtimeSearch.trim());

  const dirtyFeeKeys = useMemo(
    () =>
      FEE_FIELDS.map((field) => field.key).filter((key) => {
        const current = fees[key];
        const initial = initialFees[key];
        return FEE_FIELDS.find((field) => field.key === key)?.type === 'boolean'
          ? Boolean(current) !== Boolean(initial)
          : Number(current ?? 0) !== Number(initial ?? 0);
      }),
    [fees, initialFees]
  );
  const hasDirtyFees = dirtyFeeKeys.length > 0;

  const languagesSignature = useMemo(
    () => serializeLanguagesConfig(languages, defaultLanguage),
    [languages, defaultLanguage]
  );
  const hasDirtyLanguages = Boolean(
    initialLanguagesSignature && languagesSignature !== initialLanguagesSignature
  );

  // Runtime drafts that differ from their persisted value, compared per valueType.
  const dirtyRuntimeKeys = useMemo(
    () =>
      (runtimeSettings || [])
        .filter((item) => {
          const key = String(item?.key || '');
          if (!key || !Object.prototype.hasOwnProperty.call(runtimeDrafts, key)) return false;
          const draft = runtimeDrafts[key];
          const value = item?.value;
          if (item?.valueType === 'array' || item?.valueType === 'json') {
            const fallback = item?.valueType === 'array' ? [] : {};
            return String(draft ?? '') !== JSON.stringify(value ?? fallback, null, 2);
          }
          if (item?.valueType === 'boolean') {
            return parseBooleanSetting(draft) !== parseBooleanSetting(value);
          }
          if (item?.valueType === 'number') {
            return Number(draft) !== Number(value);
          }
          return String(draft ?? '') !== String(value ?? '');
        })
        .map((item) => String(item?.key || '')),
    [runtimeSettings, runtimeDrafts]
  );

  const saveAllFees = useCallback(async () => {
    if (!dirtyFeeKeys.length) {
      showToast('Aucune modification à enregistrer.', { variant: 'info' });
      return;
    }
    setSavingAllFees(true);
    try {
      for (const key of dirtyFeeKeys) {
        // same endpoint as per-field save, batched for mobile quick action
        await api.patch(`/admin/settings/${key}`, { value: fees[key] });
      }

      const dirtySet = new Set(dirtyFeeKeys);
      const runtimeUpdateMap = dirtyFeeKeys.reduce((acc, feeKey) => {
        const runtimeKey = FEE_RUNTIME_KEY_MAP[feeKey] || feeKey;
        acc[runtimeKey] = fees[feeKey];
        acc[feeKey] = fees[feeKey];
        return acc;
      }, {});

      setRuntimeSettings((prev) =>
        prev.map((entry) =>
          dirtySet.has(String(entry?.key || '')) || Object.prototype.hasOwnProperty.call(runtimeUpdateMap, String(entry?.key || ''))
            ? {
                ...entry,
                value: runtimeUpdateMap[String(entry?.key || '')],
                updatedAt: new Date().toISOString()
              }
            : entry
        )
      );

      setRuntimeDrafts((prev) => {
        const next = { ...prev };
        Object.entries(runtimeUpdateMap).forEach(([runtimeKey, value]) => {
          if (Object.prototype.hasOwnProperty.call(next, runtimeKey)) {
            next[runtimeKey] = value;
          }
        });
        return next;
      });

      setInitialFees((prev) => ({
        ...prev,
        ...dirtyFeeKeys.reduce((acc, key) => {
          acc[key] = fees[key];
          return acc;
        }, {})
      }));

      showToast('Paramètres de frais enregistrés.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement des frais.', {
        variant: 'error'
      });
    } finally {
      setSavingAllFees(false);
    }
  }, [dirtyFeeKeys, fees, showToast]);

  const saveRuntimeSetting = async (setting) => {
    const key = String(setting?.key || '');
    if (!key) return;
    let value = runtimeDrafts[key];
    if (setting?.valueType === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        showToast('Valeur invalide pour ce paramètre numérique.', { variant: 'error' });
        return;
      }
      value = parsed;
    } else if (setting?.valueType === 'boolean') {
      value = Boolean(value);
    } else if (setting?.valueType === 'array' || setting?.valueType === 'json') {
      try {
        const fallbackJson = setting?.valueType === 'array' ? '[]' : '{}';
        const rawJson = String(value ?? fallbackJson);
        value = JSON.parse(rawJson || fallbackJson);
      } catch {
        showToast('JSON invalide pour ce paramètre.', { variant: 'error' });
        return;
      }
    } else {
      value = String(value ?? '');
    }

    setRuntimeSavingKey(key);
    try {
      const payload = { value };
      if (runtimeEnvironment) payload.environment = runtimeEnvironment;
      if (countryScope) payload.countryId = countryScope;
      const { data } = await api.patch(`/admin/config/runtime/${encodeURIComponent(key)}`, payload);
      const updatedValue = data?.item?.value ?? value;
      setRuntimeSettings((prev) =>
        prev.map((entry) =>
          String(entry?.key) === key
            ? {
                ...entry,
                value: updatedValue,
                countryOverride: true,
                updatedAt: new Date().toISOString()
              }
            : entry
        )
      );
      setRuntimeDrafts((prev) => ({
        ...prev,
        [key]:
          setting?.valueType === 'array' || setting?.valueType === 'json'
            ? JSON.stringify(updatedValue, null, 2)
            : updatedValue
      }));
      const linkedFeeKey = RUNTIME_FEE_KEY_MAP[key] || (FEE_RUNTIME_KEY_MAP[key] ? key : '');
      if (linkedFeeKey && FEE_FIELDS.some((field) => field.key === linkedFeeKey)) {
        const feeField = FEE_FIELDS.find((field) => field.key === linkedFeeKey);
        const normalizedFeeValue =
          feeField?.type === 'boolean'
            ? parseBooleanSetting(updatedValue)
            : parseNumberSetting(updatedValue);
        setFees((prev) => ({
          ...prev,
          [linkedFeeKey]: normalizedFeeValue
        }));
        setInitialFees((prev) => ({
          ...prev,
          [linkedFeeKey]: normalizedFeeValue
        }));
      }
      showToast('Configuration enregistrée.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur mise à jour configuration.', {
        variant: 'error'
      });
    } finally {
      setRuntimeSavingKey('');
    }
  };

  const resetRuntimeOverride = async (setting) => {
    const key = String(setting?.key || '');
    if (!key || !countryScope) return;
    setRuntimeSavingKey(key);
    try {
      await api.delete(`/admin/config/runtime/${encodeURIComponent(key)}`, {
        params: { countryId: countryScope }
      });
      const { data } = await api.get('/admin/config/runtime', {
        params: {
          includeHidden: isFounder ? 'true' : 'false',
          countryId: countryScope
        }
      });
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setRuntimeSettings(nextItems);
      setRuntimeDrafts(
        nextItems.reduce((acc, item) => {
          if (item?.valueType === 'array' || item?.valueType === 'json') {
            acc[item.key] = JSON.stringify(item.value ?? (item.valueType === 'array' ? [] : {}), null, 2);
          } else {
            acc[item.key] = item.value;
          }
          return acc;
        }, {})
      );
      showToast('Valeur réinitialisée sur la valeur globale.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Réinitialisation impossible.', { variant: 'error' });
    } finally {
      setRuntimeSavingKey('');
    }
  };

  const patchFeatureFlag = async (featureName, patch) => {
    const name = String(featureName || '');
    if (!name) return;
    const previous = featureFlags;
    setFeatureFlags((prev) =>
      prev.map((entry) => (String(entry?.featureName) === name ? { ...entry, ...patch } : entry))
    );
    setFeatureSavingName(name);
    try {
      const payload = { ...patch };
      if (runtimeEnvironment) payload.environment = runtimeEnvironment;
      const { data } = await api.patch(`/admin/config/feature-flags/${encodeURIComponent(name)}`, payload);
      const updated = data?.item || {};
      setFeatureFlags((prev) =>
        prev.map((entry) => (String(entry?.featureName) === name ? { ...entry, ...updated } : entry))
      );
      showToast('Feature flag mise à jour.', { variant: 'success' });
      emitSettingsRefresh();
    } catch (error) {
      setFeatureFlags(previous);
      showToast(error.response?.data?.message || 'Erreur mise à jour feature flag.', {
        variant: 'error'
      });
    } finally {
      setFeatureSavingName('');
    }
  };

  const createCurrency = async (e) => {
    e.preventDefault();
    setCreatingCurrency(true);
    try {
      await api.post('/admin/currencies', currencyForm);
      showToast('Devise creee.', { variant: 'success' });
      setCurrencyForm(emptyCurrencyForm);
      await loadSettings();
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur creation devise.', { variant: 'error' });
    } finally {
      setCreatingCurrency(false);
    }
  };

  const patchCurrency = async (code, patch) => {
    try {
      await api.patch(`/admin/currencies/${code}`, patch);
      await loadSettings();
      emitSettingsRefresh();
      return true;
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur mise a jour devise.', { variant: 'error' });
      return false;
    }
  };

  const updateCurrencyRateDraft = (code, value) => {
    setCurrencyRateDrafts((prev) => ({
      ...prev,
      [code]: value
    }));
  };

  const saveCurrencyRate = async (code) => {
    const parsedRate = Number(currencyRateDrafts[code]);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      showToast('Le taux doit etre un nombre positif.', { variant: 'error' });
      return;
    }
    setSavingCurrencyCode(code);
    const ok = await patchCurrency(code, { exchangeRateToDefault: parsedRate });
    if (ok) {
      showToast('Taux de change mis a jour.', { variant: 'success' });
    }
    setSavingCurrencyCode('');
  };

  const saveLanguages = async () => {
    const normalized = languages.map((item) => ({
      code: String(item.code || '').trim().toLowerCase(),
      name: String(item.name || '').trim(),
      isActive: item.isActive !== false
    }));

    const emptyCode = normalized.find((item) => !item.code);
    if (emptyCode) {
      showToast('Chaque langue doit avoir un code.', { variant: 'error' });
      return;
    }

    const emptyName = normalized.find((item) => !item.name);
    if (emptyName) {
      showToast('Chaque langue doit avoir un nom.', { variant: 'error' });
      return;
    }

    const codeSet = new Set();
    for (const lang of normalized) {
      if (codeSet.has(lang.code)) {
        showToast(`Code duplique: ${lang.code}`, { variant: 'error' });
        return;
      }
      codeSet.add(lang.code);
    }

    const activeCodes = normalized.filter((item) => item.isActive).map((item) => item.code);
    if (!activeCodes.length) {
      showToast('Au moins une langue doit rester active.', { variant: 'error' });
      return;
    }

    const safeDefault = activeCodes.includes(defaultLanguage) ? defaultLanguage : activeCodes[0];

    setSavingLanguages(true);
    try {
      await api.patch('/admin/languages', {
        languages: normalized,
        defaultLanguage: safeDefault
      });
      showToast('Langues enregistrees.', { variant: 'success' });
      await loadSettings();
      emitSettingsRefresh();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur enregistrement langues.', { variant: 'error' });
    } finally {
      setSavingLanguages(false);
    }
  };

  const isQuickSaveBusy = savingAllFees || savingLanguages || Boolean(runtimeSavingKey);
  const canQuickSave = hasDirtyFees || hasDirtyLanguages || dirtyRuntimeKeys.length > 0;
  const sectionDirtyCounts = {
    fees: dirtyFeeKeys.length,
    runtime: dirtyRuntimeKeys.length,
    languages: hasDirtyLanguages ? 1 : 0
  };

  const handleQuickSave = async () => {
    if (isQuickSaveBusy) return;
    if (!canQuickSave) {
      showToast('Aucune modification à enregistrer.', { variant: 'info' });
      return;
    }
    if (hasDirtyFees) {
      await saveAllFees();
    }
    if (hasDirtyLanguages) {
      await saveLanguages();
    }
    // Flush dirty runtime drafts so the quick-save count is honest
    for (const key of dirtyRuntimeKeys) {
      const setting = (runtimeSettings || []).find((item) => String(item?.key || '') === key);
      if (!setting) continue;
      // sequential save, same endpoint as the per-row button
      await saveRuntimeSetting(setting);
    }
  };
  const quickSaveCount = dirtyFeeKeys.length + (hasDirtyLanguages ? 1 : 0) + dirtyRuntimeKeys.length;
  const quickSaveParts = [];
  if (hasDirtyFees) quickSaveParts.push('frais');
  if (hasDirtyLanguages) quickSaveParts.push('langues');
  if (dirtyRuntimeKeys.length) quickSaveParts.push('config');
  const quickSaveLabel = quickSaveParts.length
    ? `Enregistrer ${quickSaveParts.join(' + ')}`
    : 'Enregistrer';

  const addLanguage = () => {
    setLanguages((prev) => [...prev, buildEmptyLanguage()]);
  };

  const updateLanguage = (index, patch) => {
    setLanguages((prev) =>
      prev.map((lang, langIndex) => {
        if (langIndex !== index) return lang;
        const next = { ...lang, ...patch };
        if (typeof next.code === 'string') {
          next.code = next.code.toLowerCase().replace(/\s+/g, '');
        }
        return next;
      })
    );
  };

  const removeLanguage = (index) => {
    setLanguages((prev) => {
      if (prev.length <= 1) {
        showToast('Vous devez garder au moins une langue.', { variant: 'error' });
        return prev;
      }
      const removed = prev[index];
      const next = prev.filter((_, langIndex) => langIndex !== index);
      const nextActiveCodes = next
        .filter((item) => item.isActive !== false)
        .map((item) => String(item.code || '').toLowerCase());
      if (!nextActiveCodes.length) {
        showToast('Vous devez garder au moins une langue active.', { variant: 'error' });
        return prev;
      }
      if (String(removed?.code || '').toLowerCase() === String(defaultLanguage || '').toLowerCase()) {
        setDefaultLanguage(nextActiveCodes[0]);
      }
      return next;
    });
  };

  const publicRuntimeCount = useMemo(
    () => (runtimeSettings || []).filter((item) => item?.isPublic).length,
    [runtimeSettings]
  );
  const enabledFeatureCount = useMemo(
    () => (featureFlags || []).filter((item) => item?.enabled).length,
    [featureFlags]
  );
  const systemMetrics = [
    { label: 'Runtime', value: loading ? '…' : runtimeSettings.length, help: `${publicRuntimeCount} publics`, icon: AdjustmentsHorizontalIcon },
    { label: 'Flags', value: loading ? '…' : enabledFeatureCount, help: `${featureFlags.length} configurés`, icon: Bars2Icon },
    { label: 'Villes', value: loading ? '…' : cities.length, help: `${communes.length} communes`, icon: MapPinIcon },
    { label: 'Modifs', value: quickSaveCount, help: 'Non enregistrées', icon: CheckIcon }
  ];

  const runtimeKeyLabel = t('admin.keyLabel', 'clé');
  const handleRuntimeDraftChange = useCallback((key, value) => {
    setRuntimeDrafts((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  return (
    <div className={`min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 ${isMobile ? 'pb-24' : ''}`}>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f0d9c6] bg-[#fffaf5] px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#e85d00] ring-1 ring-[#f0d9c6]"><GlobeAltIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-[#8a7263]">Portée des paramètres runtime</p>
            <p className="text-sm font-bold text-[#211b16]">
              {countryScope ? `Vous modifiez les paramètres de ${scopeCountryName}` : 'Vous modifiez les paramètres globaux (tous les pays)'}
            </p>
          </div>
          <select
            value={countryScope}
            onChange={(event) => selectCountryScope(event.target.value)}
            disabled={isScopedCountryAdmin}
            className="min-h-11 rounded-xl border border-[#e2d8cd] bg-white px-3 font-bold text-[#211b16] outline-none focus:border-[#e85d00] disabled:opacity-60"
          >
            {!isScopedCountryAdmin ? <option value="">🌍 Global — tous les pays</option> : null}
            {adminCountries.map((country) => (
              <option key={String(country._id)} value={String(country._id)}>{country.flagEmoji} {country.name}</option>
            ))}
          </select>
        </div>

        <AdminCommandHero
          eyebrow={isFounder ? 'Founder system control' : 'Admin system control'}
          title="Paramètres système"
          subtitle="Les options activées ici sont diffusées au front via les paramètres publics, puis appliquées au centre de commande, à la navigation admin et aux parcours utilisateurs."
          meta={`Environnement: ${runtimeEnvironment || 'auto'} · propagation live via settings refresh`}
          metrics={systemMetrics}
          actions={[
            {
              label: 'Retour admin',
              description: 'Revenir au panneau principal',
              to: '/admin',
              icon: ArrowLeftIcon,
              tone: 'neutral'
            },
            {
              label: 'Actualiser',
              description: 'Recharger paramètres et flags',
              onClick: loadSettings,
              icon: ArrowPathIcon,
              tone: 'dark',
              loading
            },
            {
              label: quickSaveLabel,
              description: quickSaveCount ? `${quickSaveCount} modification${quickSaveCount > 1 ? 's' : ''}` : 'Aucune modification locale',
              onClick: handleQuickSave,
              icon: CheckIcon,
              tone: quickSaveCount ? 'emerald' : 'neutral',
              disabled: !quickSaveCount || isQuickSaveBusy,
              loading: isQuickSaveBusy
            }
          ]}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:hidden">
            {SYSTEM_SECTIONS.map((section) => (
              <SectionNavButton
                key={section.value}
                section={section}
                variant="chip"
                active={activeSystemSection === section.value}
                onSelect={setActiveSystemSection}
                dirtyCount={sectionDirtyCounts[section.value] || 0}
              />
            ))}
          </div>

          <nav className="hidden lg:block lg:w-60 lg:shrink-0" aria-label="Sections des paramètres">
            <div className="sticky top-4 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              {SYSTEM_SECTIONS.map((section) => (
                <SectionNavButton
                  key={section.value}
                  section={section}
                  active={activeSystemSection === section.value}
                  onSelect={setActiveSystemSection}
                  dirtyCount={sectionDirtyCounts[section.value] || 0}
                />
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
            {activeSystemSection === 'fees' ? (
              <SectionShell
                icon={BuildingLibraryIcon}
                title="Frais & règles"
                description="Commissions, boosts, paiement par tranches, scores et litiges."
              >
                {loading ? (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Chargement…</p>
                ) : (
                  <>
                    <SectionSearchInput
                      value={feeSearch}
                      onChange={setFeeSearch}
                      placeholder="Rechercher un réglage (nom ou clé)…"
                    />
                    {(() => {
                      const visibleGroups = FEE_GROUPS.map((group) => ({
                        ...group,
                        fields: group.keys
                          .map((feeKey) => FEE_FIELDS.find((entry) => entry.key === feeKey))
                          .filter(Boolean)
                          .filter((field) =>
                            matchesQuery(feeSearch, field.label, field.key, FEE_RUNTIME_KEY_MAP[field.key])
                          )
                      })).filter((group) => group.fields.length > 0);

                      if (!visibleGroups.length) {
                        return (
                          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-neutral-700 dark:text-neutral-400">
                            Aucun réglage ne correspond à « {feeSearch} ».
                          </p>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {visibleGroups.map((group) => (
                            <div
                              key={group.title}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-950/40"
                            >
                              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                                {group.title}
                              </p>
                              <div className="space-y-2">
                                {group.fields.map((field) => {
                                  const isDirty = dirtyFeeKeys.includes(field.key);
                                  const isSaving = savingFeeKey === field.key;
                                  const sourceKey = FEE_RUNTIME_KEY_MAP[field.key] || field.key;
                                  const tooltip = [field.help, `clé: ${sourceKey}`].filter(Boolean).join(' — ');
                                  return (
                                    <div
                                      key={field.key}
                                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-2.5 transition-colors ${
                                        isDirty
                                          ? 'border-[#e85d00]/40 bg-[#FFF7F0] dark:border-[#e85d00]/40 dark:bg-[#e85d00]/10'
                                          : 'border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/60'
                                      }`}
                                    >
                                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                        {isDirty ? (
                                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#e85d00]" aria-hidden="true" />
                                        ) : null}
                                        <span className="truncate text-xs font-semibold text-slate-700 dark:text-neutral-200">
                                          {field.label}
                                        </span>
                                        <span
                                          title={tooltip}
                                          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                                          aria-label={tooltip}
                                        >
                                          <QuestionMarkCircleIcon className="h-3 w-3" />
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2">
                                        {field.type === 'boolean' ? (
                                          <div className="flex min-h-9 items-center gap-2">
                                            <Switch
                                              checked={Boolean(fees[field.key])}
                                              onChange={(next) =>
                                                setFees((prev) => ({ ...prev, [field.key]: next }))
                                              }
                                              ariaLabel={field.label}
                                            />
                                            <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                                              {fees[field.key] ? 'Oui' : 'Non'}
                                            </span>
                                          </div>
                                        ) : (
                                          <input
                                            type="number"
                                            step={field.step || 1}
                                            value={fees[field.key] ?? 0}
                                            onChange={(e) =>
                                              setFees((prev) => ({
                                                ...prev,
                                                [field.key]: Number(e.target.value || 0)
                                              }))
                                            }
                                            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                          />
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => saveFee(field.key)}
                                          disabled={!isDirty || isSaving}
                                          aria-label={`Enregistrer ${field.label}`}
                                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                                            isDirty
                                              ? 'border-[#e85d00] bg-[#e85d00] text-white hover:bg-[#d45400]'
                                              : 'border-slate-200 bg-slate-50 text-slate-300 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-600'
                                          } disabled:cursor-not-allowed`}
                                        >
                                          {isSaving ? <ArrowPathIcon className="animate-spin h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </SectionShell>
            ) : null}

            {activeSystemSection === 'runtime' ? (
              <SectionShell
                icon={AdjustmentsHorizontalIcon}
                title="Configuration"
                description={countryScope ? `Interrupteurs runtime du pays ${scopeCountryName}. Les valeurs non modifiées ici utilisent la valeur globale.` : 'Interrupteurs runtime diffusés à toute la plateforme.'}
                badge={(
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                    Environnement: {runtimeEnvironment || 'auto'} · Portée: {scopeCountryName}
                  </span>
                )}
              >
                {!runtimeSettings.length ? (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Aucun paramètre runtime trouvé.</p>
                ) : (
                  <div className="space-y-4">
                    <RuntimeFlagGroup
                      title="Commerce & limites vendeurs"
                      description="Contrôlez la fonction Vendre, Devenir Boutique et les quotas de publication."
                      accent="emerald"
                      items={commerceRuntimeControls}
                      grid
                      runtimeDrafts={runtimeDrafts}
                      runtimeSavingKey={runtimeSavingKey}
                      onDraftChange={handleRuntimeDraftChange}
                      onSave={saveRuntimeSetting}
                      onResetOverride={resetRuntimeOverride}
                      tSetting={tSetting}
                      keyLabel={runtimeKeyLabel}
                    />
                    <RuntimeFlagGroup
                      title="Notifications Push"
                      description="Activation rapide des flags runtime pour l’orchestration socket/push."
                      accent="indigo"
                      items={notificationRuntimeQuickFlags}
                      runtimeDrafts={runtimeDrafts}
                      runtimeSavingKey={runtimeSavingKey}
                      onDraftChange={handleRuntimeDraftChange}
                      onSave={saveRuntimeSetting}
                      onResetOverride={resetRuntimeOverride}
                      tSetting={tSetting}
                      keyLabel={runtimeKeyLabel}
                    />
                    <RuntimeFlagGroup
                      title="Apparence, réseau & hors ligne"
                      description="Contrôlez le thème sombre, le mode Rapide 3G et la navigation hors ligne."
                      accent="sky"
                      items={networkRuntimeQuickFlags}
                      runtimeDrafts={runtimeDrafts}
                      runtimeSavingKey={runtimeSavingKey}
                      onDraftChange={handleRuntimeDraftChange}
                      onSave={saveRuntimeSetting}
                      onResetOverride={resetRuntimeOverride}
                      tSetting={tSetting}
                      keyLabel={runtimeKeyLabel}
                    />
                    {otherRuntimeCount ? (
                      <div className="rounded-xl border border-slate-200 dark:border-neutral-700">
                        <button
                          type="button"
                          onClick={() => setOtherRuntimeManuallyOpen((prev) => !prev)}
                          aria-expanded={otherRuntimeOpen}
                          className="flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400"
                        >
                          <span>
                            Autres paramètres ({runtimeSearch.trim() ? `${filteredOtherRuntimeCount}/${otherRuntimeCount}` : otherRuntimeCount})
                          </span>
                          <ChevronDownIcon
className={`h-4 w-4 transition-transform duration-300 ${otherRuntimeOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {otherRuntimeOpen ? (
                        <div className="space-y-4 border-t border-slate-200 p-3 dark:border-neutral-700">
                          <SectionSearchInput
                            value={runtimeSearch}
                            onChange={setRuntimeSearch}
                            placeholder="Rechercher une clé ou une description…"
                          />
                          {!filteredOtherRuntimeCount ? (
                            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-neutral-700 dark:text-neutral-400">
                              Aucun réglage ne correspond à « {runtimeSearch} ».
                            </p>
                          ) : null}
                          {Object.entries(filteredOtherRuntimeByCategory).map(([category, items]) => (
                            <div key={category} className="rounded-xl border border-slate-200 p-3 dark:border-neutral-700">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                                {category.replace(/_/g, ' ')}
                              </p>
                              <div className="space-y-3">
                                {(items || []).map((item) => {
                                  const key = String(item?.key || '');
                                  const draftValue = runtimeDrafts[key];
                                  const isSaving = runtimeSavingKey === key;

                                  return (
                                    <div
                                      key={key}
                                      className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-950/40"
                                    >
                                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-xs font-semibold text-slate-900 dark:text-neutral-100">{key}</p>
                                          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                                            {tSetting(key, item?.description || '', 'desc') || t('admin.noDescription', 'Sans description')}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {item?.isPublic ? (
                                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                                              public
                                            </span>
                                          ) : null}
                                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                                            {item?.valueType || typeof item?.value}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        {item?.valueType === 'boolean' ? (
                                          <div className="flex min-h-9 w-full items-center gap-2">
                                            <Switch
                                              checked={parseBooleanSetting(draftValue)}
                                              onChange={(next) => handleRuntimeDraftChange(key, next)}
                                              disabled={isSaving}
                                              ariaLabel={key}
                                            />
                                            <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                                              {parseBooleanSetting(draftValue) ? 'Activé' : 'Désactivé'}
                                            </span>
                                          </div>
                                        ) : Array.isArray(item?.allowedValues) && item.allowedValues.length > 0 ? (
                                          <select
                                            value={String(draftValue ?? '')}
                                            onChange={(event) => handleRuntimeDraftChange(key, event.target.value)}
                                            className={INPUT_COMPACT_CLASS}
                                          >
                                            {item.allowedValues.map((allowedValue) => (
                                              <option key={String(allowedValue)} value={String(allowedValue)}>
                                                {String(allowedValue)}
                                              </option>
                                            ))}
                                          </select>
                                        ) : item?.valueType === 'number' ? (
                                          <input
                                            type="number"
                                            min={Number.isFinite(Number(item?.min)) ? Number(item.min) : undefined}
                                            max={Number.isFinite(Number(item?.max)) ? Number(item.max) : undefined}
                                            value={draftValue ?? 0}
                                            onChange={(event) => handleRuntimeDraftChange(key, event.target.value)}
                                            className={INPUT_COMPACT_CLASS}
                                          />
                                        ) : item?.valueType === 'array' || item?.valueType === 'json' ? (
                                          <textarea
                                            value={String(draftValue || '')}
                                            onChange={(event) => handleRuntimeDraftChange(key, event.target.value)}
                                            rows={3}
                                            className={TEXTAREA_CLASS}
                                          />
                                        ) : (
                                          <input
                                            type="text"
                                            value={String(draftValue ?? '')}
                                            onChange={(event) => handleRuntimeDraftChange(key, event.target.value)}
                                            className={INPUT_COMPACT_CLASS}
                                          />
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => saveRuntimeSetting(item)}
                                          disabled={isSaving}
                                          className={SAVE_BUTTON_CLASS}
                                        >
                                          <CheckIcon className="h-3 w-3" />
                                          {isSaving ? '…' : 'Enregistrer'}
                                        </button>
                                      </div>
                                      {(Array.isArray(item?.allowedValues) && item.allowedValues.length > 0) ||
                                      Number.isFinite(Number(item?.min)) ||
                                      Number.isFinite(Number(item?.max)) ? (
                                        <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
                                          {Array.isArray(item?.allowedValues) && item.allowedValues.length > 0
                                            ? `Valeurs autorisées: ${item.allowedValues.join(', ')}`
                                            : `Bornes: ${
                                                Number.isFinite(Number(item?.min)) ? `min ${Number(item.min)}` : ''
                                              }${
                                                Number.isFinite(Number(item?.min)) && Number.isFinite(Number(item?.max))
                                                  ? ' · '
                                                  : ''
                                              }${
                                                Number.isFinite(Number(item?.max)) ? `max ${Number(item.max)}` : ''
                                              }`}
                                        </p>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </SectionShell>
            ) : null}

            {activeSystemSection === 'flags' ? (
              <SectionShell
                icon={Bars2Icon}
                title="Fonctionnalités"
                description="Activation des feature flags par environnement."
              >
                {!featureFlags.length ? (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Aucune feature flag configurée.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {featureFlags.map((flag) => {
                      const featureName = String(flag?.featureName || '');
                      const saving = featureSavingName === featureName;
                      const rolesAllowed = Array.isArray(flag?.rolesAllowed) ? flag.rolesAllowed : [];
                      return (
                        <div
                          key={featureName}
                          className="rounded-xl border border-slate-200 p-3 text-sm dark:border-neutral-700"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="font-semibold">{featureName}</p>
                            <span className="text-xs text-slate-500 dark:text-neutral-400">{flag?.environment || 'all'}</span>
                          </div>
                          <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">
                            {tSetting(featureName, flag?.description || '', 'desc') || t('admin.noDescription', 'Sans description')}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex min-h-9 items-center gap-2">
                              <Switch
                                checked={Boolean(flag?.enabled)}
                                onChange={(next) =>
                                  patchFeatureFlag(featureName, {
                                    enabled: next,
                                    rolloutPercentage: Number(flag?.rolloutPercentage ?? 100),
                                    rolesAllowed
                                  })
                                }
                                disabled={saving}
                                ariaLabel={featureName}
                              />
                              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                                {flag?.enabled ? 'Activé' : 'Désactivé'}
                              </span>
                            </div>
                            <label className="text-xs text-slate-600 dark:text-neutral-300">
                              Rollout %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Number(flag?.rolloutPercentage ?? 100)}
                              onChange={(event) =>
                                setFeatureFlags((prev) =>
                                  prev.map((entry) =>
                                    String(entry?.featureName) === featureName
                                      ? {
                                          ...entry,
                                          rolloutPercentage: Math.max(
                                            0,
                                            Math.min(100, Number(event.target.value || 0))
                                          )
                                        }
                                      : entry
                                  )
                                )
                              }
                              className="w-full min-w-[96px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs sm:w-20 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                patchFeatureFlag(featureName, {
                                  enabled: Boolean(flag?.enabled),
                                  rolloutPercentage: Number(flag?.rolloutPercentage ?? 100),
                                  rolesAllowed
                                })
                              }
                              disabled={saving}
                              className="rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                            >
                              {saving ? '…' : 'Sauver'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionShell>
            ) : null}

            {activeSystemSection === 'languages' ? (
              <SectionShell
                icon={LanguageIcon}
                title="Langues"
                description="Langues disponibles dans l’application et langue par défaut."
              >
                <div className="mb-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={addLanguage}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Ajouter langue
                  </button>
                </div>
                <div className="space-y-2">
                  {languages.map((item, index) => (
                    <div
                      key={`${item.code || 'new'}-${index}`}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-[80px_minmax(0,1fr)_auto_auto] sm:items-center dark:border-neutral-800"
                    >
                      <input
                        value={item.code}
                        onChange={(e) => updateLanguage(index, { code: e.target.value })}
                        placeholder="fr"
                        className={`${INPUT_CLASS} uppercase`}
                      />
                      <input
                        value={item.name}
                        onChange={(e) => updateLanguage(index, { name: e.target.value })}
                        placeholder="Français"
                        className={INPUT_CLASS}
                      />
                      <div className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-300">
                        <Switch
                          checked={item.isActive !== false}
                          onChange={(next) => updateLanguage(index, { isActive: next })}
                          ariaLabel="Langue active"
                        />
                        Actif
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLanguage(index)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                        aria-label="Supprimer langue"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
                    <select
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {languages
                        .filter((item) => item.isActive !== false)
                        .map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={savingLanguages}
                      onClick={saveLanguages}
                      className={SAVE_BUTTON_CLASS}
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </SectionShell>
            ) : null}

            {activeSystemSection === 'currencies' ? (
              <SectionShell
                icon={CurrencyDollarIcon}
                title="Devises"
                description="Devises, taux de conversion et devise par défaut."
              >
                <form onSubmit={createCurrency} className="mb-4 grid gap-2 sm:grid-cols-2">
                  <input
                    value={currencyForm.code}
                    onChange={(e) => setCurrencyForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="Code"
                    className={INPUT_CLASS}
                    required
                  />
                  <input
                    value={currencyForm.symbol}
                    onChange={(e) => setCurrencyForm((prev) => ({ ...prev, symbol: e.target.value }))}
                    placeholder="Symbole"
                    className={INPUT_CLASS}
                    required
                  />
                  <input
                    value={currencyForm.name}
                    onChange={(e) => setCurrencyForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nom"
                    className={INPUT_CLASS}
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={currencyForm.decimals}
                    onChange={(e) =>
                      setCurrencyForm((prev) => ({
                        ...prev,
                        decimals: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0
                      }))
                    }
                    placeholder="Décimales"
                    className={INPUT_CLASS}
                  />
                  <input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    value={currencyForm.exchangeRateToDefault}
                    onChange={(e) =>
                      setCurrencyForm((prev) => ({
                        ...prev,
                        exchangeRateToDefault: Number.isFinite(Number(e.target.value))
                          ? Number(e.target.value)
                          : 1
                      }))
                    }
                    placeholder="Facteur conversion (montant de base x taux)"
                    className={INPUT_CLASS}
                  />
                  <button
                    type="submit"
                    disabled={creatingCurrency}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                  >
                    Ajouter
                  </button>
                </form>
                <div className="space-y-2">
                  {currencies.map((currency) => (
                    <div
                      key={currency.code}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm dark:border-neutral-700"
                    >
                      <div>
                        <p className="font-medium">
                          {currency.code} - {currency.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-neutral-400">
                          {currency.symbol} | facteur base → {currency.code}: {currency.exchangeRateToDefault || 1}
                        </p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <label className="text-xs text-slate-600 dark:text-neutral-300">
                            Facteur conversion:
                          </label>
                          <input
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            value={currencyRateDrafts[currency.code] ?? String(currency.exchangeRateToDefault || 1)}
                            onChange={(e) => updateCurrencyRateDraft(currency.code, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs sm:w-36 dark:border-neutral-700 dark:bg-neutral-950"
                          />
                          <button
                            type="button"
                            onClick={() => saveCurrencyRate(currency.code)}
                            disabled={savingCurrencyCode === currency.code}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200"
                          >
                            {savingCurrencyCode === currency.code ? 'Enregistrement…' : 'Enregistrer conversion'}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(currency.isDefault)}
                            onChange={(next) => {
                              if (next) patchCurrency(currency.code, { isDefault: true });
                            }}
                            disabled={Boolean(currency.isDefault)}
                            ariaLabel="Devise par défaut"
                          />
                          <span className="text-xs font-medium text-slate-600 dark:text-neutral-300">Défaut</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(currency.isActive)}
                            onChange={(next) => patchCurrency(currency.code, { isActive: next })}
                            ariaLabel="Devise active"
                          />
                          <span className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                            {currency.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionShell>
            ) : null}

            {(activeSystemSection === 'cities' || activeSystemSection === 'communes') ? (
              <SectionShell
                icon={MapPinIcon}
                title="Villes & communes"
                description="La gestion des villes et communes se fait dans Pays et marchés."
              >
                <p className="text-sm leading-6 text-slate-600 dark:text-neutral-300">
                  Les villes et communes d’un pays se créent et se gèrent uniquement depuis{' '}
                  <strong>Administration → Pays et marchés → onglet Localisations</strong>.
                </p>
                <Link
                  to="/admin/countries"
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#e85d00] px-4 text-sm font-bold text-white"
                >
                  Ouvrir Pays et marchés
                </Link>
              </SectionShell>
            ) : null}
          </div>
        </div>
      </div>
      {isMobile ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">
                Actions rapides
              </p>
              <p className="truncate text-xs text-slate-600 dark:text-neutral-300">
                {canQuickSave
                  ? `${quickSaveCount} modification(s) en attente`
                  : 'Aucune modification en attente'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleQuickSave}
              disabled={!canQuickSave || isQuickSaveBusy}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-semibold transition ${
                !canQuickSave || isQuickSaveBusy
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-neutral-800 dark:text-neutral-500'
                  : 'bg-neutral-900 text-white hover:bg-black'
              }`}
            >
              {isQuickSaveBusy ? 'Enregistrement…' : quickSaveLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
