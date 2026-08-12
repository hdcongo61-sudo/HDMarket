import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { CircleDollarSign, ImagePlus, Loader2, MapPin, Minus, PackagePlus, Plus, ReceiptText, ShoppingBasket, Store, Truck, User, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import PawaPayButton from '../components/PawaPayButton';
import GlassHeader from '../components/orders/GlassHeader';
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
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFEDE3] text-[#FF5000]"><MapPin size={16} /></span>
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
            <User size={12} />
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
        <select value={value.cityId} onChange={(event) => onChange({ ...value, cityId: event.target.value, communeId: '' })} className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000]">
          <option value="">Ville</option>
          {cities.map((city) => <option key={city._id} value={city._id}>{city.name}</option>)}
        </select>
        <select value={value.communeId} onChange={(event) => onChange({ ...value, communeId: event.target.value })} disabled={!value.cityId} className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#FF5000] disabled:opacity-50">
          <option value="">Commune</option>
          {localCommunes.map((commune) => <option key={commune._id} value={commune._id}>{commune.name}</option>)}
        </select>
      </div>
      <input value={value.address} onChange={(event) => onChange({ ...value, address: event.target.value })} placeholder="Adresse précise, quartier, repère…" className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input value={value.contactName} onChange={(event) => onChange({ ...value, contactName: event.target.value })} placeholder="Nom du contact" className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
        <input value={value.contactPhone} onChange={(event) => onChange({ ...value, contactPhone: event.target.value })} placeholder="Téléphone" type="tel" className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
      </div>
    </section>
  );
}

export default function BuyForMe() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const { cities = [], communes = [] } = useAppSettings();
  const [enabled, setEnabled] = useState(true);
  const [supportedStoreTypes, setSupportedStoreTypes] = useState(STORE_TYPES.map(([key]) => key));
  const [storeType, setStoreType] = useState('SUPERMARKET');
  const [preferredStore, setPreferredStore] = useState('');
  const [pickup, setPickup] = useState(emptyLocation);
  const [dropoff, setDropoff] = useState(emptyLocation);
  const [items, setItems] = useState([emptyItem()]);
  const [authorizationMode, setAuthorizationMode] = useState('ITEM_ESTIMATES');
  const [shoppingBudget, setShoppingBudget] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [balancePreference, setBalancePreference] = useState('WALLET_REFUND');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [addressHistory, setAddressHistory] = useState(readAddressHistory);
  const previewUrlsRef = useRef(new Set());

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    api.get('/buy-for-me/capabilities').then(({ data }) => {
      setEnabled(Boolean(data?.enabled));
      if (Array.isArray(data?.storeTypes) && data.storeTypes.length) setSupportedStoreTypes(data.storeTypes);
    }).catch(() => setEnabled(true));
  }, []);

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

  useEffect(() => {
    if (!readyForQuote) { setQuote(null); setQuoteError(''); return undefined; }
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(() => {
      api.post('/buy-for-me/estimate', { storeType, pickup: pickupPayload, dropoff: dropoffPayload, items: cleanItems, authorizationMode, shoppingBudget: authorizedShoppingValue })
        .then(({ data }) => { if (!cancelled) { setQuote(data); setQuoteError(''); } })
        .catch((error) => { if (!cancelled) { setQuote(null); setQuoteError(getApiErrorMessage(error, 'Devis indisponible.')); } })
        .finally(() => { if (!cancelled) setQuoting(false); });
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [authorizationMode, authorizedShoppingValue, cleanItems, dropoffPayload, pickupPayload, readyForQuote, storeType]);

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
  const canPay = Boolean(user && quote?.total && cleanItems.length && itemsAreComplete && dropoff.address.trim() && !imageUploadInProgress);

  const beforePay = () => {
    if (imageUploadInProgress) return 'Attendez la fin de l’envoi des images.';
    if (!canPay) return authorizationMode === 'SHOPPING_BUDGET'
      ? 'Complétez le nom et la quantité de chaque article, indiquez le budget autorisé, puis attendez le devis.'
      : 'Complétez le nom, la quantité et le prix estimé de chaque article, puis attendez le devis.';
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
  if (!enabled) return <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-gray-500">Le service Acheter Pour Moi est temporairement indisponible.</div>;

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-36">
      <GlassHeader title="Acheter Pour Moi" subtitle="Un livreur fait les achats et vous livre" backTo="/" right={<Link to="/buy-for-me/orders" className="text-xs font-black text-[#FF5000]">Mes demandes</Link>} />
      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF5000] to-[#FF3D00] p-4 text-white shadow-sm">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><ShoppingBasket size={22} /></span><div><p className="text-base font-black">Vous choisissez, on achète.</p><p className="mt-1 text-xs font-medium leading-5 text-white/85">Indiquez les prix estimés, ou fixez un budget si vous ne les connaissez pas. Le livreur ne dépasse jamais le montant autorisé sans votre accord.</p></div></div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-gray-900">Comment autoriser les achats ?</h2>
          <p className="mt-1 text-xs text-gray-500">Vous ne connaissez pas les prix ? Choisissez l’option budget: le livreur reste dans le montant indiqué.</p>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setAuthorizationMode('ITEM_ESTIMATES')} className={`rounded-xl border p-3 text-left text-xs font-black ${authorizationMode === 'ITEM_ESTIMATES' ? 'border-[#FF5000] bg-orange-50 text-[#FF3D00]' : 'border-gray-200 text-gray-600'}`}>Prix par article<span className="mt-1 block text-[10px] font-medium">Vous connaissez les prix.</span></button><button type="button" onClick={() => setAuthorizationMode('SHOPPING_BUDGET')} className={`rounded-xl border p-3 text-left text-xs font-black ${authorizationMode === 'SHOPPING_BUDGET' ? 'border-[#FF5000] bg-orange-50 text-[#FF3D00]' : 'border-gray-200 text-gray-600'}`}>Budget d’achats<span className="mt-1 block text-[10px] font-medium">Vous ne connaissez pas les prix.</span></button></div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900"><Store size={16} className="text-[#FF5000]" /> Magasin souhaité</h2>
          <div className="grid grid-cols-2 gap-2">
            {STORE_TYPES.filter(([key]) => supportedStoreTypes.includes(key)).map(([key, label]) => <button key={key} type="button" onClick={() => setStoreType(key)} className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${storeType === key ? 'border-[#FF5000] bg-orange-50 text-[#FF3D00]' : 'border-gray-200 text-gray-500'}`}>{label}</button>)}
          </div>
          <input value={preferredStore} onChange={(event) => setPreferredStore(event.target.value)} placeholder="Magasin préféré (ou « n’importe quel magasin proche »)" className="mt-3 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none focus:border-[#FF5000]" />
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-black text-gray-900"><PackagePlus size={16} className="text-[#FF5000]" /> Liste d’achats</h2><button type="button" onClick={() => setItems((previous) => [...previous, emptyItem()])} className="inline-flex items-center gap-1 text-xs font-black text-[#FF5000]"><Plus size={14} /> Ajouter</button></div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="rounded-xl border border-gray-100 bg-gray-50 p-2.5">
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
                  <button type="button" onClick={() => removeItem(index)} className="mt-4 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-transparent text-gray-400 hover:border-red-100 hover:bg-white hover:text-red-500" aria-label={`Retirer le produit ${index + 1}`}><Minus size={15} /></button>
                </div>
                <div className={`mt-2 grid gap-2 ${authorizationMode === 'ITEM_ESTIMATES' ? 'grid-cols-[72px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
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
                      {item.imageUploading ? <Loader2 size={17} className="shrink-0 animate-spin text-[#FF5000]" /> : <button type="button" onClick={() => clearItemImage(index)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500" aria-label={`Supprimer la photo du produit ${index + 1}`}><X size={14} /></button>}
                    </div>
                  ) : (
                    <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-orange-200 bg-orange-50/60 px-3 text-xs font-black text-[#FF3D00]">
                      <ImagePlus size={16} />
                      Ajouter une photo <span className="font-semibold text-orange-700/70">(facultatif)</span>
                      <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(event) => { uploadItemImage(index, event.target.files?.[0]); event.target.value = ''; }} />
                    </label>
                  )}
                  {item.imageError ? <p className="mt-1.5 text-[10px] font-bold text-red-600">{item.imageError}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {authorizationMode === 'SHOPPING_BUDGET' ? <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4 shadow-sm"><label className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900"><CircleDollarSign size={16} className="text-[#FF5000]" /> Budget d’achats autorisé</label><input type="number" min="1" value={shoppingBudget} onChange={(event) => setShoppingBudget(event.target.value)} placeholder="Ex. 25 000" className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-lg font-black text-gray-900 outline-none focus:border-[#FF5000]" /><p className="mt-2 text-[11px] font-medium text-gray-500">Utilisez cette option si vous ne connaissez pas les prix. Le livreur ne dépassera pas ce budget sans votre accord.</p></section> : <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-black text-gray-900"><CircleDollarSign size={16} className="text-[#FF5000]" /> Valeur estimée des achats</p><p className="mt-1 text-[11px] font-medium text-gray-600">Calculée automatiquement à partir de chaque article.</p></div><p className="text-lg font-black text-[#FF3D00]">{formatCurrency(estimatedShoppingValue)}</p></div><p className="mt-3 text-[11px] font-medium text-gray-500">Ce montant autorise les achats. S’il est dépassé, les achats sont suspendus jusqu’à votre choix ou paiement complémentaire.</p></section>}

        <LocationCard title="Adresse du magasin" subtitle="Indiquez-la seulement si vous avez un magasin précis en tête" value={pickup} onChange={setPickup} onAutofill={canAutofillAddress ? () => setPickup({ ...savedAddress }) : null} cities={cities} communes={communes} optional addressHistory={addressHistory} onPickHistory={(item) => setPickup({ cityId: item.cityId || '', communeId: item.communeId || '', address: item.address || '', contactName: item.contactName || '', contactPhone: item.contactPhone || '' })} />
        <LocationCard title="Adresse de livraison" subtitle="Où nous vous remettons les achats" value={dropoff} onChange={setDropoff} onAutofill={canAutofillAddress ? () => setDropoff({ ...savedAddress }) : null} cities={cities} communes={communes} addressHistory={addressHistory} onPickHistory={(item) => setDropoff({ cityId: item.cityId || '', communeId: item.communeId || '', address: item.address || '', contactName: item.contactName || '', contactPhone: item.contactPhone || '' })} />

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><label className="text-sm font-black text-gray-900">Instructions particulières</label><textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} rows={3} placeholder="Ex. Vérifier la date d’expiration, sans piment, prendre le moins cher…" className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[#FF5000]" /></section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><h2 className="text-sm font-black text-gray-900">S’il reste de l’argent</h2><p className="mt-1 text-xs text-gray-500">Votre choix est appliqué après la livraison, selon le reçu du magasin.</p><div className="mt-3 space-y-2">{[['WALLET_REFUND', 'Remboursement sur votre portefeuille HDMarket'], ['DRIVER_TIP', 'Donner le solde au livreur (pourboire)'], ['PLATFORM_DONATION', 'Faire don du solde à HDMarket']].map(([key, label]) => <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs font-bold ${balancePreference === key ? 'border-[#FF5000] bg-orange-50 text-[#FF3D00]' : 'border-gray-200 text-gray-600'}`}><input type="radio" checked={balancePreference === key} onChange={() => setBalancePreference(key)} />{label}</label>)}</div></section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900"><ReceiptText size={16} className="text-[#FF5000]" /> Détail avant paiement</div>{quote?.breakdown?.map((line) => <div key={line.key} className="mb-2 flex items-center justify-between text-sm text-gray-600"><span>{line.label}</span><span className="font-bold text-gray-900">{formatCurrency(line.amount)}</span></div>)}{quoteError ? <p className="mt-2 text-xs font-bold text-red-600">{quoteError}</p> : null}</section>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><p className="flex items-center gap-2 text-xs font-bold text-emerald-800"><Truck size={15} /> Paiement sécurisé avant le début des achats</p><p className="mt-1 text-[11px] text-emerald-700">La valeur estimée de vos articles est réservée. Vous recevez le reçu du magasin et suivez chaque étape.</p></div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white px-4 py-3 [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="mx-auto max-w-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Total à payer</span>
              <p className="text-lg font-black text-[#FF3D00]">{quoting ? '…' : quote ? formatCurrency(quote.total) : '—'}</p>
            </div>
            <PawaPayButton amount={quote?.total} purpose="BUY_FOR_ME_FUNDING" returnPath="/buy-for-me/orders" label="Payer et trouver un livreur" onBeforeStart={beforePay} />
          </div>
        </div>
      </div>
    </div>
  );
}
