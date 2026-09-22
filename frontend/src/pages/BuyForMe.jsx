import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowPathIcon, BuildingStorefrontIcon, CubeIcon, CurrencyDollarIcon, MapPinIcon, MinusIcon, PhotoIcon, PlusIcon, ReceiptPercentIcon, ShoppingBagIcon, TruckIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import PawaPayButton from '../components/PawaPayButton';
import { useCountry } from '../context/CountryContext';
import { shoppingDraftFrom } from '../utils/shoppingDraft';
import AddressHistoryChips from '../components/AddressHistoryChips';
import { readAddressHistory, saveAddressToHistory } from '../utils/addressHistory';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import { normalizeFileUrl } from '../utils/deliveryUi';

const STORE_TYPES = [
  ['SUPERMARKET', 'Supermarché'],
  ['PHARMACY', 'Pharmacie'],
  ['RESTAURANT', 'Restaurant'],
  ['HARDWARE', 'Quincaillerie'],
  ['ELECTRONICS', 'Électronique'],
  ['CLOTHING', 'Vêtements'],
  ['LOCAL_MARKET', 'Marché local'],
  ['OTHER', 'Autre']
];

const emptyLocation = () => ({ cityId: '', communeId: '', address: '', contactName: '', contactPhone: '' });
const emptyItem = () => ({
  clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  quantity: '1',
  estimatedUnitPrice: '',
  note: '',
  imageUrl: '',
  imagePreview: '',
  imageUploading: false,
  imageError: ''
});

const getItemEstimatedTotal = (item = {}) => {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.estimatedUnitPrice);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) return 0;
  return Math.round(quantity * unitPrice);
};

const buildLocationPayload = (value, cities, communes) => ({
  ...value,
  cityName: cities.find((city) => String(city._id) === String(value.cityId))?.name || '',
  communeName: communes.find((commune) => String(commune._id) === String(value.communeId))?.name || ''
});

function LocationCard({ title, subtitle, value, onChange, onAutofill, cities, communes, optional = false, addressHistory = [], onPickHistory }) {
  const localCommunes = useMemo(
    () => communes.filter((commune) => String(commune?.cityId?._id || commune?.cityId || '') === String(value.cityId || '')),
    [communes, value.cityId]
  );
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFEDE3] text-[#FF5000]"><MapPinIcon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-black text-gray-900">{title}</h2>
              {optional ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500">Facultatif</span> : null}
            </div>
            <p className="text-[11px] font-medium text-gray-500">{subtitle}</p>
          </div>
        </div>
        {onAutofill ? (
          <button type="button" onClick={onAutofill} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#FF5000]">
            <UserIcon className="h-3 w-3" />
            Mes infos
          </button>
        ) : null}
      </div>
      {onPickHistory && addressHistory.length > 0 ? (
        <div className="mb-3">
          <AddressHistoryChips items={addressHistory} cities={cities} communes={communes} onPick={onPickHistory} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <select aria-label={`${title} : ville`} value={value.cityId} onChange={(event) => onChange({ ...value, cityId: event.target.value, communeId: '' })} className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000]">
          <option value="">Ville</option>
          {cities.map((city) => <option key={city._id} value={city._id}>{city.name}</option>)}
        </select>
        <select aria-label={`${title} : commune`} value={value.communeId} onChange={(event) => onChange({ ...value, communeId: event.target.value })} disabled={!value.cityId} className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000] disabled:opacity-50">
          <option value="">Commune</option>
          {localCommunes.map((commune) => <option key={commune._id} value={commune._id}>{commune.name}</option>)}
        </select>
      </div>
      <input aria-label={`${title} : adresse`} value={value.address} onChange={(event) => onChange({ ...value, address: event.target.value })} placeholder="Adresse précise, quartier, repère…" className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input aria-label={`${title} : contact`} value={value.contactName} onChange={(event) => onChange({ ...value, contactName: event.target.value })} placeholder="Nom du contact" className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
        <input aria-label={`${title} : téléphone`} value={value.contactPhone} onChange={(event) => onChange({ ...value, contactPhone: event.target.value })} placeholder="Téléphone" type="tel" className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
      </div>
    </section>
  );
}

export default function BuyForMe() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const { cities = [], communes = [] } = useAppSettings();
  const { country } = useCountry();
  const [step, setStep] = useState(0);
  const [listName, setListName] = useState('');
  const [listSaving, setListSaving] = useState(false);
  const [listSaved, setListSaved] = useState(false);
  const [listError, setListError] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [sourceNotice, setSourceNotice] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const titleRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [supportedStoreTypes, setSupportedStoreTypes] = useState(STORE_TYPES.map(([key]) => key));
  const [storeType, setStoreType] = useState(() => {
    const requested = new URLSearchParams(location.search).get('store');
    return STORE_TYPES.some(([key]) => key === requested) ? requested : 'SUPERMARKET';
  });
  const [preferredStore, setPreferredStore] = useState('');
  const [pickup, setPickup] = useState(emptyLocation);
  const [dropoff, setDropoff] = useState(emptyLocation);
  const [items, setItems] = useState([emptyItem()]);
  const [authorizationMode, setAuthorizationMode] = useState('SHOPPING_BUDGET');
  const [shoppingBudget, setShoppingBudget] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [balancePreference, setBalancePreference] = useState('ORIGINAL_PAYMENT');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [addressHistory, setAddressHistory] = useState(readAddressHistory);
  const previewUrlsRef = useRef(new Set());

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => { titleRef.current?.focus(); }, [step]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    const listId = params.get('list'), orderId = params.get('reorder');
    if (!listId && !orderId) return;
    let alive = true; setSourceLoading(true); setSourceError('');
    api.get(listId ? `/buy-for-me/lists/${encodeURIComponent(listId)}` : `/buy-for-me/mine/${encodeURIComponent(orderId)}`, { skipCache: true })
      .then(({ data }) => {
        if (!alive) return;
        const draft = shoppingDraftFrom(data);
        setStoreType(draft.storeType); setPreferredStore(draft.preferredStore); setAuthorizationMode(draft.authorizationMode); setShoppingBudget(draft.shoppingBudget);
        setItems(draft.items.length ? draft.items.map(item => ({ ...emptyItem(), ...item })) : [emptyItem()]);
        setSourceNotice('Liste reprise. Vérifiez les articles et les estimations : le prix sera recalculé avant paiement.');
      }).catch(error => { if (alive) setSourceError(getApiErrorMessage(error, 'Cette liste ne peut pas être reprise.')); })
      .finally(() => { if (alive) setSourceLoading(false); });
    return () => { alive = false; };
  }, [location.search, user, country?.id, country?._id]);

  useEffect(() => {
    let alive = true; setAvailabilityLoading(true); setEnabled(false);
    api.get('/buy-for-me/capabilities', { skipCache: true }).then(({ data }) => {
      if (!alive) return;
      setEnabled(Boolean(data?.enabled));
      if (Array.isArray(data?.storeTypes) && data.storeTypes.length) setSupportedStoreTypes(data.storeTypes);
    }).catch(() => { if (alive) setEnabled(false); }).finally(() => { if (alive) setAvailabilityLoading(false); });
    return () => { alive = false; };
  }, [country?.id, country?._id]);

  const pickupPayload = useMemo(() => buildLocationPayload(pickup, cities, communes), [pickup, cities, communes]);
  const dropoffPayload = useMemo(() => buildLocationPayload(dropoff, cities, communes), [dropoff, cities, communes]);
  const savedAddress = useMemo(() => {
    const cityId = String(user?.cityId?._id || user?.cityId || cities.find((city) => city.name === user?.city)?._id || '');
    const communeId = String(user?.communeId?._id || user?.communeId || communes.find((commune) => String(commune?.cityId?._id || commune?.cityId || '') === cityId && commune.name === user?.commune)?._id || '');
    return {
      cityId,
      communeId,
      address: user?.address || '',
      contactName: user?.name || '',
      contactPhone: user?.phone || ''
    };
  }, [cities, communes, user]);
  const canAutofillAddress = Boolean(savedAddress.address);
  const cleanItems = useMemo(
    () => items
      .map(({ name, quantity, estimatedUnitPrice, note, imageUrl }) => ({
        name: name.trim(),
        quantity: Number(quantity),
        estimatedUnitPrice: Math.round(Number(estimatedUnitPrice)),
        estimatedTotal: getItemEstimatedTotal({ quantity, estimatedUnitPrice }),
        note: note.trim(),
        imageUrl
      }))
      .filter((item) => item.name && item.quantity > 0 && (authorizationMode === 'SHOPPING_BUDGET' || (item.estimatedUnitPrice > 0 && item.estimatedTotal > 0))),
    [authorizationMode, items]
  );
  const estimatedShoppingValue = useMemo(
    () => cleanItems.reduce((total, item) => total + item.estimatedTotal, 0),
    [cleanItems]
  );
  const authorizedShoppingValue = authorizationMode === 'SHOPPING_BUDGET' ? Math.round(Number(shoppingBudget)) : estimatedShoppingValue;
  const itemsAreComplete = cleanItems.length === items.length;
  const readyForQuote = dropoff.address.trim() && authorizedShoppingValue > 0 && itemsAreComplete && storeType;
  const quoteInput = JSON.stringify({ countryId: country?.id || country?._id, storeType, pickup: pickupPayload, dropoff: dropoffPayload, items: cleanItems, authorizationMode, shoppingBudget: authorizedShoppingValue });
  const [quotedInput, setQuotedInput] = useState('');

  useEffect(() => {
    if (!readyForQuote || !enabled) { setQuote(null); setQuoteError(''); setQuoting(false); return undefined; }
    let cancelled = false;
    setQuote(null);
    setQuoting(true);
    const timer = setTimeout(() => {
      api.post('/buy-for-me/estimate', { storeType, pickup: pickupPayload, dropoff: dropoffPayload, items: cleanItems, authorizationMode, shoppingBudget: authorizedShoppingValue })
        .then(({ data }) => { if (!cancelled) { setQuote(data); setQuotedInput(quoteInput); setQuoteError(''); } })
        .catch((error) => { if (!cancelled) { setQuote(null); setQuoteError(getApiErrorMessage(error, 'Estimation indisponible. Réessayez en vérifiant l’adresse et le budget.')); } })
        .finally(() => { if (!cancelled) setQuoting(false); });
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [authorizationMode, authorizedShoppingValue, cleanItems, dropoffPayload, pickupPayload, readyForQuote, storeType, quoteInput, enabled]);

  const updateItem = (index, patch) => setItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateItemByClientId = (clientId, patch) => setItems((previous) => previous.map((item) => item.clientId === clientId ? { ...item, ...patch } : item));
  const removeItem = (index) => setItems((previous) => {
    if (previous.length <= 1) return previous;
    const preview = previous[index]?.imagePreview;
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
      previewUrlsRef.current.delete(preview);
    }
    return previous.filter((_, itemIndex) => itemIndex !== index);
  });
  const uploadItemImage = async (index, file) => {
    if (!file) return;
    const item = items[index];
    if (!item) return;
    if (!file.type.startsWith('image/')) {
      updateItemByClientId(item.clientId, { imageError: 'Sélectionnez une image valide.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      updateItemByClientId(item.clientId, { imageError: 'L’image ne doit pas dépasser 10 Mo.' });
      return;
    }
    if (item.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(item.imagePreview);
      previewUrlsRef.current.delete(item.imagePreview);
    }
    const preview = URL.createObjectURL(file);
    previewUrlsRef.current.add(preview);
    updateItemByClientId(item.clientId, { imagePreview: preview, imageUrl: '', imageUploading: true, imageError: '' });
    const payload = new FormData();
    payload.append('image', file);
    try {
      const { data } = await api.post('/buy-for-me/item-images', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateItemByClientId(item.clientId, { imageUrl: data?.imageUrl || '', imageUploading: false, imageError: data?.imageUrl ? '' : 'Image non enregistrée.' });
    } catch (error) {
      updateItemByClientId(item.clientId, { imageUploading: false, imageError: getApiErrorMessage(error, 'Impossible d’envoyer cette image.') });
    }
  };
  const clearItemImage = (index) => {
    const item = items[index];
    if (item?.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(item.imagePreview);
      previewUrlsRef.current.delete(item.imagePreview);
    }
    updateItem(index, { imageUrl: '', imagePreview: '', imageError: '' });
  };
  const imageUploadInProgress = items.some((item) => item.imageUploading);
  const canPay = Boolean(enabled && user && quote?.total && quotedInput === quoteInput && !quoting && cleanItems.length && itemsAreComplete && dropoff.address.trim() && !imageUploadInProgress);

  useEffect(() => { setListSaved(false); }, [storeType, preferredStore, authorizationMode, authorizedShoppingValue, cleanItems]);

  const beforePay = () => {
    if (imageUploadInProgress) return 'Attendez la fin de l’envoi des images.';
    if (!canPay) return authorizationMode === 'SHOPPING_BUDGET'
      ? 'Complétez le nom et la quantité de chaque article, indiquez le budget autorisé, puis attendez l’estimation.'
      : 'Complétez le nom, la quantité et le prix estimé de chaque article, puis attendez l’estimation.';
    if (pickup.address.trim()) saveAddressToHistory(pickup);
    setAddressHistory(saveAddressToHistory(dropoff));
    return {
      actionContext: {
        kind: 'BUY_FOR_ME_ORDER',
        storeType,
        preferredStore,
        pickup: pickupPayload,
        dropoff: dropoffPayload,
        items: cleanItems,
        authorizationMode,
        shoppingBudget: authorizedShoppingValue,
        specialInstructions,
        balancePreference
      }
    };
  };

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (availabilityLoading || sourceLoading) return <p role="status" className="shop-muted py-12">Préparation de votre liste…</p>;
  if (!enabled) return <div className="shop-card"><h1>Nous revenons bientôt.</h1><p className="shop-muted mt-3">Les nouvelles demandes sont momentanément indisponibles.</p><Link to="/buy-for-me/orders" className="shop-link mt-3">Retrouver mes achats en cours</Link></div>;

  const canContinue = step === 0 ? itemsAreComplete && authorizedShoppingValue > 0 && supportedStoreTypes.includes(storeType) && !imageUploadInProgress : Boolean(dropoff.address.trim());
  const saveList = async () => {
    setListSaving(true); setListError('');
    try { await api.post('/buy-for-me/lists', { ...shoppingDraftFrom({ storeType, preferredStore, authorizationMode, shoppingBudget: authorizedShoppingValue, items: cleanItems }), name: listName }); setListSaved(true); }
    catch (error) { setListError(getApiErrorMessage(error, 'Impossible d’enregistrer la liste.')); }
    finally { setListSaving(false); }
  };

  return (
    <div>
      <nav className="shop-steps" aria-label="Étapes de la demande">{['Ma liste', 'Livraison', 'Vérification'].map((label, index) => <button key={label} type="button" disabled={index > step} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button>)}</nav>
      <div className="mb-6"><p className="shop-eyebrow">Étape {step + 1} sur 3</p><h1 ref={titleRef} tabIndex={-1} className="mt-2">{['Qu’est-ce qu’on vous achète ?', 'Où vous retrouver ?', 'Tout est prêt ?'][step]}</h1><p className="shop-muted mt-2">{['Ajoutez vos articles et choisissez votre budget. Un magasin par demande.', 'Une adresse précise et un repère aident votre livreur.', 'Vérifiez votre liste, les frais et le total avant de payer.'][step]}</p></div>
      {sourceError ? <p role="alert" className="shop-error mb-4">{sourceError} <Link to="/buy-for-me/new" className="underline">Créer une nouvelle liste</Link></p> : null}
      {sourceNotice ? <p role="status" className="shop-note mb-4">{sourceNotice}</p> : null}
      <div className="shop-form-grid"><div className="space-y-4">
        {step === 0 ? <>


        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-gray-900">Comment autoriser les achats ?</h2>
          <p className="mt-1 text-xs text-gray-500">Vous ne connaissez pas les prix ? Choisissez l’option budget: le livreur reste dans le montant indiqué.</p>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={authorizationMode === 'ITEM_ESTIMATES'} onClick={() => setAuthorizationMode('ITEM_ESTIMATES')} className={`rounded-xl border p-3 text-left text-xs font-black ${authorizationMode === 'ITEM_ESTIMATES' ? 'border-[#FF5000] bg-orange-50 text-[#FF3D00]' : 'border-gray-200 text-gray-600'}`}>Prix par article<span className="mt-1 block text-[10px] font-medium">Vous connaissez les prix.</span></button><button type="button" aria-pressed={authorizationMode === 'SHOPPING_BUDGET'} onClick={() => setAuthorizationMode('SHOPPING_BUDGET')} className={`rounded-xl border p-3 text-left text-xs font-black ${authorizationMode === 'SHOPPING_BUDGET' ? 'border-[#FF5000] bg-orange-50 text-[#FF3D00]' : 'border-gray-200 text-gray-600'}`}>Budget d’achats<span className="mt-1 block text-[10px] font-medium">Vous ne connaissez pas les prix.</span></button></div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900"><BuildingStorefrontIcon className="text-[#FF5000] h-4 w-4" /> Magasin souhaité</h2>
          <label className="shop-label" htmlFor="shopping-store-type">Type de magasin</label>
          <select id="shopping-store-type" className="shop-field" value={storeType} onChange={event => setStoreType(event.target.value)}>{STORE_TYPES.filter(([key]) => supportedStoreTypes.includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <input aria-label="Magasin préféré" value={preferredStore} onChange={(event) => setPreferredStore(event.target.value)} placeholder="Magasin préféré (ou « n’importe quel magasin proche »)" className="mt-3 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-black text-gray-900"><CubeIcon className="text-[#FF5000] h-4 w-4" /> Liste d’achats</h2><button type="button" disabled={items.length >= 30} onClick={() => setItems((previous) => [...previous, emptyItem()])} className="inline-flex items-center gap-1 text-xs font-black text-[#FF5000]"><PlusIcon className="h-3.5 w-3.5" /> Ajouter</button></div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.clientId} className="rounded-xl border border-gray-100 bg-gray-50 p-2.5">
                <div className="flex items-center gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-[10px] font-bold text-gray-500">Produit {index + 1}</span>
                    <input
                      value={item.name}
                      onChange={(event) => updateItem(index, { name: event.target.value })}
                      placeholder="Ex. lait entier, riz parfumé…"
                      className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#FF5000]"
                    />
                  </label>
                  <button type="button" onClick={() => removeItem(index)} className="mt-4 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-transparent text-gray-400 hover:border-red-100 hover:bg-white hover:text-red-500" aria-label={`Retirer le produit ${index + 1}`}><MinusIcon className="h-[15px] w-[15px]" /></button>
                </div>
                <div className={`mt-2 grid gap-2 grid-cols-[72px_minmax(0,1fr)]`}>
                  <label>
                    <span className="mb-1 block text-center text-[10px] font-bold text-gray-500">Qté</span>
                    <input value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} placeholder="1" type="number" min="0.001" step="0.001" inputMode="decimal" className="min-h-10 w-full rounded-lg border border-gray-200 bg-white px-1.5 text-center text-sm font-black outline-none focus:border-[#FF5000]" />
                  </label>
                  {authorizationMode === 'ITEM_ESTIMATES' ? <label>
                    <span className="mb-1 block text-[10px] font-bold text-gray-500">Prix unitaire estimé (FCFA)</span>
                    <input value={item.estimatedUnitPrice} onChange={(event) => updateItem(index, { estimatedUnitPrice: event.target.value })} placeholder="Ex. 2 500" type="number" min="1" step="1" inputMode="numeric" className="min-h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-[#FF5000]" />
                  </label> : <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">Prix non requis : cet article sera acheté dans le budget autorisé.</p>}
                </div>
                {authorizationMode === 'ITEM_ESTIMATES' ? <div className="mt-2 flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-xs">
                  <span className="font-bold text-orange-800">Total estimé</span>
                  <span className="font-black text-[#FF3D00]">{formatCurrency(getItemEstimatedTotal(item))}</span>
                </div> : null}
                <details className="mt-3"><summary className="text-xs font-bold cursor-pointer text-gray-600">Ajouter une précision ou une photo</summary>
                <label className="mt-2 block">
                  <span className="mb-1 block text-[10px] font-bold text-gray-500">Précision facultative</span>
                  <input value={item.note} onChange={(event) => updateItem(index, { note: event.target.value })} placeholder="Marque, taille, préférence…" className="min-h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-[#FF5000]" />
                </label>
                <div className="mt-2">
                  {item.imagePreview || item.imageUrl ? (
                    <div className="flex items-center gap-2 rounded-lg border border-orange-100 bg-white p-2">
                      <img src={item.imagePreview || normalizeFileUrl(item.imageUrl)} alt={`Aperçu de ${item.name || `produit ${index + 1}`}`} className="h-14 w-14 shrink-0 rounded-lg bg-gray-100 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-gray-800">{item.imageUploading ? 'Envoi de la photo…' : item.imageUrl ? 'Photo ajoutée' : 'Photo sélectionnée'}</p>
                        <p className="mt-0.5 text-[10px] text-gray-500">Le livreur pourra reconnaître le produit.</p>
                      </div>
                      {item.imageUploading ? <ArrowPathIcon className="shrink-0 animate-spin text-[#FF5000] h-[17px] w-[17px]" /> : <button type="button" onClick={() => clearItemImage(index)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500" aria-label={`Supprimer la photo du produit ${index + 1}`}><XMarkIcon className="h-3.5 w-3.5" /></button>}
                    </div>
                  ) : (
                    <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-orange-200 bg-orange-50/60 px-3 text-xs font-black text-[#FF3D00]">
                      <PhotoIcon className="h-4 w-4" />
                      Ajouter une photo <span className="font-semibold text-orange-700/70">(facultatif)</span>
                      <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(event) => { uploadItemImage(index, event.target.files?.[0]); event.target.value = ''; }} />
                    </label>
                  )}
                  {item.imageError ? <p className="mt-1.5 text-[10px] font-bold text-red-600">{item.imageError}</p> : null}
                </div></details>
              </div>
            ))}
          </div>
        </section>

        {authorizationMode === 'SHOPPING_BUDGET' ? <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4 shadow-sm"><label htmlFor="shopping-budget" className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900"><CurrencyDollarIcon className="text-[#FF5000] h-4 w-4" /> Budget d’achats autorisé</label><input id="shopping-budget" type="number" min="1" value={shoppingBudget} onChange={(event) => setShoppingBudget(event.target.value)} placeholder="Ex. 25 000" className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-lg font-black text-gray-900 outline-none focus:border-[#FF5000]" /><p className="mt-2 text-[11px] font-medium text-gray-500">Utilisez cette option si vous ne connaissez pas les prix. Le livreur ne dépassera pas ce budget sans votre accord.</p></section> : <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-gray-900"><CurrencyDollarIcon className="text-[#FF5000] h-4 w-4" /> Valeur estimée des achats</p><p className="mt-1 text-[11px] font-medium text-gray-600">Calculée automatiquement à partir de chaque article.</p></div><p className="text-lg font-black text-[#FF3D00]">{formatCurrency(estimatedShoppingValue)}</p></div><p className="mt-3 text-[11px] font-medium text-gray-500">Ce montant autorise les achats. S’il est dépassé, les achats sont suspendus jusqu’à votre choix ou paiement complémentaire.</p></section>}

        <details className="shop-card"><summary className="text-sm font-bold cursor-pointer">Enregistrer cette liste pour plus tard</summary><p className="shop-muted mt-2">Seuls les articles et le budget sont conservés. Le prix sera recalculé à chaque achat.</p>{listSaved ? <p role="status" className="shop-link">Liste enregistrée dans Mes listes.</p> : <div className="mt-3"><label className="shop-label" htmlFor="shopping-list-name">Nom de la liste</label><input id="shopping-list-name" className="shop-field" value={listName} onChange={event => setListName(event.target.value)} maxLength={80} placeholder="Ex. Mes courses de la semaine" /><button type="button" disabled={listSaving || !listName.trim() || !itemsAreComplete} onClick={saveList} className="shop-button shop-button--secondary mt-3">{listSaving ? 'Enregistrement…' : 'Enregistrer la liste'}</button></div>}{listError ? <p role="alert" className="shop-error mt-2">{listError}</p> : null}</details>
        </> : null}
        {step === 1 ? <>
        <LocationCard title="Adresse du magasin" subtitle="Indiquez-la seulement si vous avez un magasin précis en tête" value={pickup} onChange={setPickup} onAutofill={canAutofillAddress ? () => setPickup({ ...savedAddress }) : null} cities={cities} communes={communes} optional addressHistory={addressHistory} onPickHistory={(item) => setPickup({ cityId: item.cityId || '', communeId: item.communeId || '', address: item.address || '', contactName: item.contactName || '', contactPhone: item.contactPhone || '' })} />
        <LocationCard title="Adresse de livraison" subtitle="Où nous vous remettons les achats" value={dropoff} onChange={setDropoff} onAutofill={canAutofillAddress ? () => setDropoff({ ...savedAddress }) : null} cities={cities} communes={communes} addressHistory={addressHistory} onPickHistory={(item) => setDropoff({ cityId: item.cityId || '', communeId: item.communeId || '', address: item.address || '', contactName: item.contactName || '', contactPhone: item.contactPhone || '' })} />

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><label htmlFor="shopping-instructions" className="text-sm font-black text-gray-900">Instructions particulières</label><textarea id="shopping-instructions" value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} rows={3} placeholder="Ex. Vérifier la date d’expiration, sans piment, prendre le moins cher…" className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[#FF5000]" /></section>

        </> : null}
        {step === 2 ? <>
        <section className="shop-card"><div className="shop-row"><h2>Votre liste</h2><button className="shop-link" onClick={() => setStep(0)}>Modifier les articles</button></div><p className="shop-muted">{preferredStore || 'Magasin au choix du livreur'}</p><ul className="mt-4 space-y-3">{cleanItems.map((item, index) => <li key={index} className="shop-row text-sm"><span>{item.name} <strong>× {item.quantity}</strong></span>{authorizationMode === 'ITEM_ESTIMATES' ? <span>{formatCurrency(item.estimatedTotal)}</span> : null}</li>)}</ul></section>
        <section className="shop-card"><div className="shop-row"><h2>Livraison</h2><button className="shop-link" onClick={() => setStep(1)}>Modifier l’adresse</button></div><p className="mt-3 text-sm">{dropoff.address}</p><p className="shop-muted">{[dropoffPayload.cityName, dropoffPayload.communeName, dropoff.contactName, dropoff.contactPhone].filter(Boolean).join(' · ')}</p>{specialInstructions ? <p className="shop-note mt-3">{specialInstructions}</p> : null}</section>
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><h2 className="text-sm font-black text-gray-900">S’il reste de l’argent</h2><p className="mt-1 text-xs text-gray-500">Votre choix est appliqué après la livraison, selon le reçu du magasin.</p><div className="mt-3 space-y-2">{[['ORIGINAL_PAYMENT', 'Remboursement sur le compte Mobile Money ayant payé'], ['DRIVER_TIP', 'Donner le solde au livreur (pourboire)'], ['PLATFORM_DONATION', 'Faire don du solde à HDMarket']].map(([key, label]) => <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs font-bold ${balancePreference === key ? 'border-[#FF5000] bg-orange-50 text-[#FF3D00]' : 'border-gray-200 text-gray-600'}`}><input type="radio" checked={balancePreference === key} onChange={() => setBalancePreference(key)} />{label}</label>)}</div></section>

        <p className="shop-note"><TruckIcon className="inline mr-2" />Paiement Mobile Money avant les achats. Vous recevrez le reçu du magasin. Tout dépassement nécessite votre accord.</p>
        </> : null}
      </div>
      <aside className="shop-card shop-summary">
        <p className="shop-eyebrow">Votre demande</p><h2 className="mt-2">Un budget clair.</h2>
        <dl className="mt-4"><div><dt>Articles dans la liste</dt><dd>{cleanItems.length}</dd></div><div><dt>{authorizationMode === 'SHOPPING_BUDGET' ? 'Budget des achats' : 'Achats estimés'}</dt><dd>{authorizedShoppingValue > 0 ? formatCurrency(authorizedShoppingValue) : 'À compléter'}</dd></div>{quote?.breakdown?.filter(line => !['estimatedShoppingValue', 'shoppingBudget'].includes(line.key)).map(line => <div key={line.key}><dt>{line.label}</dt><dd>{formatCurrency(line.amount)}</dd></div>)}</dl>
        <div className="shop-total"><span>Total à payer</span><strong>{quoting ? 'Calcul…' : quote && quotedInput === quoteInput ? formatCurrency(quote.total) : '—'}</strong></div>
        <p className="shop-muted mt-3">{step === 0 ? 'Les frais seront calculés après votre adresse de livraison.' : quoting ? 'Calcul des frais pour votre adresse…' : 'Aucun paiement avant votre validation à la dernière étape.'}</p>
        {quoteError ? <p role="alert" className="shop-error mt-3">{quoteError}</p> : null}
        <div className="shop-form-actions">{step > 0 ? <button type="button" className="shop-button shop-button--secondary" onClick={() => setStep(value => value - 1)}>Retour</button> : null}
        {step < 2 ? <button type="button" disabled={!canContinue} onClick={() => setStep(value => value + 1)} className="shop-button">{step === 0 ? 'Choisir la livraison' : 'Vérifier ma demande'} <span aria-hidden="true">→</span></button> : <PawaPayButton className="shopping-pay" disabled={!canPay} amount={quote?.total} purpose="BUY_FOR_ME_FUNDING" returnPath="/buy-for-me/orders" label="Payer et trouver un livreur" onBeforeStart={beforePay} />}
        </div>
        {!canContinue && step < 2 ? <p role="status" className="shop-muted mt-3">{step === 0 ? 'Complétez chaque article et le budget pour continuer.' : 'Indiquez votre adresse de livraison pour continuer.'}</p> : null}
      </aside></div>
    </div>
  );
}
