import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileText, MapPin, Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import api from '../../services/api';
import { createIdempotencyKey } from '../../utils/idempotency';
import { formatPriceWithStoredSettings } from '../../utils/priceFormatter';
import BaseModal, { ModalBody, ModalHeader } from '../modals/BaseModal';
import {
  getDefaultSelectedAttributes,
  isProductAttributeSelectionRequired,
  normalizeProductAttributes,
  normalizeSelectedAttributes,
  resolveSelectedAttributesImage,
  resolveSelectedAttributesPrice,
  validateSelectedAttributes
} from '../../utils/productAttributes';
import { isColorAttribute, resolveSwatchColor } from '../../utils/colorSwatch';

const fieldClass = 'min-h-12 w-full rounded-xl border border-[#e2dcd2] bg-white px-3 text-sm font-semibold text-[#231f1b] outline-none transition focus:border-[#e85d00] focus:ring-2 focus:ring-[#e85d00]/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white';

const createQuotationItem = (entry) => {
  const source = entry?.product || entry;
  const attributes = normalizeProductAttributes(source?.attributes);
  const initialSelected = normalizeSelectedAttributes(
    entry?.selectedAttributes?.length
      ? entry.selectedAttributes
      : getDefaultSelectedAttributes(attributes)
  );
  const resolvedPrice = resolveSelectedAttributesPrice({
    productAttributes: attributes,
    selectedAttributes: initialSelected,
    basePrice: source?.price
  });
  const resolvedImage = resolveSelectedAttributesImage({
    productAttributes: attributes,
    selectedAttributes: initialSelected,
    images: source?.images
  });
  return {
    productId: source?._id,
    title: source?.title || 'Produit',
    images: Array.isArray(source?.images) ? source.images : [],
    image: resolvedImage.image || source?.images?.[0] || '',
    basePrice: Number(source?.price || 0),
    publicPrice: Number(resolvedPrice.unitPrice || source?.price || 0),
    attributes,
    selectedAttributes: initialSelected,
    quantity: Math.max(1, Number(entry?.quantity || 1)),
    requestedPrice: ''
  };
};

export default function QuotationRequestModal({ isOpen, onClose, products = [], availableProducts = [], defaultCity = '', onCreated, grouped = false }) {
  const normalizedProducts = useMemo(() => (Array.isArray(products) ? products : []).filter(Boolean), [products]);
  const normalizedAvailableProducts = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(availableProducts) ? availableProducts : []).filter((entry) => {
      const source = entry?.product || entry;
      const id = String(source?._id || '');
      if (!id || seen.has(id) || source?.quotationEnabled === false) return false;
      seen.add(id);
      return true;
    });
  }, [availableProducts]);
  const [items, setItems] = useState([]);
  const [deliveryCity, setDeliveryCity] = useState(defaultCity || 'Brazzaville');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [message, setMessage] = useState('Bonjour, je souhaite acheter ces articles. Pouvez-vous me proposer un meilleur prix ?');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setItems(normalizedProducts.map(createQuotationItem));
    setDeliveryCity(defaultCity || 'Brazzaville');
    setExpectedDeliveryDate('');
    setMessage('Bonjour, je souhaite acheter ces articles. Pouvez-vous me proposer un meilleur prix ?');
    setError('');
  }, [defaultCity, isOpen, normalizedProducts]);

  const updateItem = (index, patch) => setItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const addProduct = (entry) => {
    const nextItem = createQuotationItem(entry);
    if (!nextItem.productId) return;
    setItems((previous) => previous.some((item) => String(item.productId) === String(nextItem.productId))
      ? previous
      : [...previous, nextItem]);
  };

  const removeItem = (index) => setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));

  const productsToAdd = normalizedAvailableProducts.filter((entry) => {
    const source = entry?.product || entry;
    return !items.some((item) => String(item.productId) === String(source?._id));
  });

  const updateItemAttribute = (index, attribute, value) => {
    setItems((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const name = String(attribute?.name || '').trim();
      const normalizedValue = String(value ?? '').trim();
      const selectedAttributes = normalizeSelectedAttributes(item.selectedAttributes)
        .filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
      if (normalizedValue) selectedAttributes.push({ name, value: normalizedValue });
      const resolvedPrice = resolveSelectedAttributesPrice({ productAttributes: item.attributes, selectedAttributes, basePrice: item.basePrice });
      const resolvedImage = resolveSelectedAttributesImage({ productAttributes: item.attributes, selectedAttributes, images: item.images });
      return { ...item, selectedAttributes, publicPrice: Number(resolvedPrice.unitPrice || item.basePrice), image: resolvedImage.image || item.images?.[0] || item.image };
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!deliveryCity.trim()) return setError('Indiquez la ville de livraison.');
    for (const item of items) {
      const validation = validateSelectedAttributes({ productAttributes: item.attributes, selectedAttributes: item.selectedAttributes });
      if (!validation.valid) return setError(`${item.title} : choisissez ${validation.missing.join(', ')}.`);
      const unavailableAttribute = item.attributes.find((attribute) => {
        if (attribute.type !== 'select') return false;
        const value = validation.selectedAttributes.find((entry) => entry.name.toLowerCase() === attribute.name.toLowerCase())?.value;
        return value && attribute.optionOutOfStock?.[value.toLowerCase()];
      });
      if (unavailableAttribute) return setError(`${item.title} : l’option choisie pour ${unavailableAttribute.name} est en rupture de stock.`);
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/quotations', {
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Math.min(9999, Math.max(1, Number(item.quantity || 1))),
          requestedPrice: item.requestedPrice === '' ? null : Number(item.requestedPrice),
          selectedAttributes: item.selectedAttributes
        })),
        deliveryCity: deliveryCity.trim(),
        expectedDeliveryDate: expectedDeliveryDate || null,
        message: message.trim()
      }, { headers: { 'Idempotency-Key': createIdempotencyKey('quotation-request') } });
      onCreated?.(data);
      onClose?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Impossible d’envoyer la demande de devis.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={submitting ? undefined : onClose} panelClassName="sm:max-w-xl">
      <ModalHeader title={grouped || items.length > 1 ? 'Demander un devis groupé' : 'Demander un devis'} subtitle="Le prix public restera inchangé." onClose={submitting ? undefined : onClose} />
      <ModalBody className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            {items.map((item, index) => (
              <article key={`${item.productId}-${index}`} className="rounded-2xl bg-[#f7f4ef] p-3 dark:bg-neutral-900">
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#eee8df]">
                    {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-black text-[#231f1b] dark:text-white">{item.title}</p>
                    <p className="mt-0.5 text-xs font-medium text-[#8a8378]">Prix public : {formatPriceWithStoredSettings(item.publicPrice)}</p>
                  </div>
                  {grouped && items.length > 1 ? (
                    <button type="button" aria-label={`Retirer ${item.title}`} onClick={() => removeItem(index)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e2dcd2] bg-white text-[#79716a] transition hover:border-red-200 hover:text-red-600 dark:border-neutral-700 dark:bg-neutral-950">
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {item.attributes.length ? (
                  <div className="mt-3 space-y-3 rounded-2xl border border-[#e8e1d7] bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#6b6459]"><SlidersHorizontal className="h-3.5 w-3.5 text-[#e85d00]" />Options du produit</p>
                    {item.attributes.map((attribute) => {
                      const selectedValue = item.selectedAttributes.find((entry) => entry.name.toLowerCase() === attribute.name.toLowerCase())?.value || '';
                      return <label key={`${item.productId}-${attribute.key || attribute.name}`} className="block text-[11px] font-bold text-[#6b6459]">
                        {attribute.name}{isProductAttributeSelectionRequired(attribute) ? <span className="ml-1 text-[#e85d00]">*</span> : null}
                        {attribute.type === 'select' ? (
                          <div className="mt-1.5 flex flex-wrap gap-2">{attribute.options.map((option) => {
                            const active = option.toLowerCase() === selectedValue.toLowerCase();
                            const optionKey = option.toLowerCase();
                            const unavailable = Boolean(attribute.optionOutOfStock?.[optionKey]);
                            const swatch = isColorAttribute(attribute) ? resolveSwatchColor(option) : '';
                            return <button key={option} type="button" disabled={unavailable} onClick={() => updateItemAttribute(index, attribute, option)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${active ? 'border-[#231f1b] bg-[#231f1b] text-white' : 'border-[#ded6ca] bg-white text-[#57534e]'} disabled:cursor-not-allowed disabled:opacity-40`}>
                              {swatch ? <span className="h-4 w-4 rounded-full border border-black/15" style={{ backgroundColor: swatch }} /> : null}
                              {option}{attribute.optionPrices?.[optionKey] ? <small className={active ? 'text-orange-200' : 'text-[#e85d00]'}>{formatPriceWithStoredSettings(attribute.optionPrices[optionKey])}</small> : null}
                            </button>;
                          })}</div>
                        ) : <input type={attribute.type === 'number' ? 'number' : 'text'} value={selectedValue} onChange={(event) => updateItemAttribute(index, attribute, event.target.value)} className={`${fieldClass} mt-1.5`} />}
                      </label>;
                    })}
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-[auto_1fr] gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-[#6b6459]">Quantité</label>
                    <div className="flex h-11 items-center rounded-xl border border-[#e2dcd2] bg-white dark:border-neutral-700 dark:bg-neutral-950">
                      <button type="button" className="grid h-11 w-9 place-items-center" onClick={() => updateItem(index, { quantity: Math.max(1, item.quantity - 1) })}><Minus className="h-4 w-4" /></button>
                      <input aria-label={`Quantité ${item.title}`} type="number" min="1" max="9999" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} className="h-10 w-12 border-0 bg-transparent p-0 text-center text-sm font-black outline-none" />
                      <button type="button" className="grid h-11 w-9 place-items-center" onClick={() => updateItem(index, { quantity: Math.min(9999, Number(item.quantity || 1) + 1) })}><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <label className="block min-w-0 text-[11px] font-bold text-[#6b6459]">
                    Prix unitaire souhaité <span className="font-medium text-[#a8a29e]">(optionnel)</span>
                    <input type="number" min="1" value={item.requestedPrice} onChange={(event) => updateItem(index, { requestedPrice: event.target.value })} className={`${fieldClass} mt-1`} placeholder="Ex. 42 000" />
                  </label>
                </div>
              </article>
            ))}
          </div>

          {grouped && productsToAdd.length ? (
            <section className="rounded-2xl border border-[#e6dfd5] bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
              <div className="mb-3">
                <p className="text-sm font-black text-[#231f1b] dark:text-white">Ajouter des produits de la boutique</p>
                <p className="text-xs font-medium text-[#8a8378]">Un seul devis sera envoyé au vendeur.</p>
              </div>
              <div className="space-y-2">
                {productsToAdd.map((entry) => {
                  const source = entry?.product || entry;
                  return (
                    <button key={source?._id} type="button" onClick={() => addProduct(entry)} className="flex w-full items-center gap-3 rounded-xl bg-[#f7f4ef] p-2 text-left transition hover:bg-[#f1ebe2] dark:bg-neutral-900">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#eee8df]">
                        {source?.images?.[0] ? <img src={source.images[0]} alt="" className="h-full w-full object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-[#231f1b] dark:text-white">{source?.title || 'Produit'}</span>
                        <span className="mt-0.5 block text-[11px] font-bold text-[#8a8378]">{formatPriceWithStoredSettings(source?.price || 0)}</span>
                      </span>
                      <span className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-white px-3 text-[11px] font-black text-[#e85d00] shadow-sm dark:bg-neutral-800"><Plus className="h-3.5 w-3.5" />Ajouter</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <label className="block text-xs font-bold text-[#57534e] dark:text-neutral-300"><MapPin className="mr-1 inline h-4 w-4" />Ville de livraison<input value={deliveryCity} onChange={(event) => setDeliveryCity(event.target.value)} className={`${fieldClass} mt-1.5`} maxLength={120} required /></label>
          <label className="block text-xs font-bold text-[#57534e] dark:text-neutral-300"><CalendarDays className="mr-1 inline h-4 w-4" />Date souhaitée <span className="font-medium text-[#a8a29e]">(optionnel)</span><input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} className={`${fieldClass} mt-1.5`} /></label>
          <label className="block text-xs font-bold text-[#57534e] dark:text-neutral-300"><FileText className="mr-1 inline h-4 w-4" />Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} className={`${fieldClass} mt-1.5 min-h-28 py-3`} maxLength={2000} /></label>
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p> : null}
          <button type="submit" disabled={submitting || !items.length} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-60">{submitting ? 'Envoi…' : grouped || items.length > 1 ? 'Demander le devis groupé' : 'Envoyer la demande'}</button>
        </form>
      </ModalBody>
    </BaseModal>
  );
}
