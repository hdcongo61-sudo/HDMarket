import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import api, { isApiTimeoutError, verifyTransactionCodeAvailability } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle,
  ClipboardList,
  ArrowLeft,
  ShoppingBag,
  Lock,
  AlertCircle,
  Tag,
  Truck,
  Store,
  MapPin
} from 'lucide-react';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { useAppSettings } from '../context/AppSettingsContext';

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const DELIVERY_SOURCE_LABELS = {
  COMMUNE_FREE: 'Livraison gratuite (commune)',
  COMMUNE_FIXED: 'Livraison fixée par la commune',
  SHOP_FREE: 'Livraison gratuite boutique',
  PRODUCT_FEE: 'Livraison vendeur',
  PICKUP: 'Retrait boutique'
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(text)) return true;
    if (['false', '0', 'no', 'off'].includes(text)) return false;
  }
  return fallback;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const PAYMENT_MODES = Object.freeze({
  STANDARD: 'standard',
  INSTALLMENT: 'installment',
  FULL_PAYMENT: 'full_payment'
});

const getOrderId = (value) => {
  const raw = value?._id || value?.id;
  return raw ? String(raw) : '';
};

const extractFirstOrderId = (payload) => {
  if (!payload) return '';

  const directId = getOrderId(payload);
  if (directId) return directId;

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const id = getOrderId(entry);
      if (id) return id;
    }
  }

  const objectCandidates = [payload?.order, payload?.item, payload?.result, payload?.data];
  for (const entry of objectCandidates) {
    const id = getOrderId(entry);
    if (id) return id;
  }

  const listCandidates = [payload?.orders, payload?.items, payload?.data?.orders, payload?.data?.items];
  for (const list of listCandidates) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const id = getOrderId(entry);
      if (id) return id;
    }
  }

  return '';
};

export default function OrderCheckout() {
  const { cart, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { cities = [], communes = [], getRuntimeValue, t } = useAppSettings();
  const navigate = useNavigate();
  const [payments, setPayments] = useState({});
  const [promoStates, setPromoStates] = useState({});
  const [promoLoadingBySeller, setPromoLoadingBySeller] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES.STANDARD);
  const [guarantor, setGuarantor] = useState({
    fullName: '',
    phone: '',
    relation: '',
    nationalId: '',
    address: ''
  });
  const [installmentEligibility, setInstallmentEligibility] = useState({
    score: null,
    riskLevel: ''
  });
  const [deliveryMode, setDeliveryMode] = useState('PICKUP');
  const [shippingAddress, setShippingAddress] = useState({
    cityId: '',
    communeId: '',
    addressLine: user?.address || '',
    phone: user?.phone || ''
  });

  const totals = cart.totals || { subtotal: 0, quantity: 0 };
  const fullPaymentPromotionEnabled = normalizeBoolean(
    getRuntimeValue('full_payment_promotion_enabled', true),
    true
  );
  const fullPaymentFreeDeliveryEnabled = normalizeBoolean(
    getRuntimeValue('enable_full_payment_free_delivery', true),
    true
  );
  const fullPaymentLabelText =
    String(
      getRuntimeValue('full_payment_label_text', t('checkout.fullPaymentBadge', 'BEST VALUE')) || ''
    ).trim() || t('checkout.fullPaymentBadge', 'BEST VALUE');
  const isInstallmentPayment = paymentMode === PAYMENT_MODES.INSTALLMENT;
  const isFullPaymentSelected =
    paymentMode === PAYMENT_MODES.FULL_PAYMENT &&
    fullPaymentPromotionEnabled &&
    fullPaymentFreeDeliveryEnabled;
  const isStandardPayment = !isInstallmentPayment && !isFullPaymentSelected;

  const items = cart.items || [];
  const hasPickupOnlyProducts = useMemo(
    () =>
      items.some(
        (item) => item?.product?.deliveryAvailable === false && item?.product?.pickupAvailable !== false
      ),
    [items]
  );
  const isInstallmentProductEligible = useMemo(() => {
    if (items.length !== 1) return false;
    const product = items[0]?.product;
    if (!product?.installmentEnabled) return false;
    const start = product.installmentStartDate ? new Date(product.installmentStartDate) : null;
    const end = product.installmentEndDate ? new Date(product.installmentEndDate) : null;
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now >= start && now <= end;
  }, [items]);
  const installmentProduct = isInstallmentProductEligible ? items[0]?.product : null;
  const installmentMinAmount = Number(installmentProduct?.installmentMinAmount || 0);
  const installmentDuration = Number(installmentProduct?.installmentDuration || 0);
  const installmentRequiresGuarantor = Boolean(installmentProduct?.installmentRequireGuarantor);
  const installmentFirstPaymentAmount = useMemo(() => {
    if (!isInstallmentProductEligible) return 0;
    const subtotal = Number(totals.subtotal || 0);
    const minAmount = Math.max(0, Number(installmentMinAmount || 0));
    if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
    return Math.min(subtotal, minAmount);
  }, [isInstallmentProductEligible, totals.subtotal, installmentMinAmount]);
  const installmentRemainingAmount = Math.max(
    0,
    Number(totals.subtotal || 0) - installmentFirstPaymentAmount
  );
  const sellerGroups = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const seller = item?.product?.user || null;
      const rawSellerId = seller?._id;
      const sellerId = rawSellerId ? String(rawSellerId) : 'unknown';
      const sellerName = seller?.shopName || seller?.name || 'Vendeur';
      const sellerPhone = seller?.phone || item?.product?.contactPhone || '';
      if (!groups.has(sellerId)) {
        groups.set(sellerId, {
          sellerId,
          sellerName,
          sellerPhone,
          items: [],
          subtotal: 0
        });
      }
      const group = groups.get(sellerId);
      group.items.push(item);
      group.subtotal += Number(item?.lineTotal || 0);
    });
    return Array.from(groups.values());
  }, [items]);

  const selectedCity = useMemo(
    () => cities.find((entry) => String(entry?._id) === String(shippingAddress.cityId)) || null,
    [cities, shippingAddress.cityId]
  );
  const availableCommunes = useMemo(
    () =>
      communes.filter((entry) => {
        const entryCityId = entry?.cityId?._id || entry?.cityId;
        return String(entryCityId || '') === String(shippingAddress.cityId || '');
      }),
    [communes, shippingAddress.cityId]
  );
  const selectedCommune = useMemo(
    () =>
      availableCommunes.find((entry) => String(entry?._id) === String(shippingAddress.communeId)) ||
      null,
    [availableCommunes, shippingAddress.communeId]
  );

  const deliveryPreviewBySeller = useMemo(() => {
    const result = {};
    sellerGroups.forEach((group) => {
      if (deliveryMode !== 'DELIVERY') {
        result[group.sellerId] = { fee: 0, source: 'PICKUP' };
        return;
      }
      if (hasPickupOnlyProducts) {
        result[group.sellerId] = { fee: 0, source: 'PICKUP' };
        return;
      }
      const policy = String(selectedCommune?.deliveryPolicy || 'DEFAULT_RULE').toUpperCase();
      if (policy === 'FREE') {
        result[group.sellerId] = { fee: 0, source: 'COMMUNE_FREE' };
        return;
      }
      if (policy === 'FIXED_FEE') {
        result[group.sellerId] = {
          fee: Math.max(0, Number(selectedCommune?.fixedFee || 0)),
          source: 'COMMUNE_FIXED'
        };
        return;
      }
      const sellerHasFree = Boolean(group?.items?.[0]?.product?.user?.freeDeliveryEnabled);
      if (sellerHasFree) {
        result[group.sellerId] = { fee: 0, source: 'SHOP_FREE' };
        return;
      }
      const maxDeliveryFee = (group.items || []).reduce((max, item) => {
        const product = item?.product || {};
        if (normalizeBoolean(product.deliveryAvailable, true) === false) return max;
        if (normalizeBoolean(product.deliveryFeeEnabled, true) === false) return max;
        const fee = Math.max(0, Number(product.deliveryFee || 0));
        return fee > max ? fee : max;
      }, 0);
      result[group.sellerId] = { fee: maxDeliveryFee, source: 'PRODUCT_FEE' };
    });
    return result;
  }, [deliveryMode, hasPickupOnlyProducts, selectedCommune, sellerGroups]);

  const deliveryFeePreviewTotal = useMemo(
    () =>
      Object.values(deliveryPreviewBySeller).reduce((sum, entry) => sum + Number(entry?.fee || 0), 0),
    [deliveryPreviewBySeller]
  );
  const primaryDeliverySourcePreview = useMemo(() => {
    const entries = Object.values(deliveryPreviewBySeller);
    if (!entries.length) return 'PICKUP';
    if (entries.length === 1) return entries[0]?.source || 'PICKUP';
    if (entries.every((entry) => entry?.source === entries[0]?.source)) {
      return entries[0]?.source || 'PICKUP';
    }
    return 'PRODUCT_FEE';
  }, [deliveryPreviewBySeller]);

  const getSellerPromoState = (sellerId) =>
    promoStates[sellerId] || { status: 'idle', message: '', code: '', pricing: null, promo: null };

  const isPromoAppliedForSeller = (sellerId) => {
    const state = getSellerPromoState(sellerId);
    const typedCode = String(payments[sellerId]?.promoCode || '').trim().toUpperCase();
    return state.status === 'valid' && Boolean(typedCode) && typedCode === state.code;
  };

  const getSellerEffectiveSubtotal = (group) => {
    if (isInstallmentPayment) return Number(group.subtotal || 0);
    if (!isPromoAppliedForSeller(group.sellerId)) return Number(group.subtotal || 0);
    const finalAmount = Number(getSellerPromoState(group.sellerId)?.pricing?.finalAmount);
    return Number.isFinite(finalAmount) ? finalAmount : Number(group.subtotal || 0);
  };

  const checkoutSubtotal = useMemo(() => {
    if (isInstallmentPayment) return Number(totals.subtotal || 0);
    return sellerGroups.reduce((sum, group) => sum + getSellerEffectiveSubtotal(group), 0);
  }, [isInstallmentPayment, totals.subtotal, sellerGroups, promoStates, payments]);

  const checkoutSavings = useMemo(() => {
    if (isInstallmentPayment) return 0;
    return sellerGroups.reduce((sum, group) => {
      const original = Number(group.subtotal || 0);
      const effective = getSellerEffectiveSubtotal(group);
      return sum + Math.max(0, original - effective);
    }, 0);
  }, [isInstallmentPayment, sellerGroups, promoStates, payments]);

  const effectiveDeliveryFeePreviewTotal = useMemo(() => {
    if (deliveryMode !== 'DELIVERY') return 0;
    if (isFullPaymentSelected) return 0;
    return Number(deliveryFeePreviewTotal || 0);
  }, [deliveryMode, isFullPaymentSelected, deliveryFeePreviewTotal]);

  const checkoutTotalWithDelivery = useMemo(
    () =>
      Number(
        (
          Number(checkoutSubtotal || 0) +
          (!isInstallmentPayment && deliveryMode === 'DELIVERY'
            ? Number(effectiveDeliveryFeePreviewTotal || 0)
            : 0)
        ).toFixed(2)
      ),
    [checkoutSubtotal, isInstallmentPayment, deliveryMode, effectiveDeliveryFeePreviewTotal]
  );
  const depositAmount = useMemo(() => Math.round(checkoutTotalWithDelivery * 0.25), [checkoutTotalWithDelivery]);
  const remainingAmount = Math.max(0, Number(checkoutTotalWithDelivery || 0) - depositAmount);
  const summaryPaidAmount = isInstallmentPayment
    ? installmentFirstPaymentAmount
    : isFullPaymentSelected
      ? checkoutTotalWithDelivery
      : depositAmount;
  const summaryRemainingAmount =
    isInstallmentPayment
      ? Math.max(0, Number(totals.subtotal || 0) - installmentFirstPaymentAmount)
      : isFullPaymentSelected
        ? 0
        : remainingAmount;
  const summaryOrderTotal = isInstallmentPayment
    ? Number(totals.subtotal || 0)
    : Number(checkoutTotalWithDelivery || 0);
  const summaryPrimaryPaymentLabel = isInstallmentPayment
    ? 'Premier paiement'
    : isFullPaymentSelected
      ? 'Paiement intégral'
      : 'Acompte (25%)';
  const paymentModeDescription = isInstallmentPayment
    ? 'Cette commande sera traitée en paiement par tranche après validation du vendeur.'
    : isFullPaymentSelected
      ? 'Vous payez le montant total maintenant. Les frais de livraison sont offerts.'
      : 'Un acompte de 25% est requis pour confirmer votre commande.';
  const paymentCommitmentMessage = isInstallmentPayment
    ? `Merci de payer le premier montant de ${formatCurrency(summaryPaidAmount)} puis de suivre l’échéancier.`
    : isFullPaymentSelected
      ? `Paiement intégral demandé: ${formatCurrency(summaryPaidAmount)}. La livraison est offerte et verrouillée.`
      : sellerGroups.length > 1
        ? 'Merci de payer l’acompte indiqué pour chaque vendeur avant validation.'
        : `Merci de payer exactement ${formatCurrency(depositAmount)} avant validation.`;
  const showFullPaymentOption = fullPaymentPromotionEnabled && fullPaymentFreeDeliveryEnabled;

  useEffect(() => {
    if (!isInstallmentProductEligible && paymentMode === PAYMENT_MODES.INSTALLMENT) {
      setPaymentMode(PAYMENT_MODES.STANDARD);
    }
  }, [isInstallmentProductEligible, paymentMode]);

  useEffect(() => {
    if (
      paymentMode === PAYMENT_MODES.FULL_PAYMENT &&
      (!fullPaymentPromotionEnabled || !fullPaymentFreeDeliveryEnabled)
    ) {
      setPaymentMode(PAYMENT_MODES.STANDARD);
    }
  }, [paymentMode, fullPaymentPromotionEnabled, fullPaymentFreeDeliveryEnabled]);

  useEffect(() => {
    if (hasPickupOnlyProducts && deliveryMode === 'DELIVERY') {
      setDeliveryMode('PICKUP');
    }
  }, [hasPickupOnlyProducts, deliveryMode]);

  useEffect(() => {
    setShippingAddress((prev) => ({
      ...prev,
      phone: prev.phone || user?.phone || '',
      addressLine: prev.addressLine || user?.address || ''
    }));
  }, [user?.address, user?.phone]);

  useEffect(() => {
    if (shippingAddress.cityId) return;
    const preferredCityName = user?.preferredCity || user?.city || '';
    const normalizedPreferredCity = normalizeText(preferredCityName);
    const matched = cities.find(
      (entry) => normalizeText(entry?.name || '') === normalizedPreferredCity
    );
    if (matched?._id) {
      setShippingAddress((prev) => ({ ...prev, cityId: String(matched._id) }));
    } else if (cities[0]?._id) {
      setShippingAddress((prev) => ({ ...prev, cityId: String(cities[0]._id) }));
    }
  }, [cities, shippingAddress.cityId, user?.preferredCity, user?.city]);

  useEffect(() => {
    if (!shippingAddress.cityId) return;
    const hasSelectedCommune = availableCommunes.some(
      (entry) => String(entry?._id) === String(shippingAddress.communeId)
    );
    if (!hasSelectedCommune) {
      const normalizedUserCommune = normalizeText(user?.commune || '');
      const preferredCommune = normalizedUserCommune
        ? availableCommunes.find(
            (entry) => normalizeText(entry?.name || '') === normalizedUserCommune
          )
        : null;
      const nextCommuneId = preferredCommune?._id
        ? String(preferredCommune._id)
        : availableCommunes[0]?._id
          ? String(availableCommunes[0]._id)
          : '';
      setShippingAddress((prev) => ({ ...prev, communeId: nextCommuneId }));
    }
  }, [availableCommunes, shippingAddress.cityId, shippingAddress.communeId, user?.commune]);

  useEffect(() => {
    setPayments((prev) => {
      const next = {};
      sellerGroups.forEach((group) => {
        const key = group.sellerId;
        const existing = prev[key] || {};
        next[key] = {
          payerName: existing.payerName ?? user?.name ?? '',
          transactionCode: existing.transactionCode ?? '',
          promoCode: existing.promoCode ?? ''
        };
      });
      return next;
    });
    setPromoStates((prev) => {
      const next = {};
      sellerGroups.forEach((group) => {
        const key = group.sellerId;
        next[key] = prev[key] || { status: 'idle', message: '', code: '', pricing: null, promo: null };
      });
      return next;
    });
  }, [sellerGroups, user?.name]);

  useEffect(() => {
    if (!isInstallmentProductEligible) {
      setInstallmentEligibility({ score: null, riskLevel: '' });
      return;
    }
    let active = true;
    api
      .get('/orders/installment/eligibility')
      .then(({ data }) => {
        if (!active) return;
        setInstallmentEligibility({
          score: Number(data?.score ?? 0),
          riskLevel: data?.riskLevel || 'medium'
        });
      })
      .catch(() => {
        if (!active) return;
        setInstallmentEligibility({ score: null, riskLevel: '' });
      });
    return () => {
      active = false;
    };
  }, [isInstallmentProductEligible]);

  const reconcileCheckoutAfterTimeout = async ({
    transactionCodes = [],
    expectedCount = 1,
    paymentType = ''
  } = {}) => {
    const normalizedCodes = Array.from(
      new Set(
        (Array.isArray(transactionCodes) ? transactionCodes : [])
          .map((code) => String(code || '').replace(/\D/g, '').trim())
          .filter((code) => code.length === 10)
      )
    );
    if (!normalizedCodes.length) {
      return {
        confirmed: false,
        matchedCount: 0,
        expectedCount: Math.max(1, Number(expectedCount || 1)),
        orderId: ''
      };
    }

    try {
      const { data } = await api.get('/orders', {
        params: { page: 1, limit: 40 },
        skipCache: true,
        skipDedupe: true,
        timeout: 15_000,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' }
      });
      const orders = Array.isArray(data) ? data : data?.items || [];
      const now = Date.now();
      const cutoffMs = 20 * 60 * 1000;
      const matchedCodes = new Set();
      let orderId = '';

      const recentOrders = orders
        .filter((order) => {
          const createdAtMs = new Date(order?.createdAt || 0).getTime();
          if (!Number.isFinite(createdAtMs) || now - createdAtMs > cutoffMs) return false;
          if (paymentType && String(order?.paymentType || '') !== String(paymentType)) return false;
          return true;
        })
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

      recentOrders.forEach((order) => {
        const createdAtMs = new Date(order?.createdAt || 0).getTime();
        if (!Number.isFinite(createdAtMs) || now - createdAtMs > cutoffMs) return;
        const orderCode = String(order?.paymentTransactionCode || '').replace(/\D/g, '').trim();
        if (orderCode && normalizedCodes.includes(orderCode)) {
          matchedCodes.add(orderCode);
          if (!orderId) {
            orderId = getOrderId(order);
          }
        }
      });

      const expected = Math.max(1, Number(expectedCount || normalizedCodes.length || 1));
      return {
        confirmed: matchedCodes.size >= Math.min(expected, normalizedCodes.length),
        matchedCount: matchedCodes.size,
        expectedCount: expected,
        orderId
      };
    } catch {
      return {
        confirmed: false,
        matchedCount: 0,
        expectedCount: Math.max(1, Number(expectedCount || normalizedCodes.length || 1)),
        orderId: ''
      };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!items.length) {
      setError('Votre panier est vide.');
      return;
    }
    if (deliveryMode === 'DELIVERY' && hasPickupOnlyProducts) {
      setError('Le mode livraison est indisponible car votre panier contient un produit retrait boutique uniquement.');
      return;
    }
    if (deliveryMode === 'DELIVERY') {
      if (!shippingAddress.cityId || !shippingAddress.communeId) {
        setError('Sélectionnez la ville et la commune de livraison.');
        return;
      }
      if (!shippingAddress.addressLine?.trim()) {
        setError('Renseignez une adresse de livraison.');
        return;
      }
      if (!shippingAddress.phone?.trim()) {
        setError('Renseignez le numéro de téléphone pour la livraison.');
        return;
      }
    }
    if (isInstallmentPayment) {
      if (!isInstallmentProductEligible || !installmentProduct) {
        setError('Le paiement par tranche n’est pas disponible pour cette commande.');
        return;
      }
      const installmentSeller = sellerGroups[0];
      const paymentEntry = installmentSeller ? payments[installmentSeller.sellerId] || {} : {};
      const firstAmount = Number(installmentFirstPaymentAmount || 0);
      if (!Number.isFinite(firstAmount) || firstAmount < installmentMinAmount) {
        setError(`Le premier paiement minimum est de ${formatCurrency(installmentMinAmount)}.`);
        return;
      }
      if (firstAmount > Number(totals.subtotal || 0)) {
        setError('Le premier paiement ne peut pas dépasser le total de la commande.');
        return;
      }
      if (!paymentEntry?.payerName?.trim() || !paymentEntry?.transactionCode?.trim()) {
        setError('Le nom du payeur et le code de transaction sont requis.');
        return;
      }
      const cleanTransactionCode = String(paymentEntry.transactionCode).replace(/\D/g, '');
      if (cleanTransactionCode.length !== 10) {
        setError('Le code de transaction doit contenir exactement 10 chiffres.');
        return;
      }
      try {
        const installmentCodeVerification = await verifyTransactionCodeAvailability(cleanTransactionCode);
        if (!installmentCodeVerification.available) {
          const message =
            installmentCodeVerification.message || 'Ce code de transaction est déjà utilisé.';
          setError(message);
          showToast(message, { variant: 'error' });
          return;
        }
      } catch (verificationError) {
        const message =
          verificationError?.response?.data?.message ||
          'Impossible de vérifier le code de transaction.';
        setError(message);
        showToast(message, { variant: 'error' });
        return;
      }
      if (
        installmentRequiresGuarantor &&
        (!guarantor.fullName || !guarantor.phone || !guarantor.relation || !guarantor.address)
      ) {
        setError('Les informations du garant sont requises pour ce produit.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { data } = await api.post(
          '/orders/installment/checkout',
          {
            productId: installmentProduct._id,
            quantity: Number(items[0]?.quantity || 1),
            firstPaymentAmount: Number(firstAmount),
            payerName: paymentEntry.payerName.trim(),
            transactionCode: cleanTransactionCode,
            guarantor,
            deliveryMode,
            shippingAddress
          }
        );
        const createdOrderId = extractFirstOrderId(data);
        setOrderConfirmed(true);
        await clearCart();
        showToast('Commande en tranche créée. En attente de validation vendeur.', { variant: 'success' });
        if (createdOrderId) {
          navigate(`/order/detail/${createdOrderId}`);
        } else {
          navigate('/orders');
        }
      } catch (err) {
        if (isApiTimeoutError(err)) {
          const reconciliation = await reconcileCheckoutAfterTimeout({
            transactionCodes: [cleanTransactionCode],
            expectedCount: 1,
            paymentType: 'installment'
          });
          if (reconciliation.confirmed) {
            setOrderConfirmed(true);
            await clearCart();
            showToast('Commande confirmée (vérification automatique après délai réseau).', {
              variant: 'success'
            });
            if (reconciliation.orderId) {
              navigate(`/order/detail/${reconciliation.orderId}`);
            } else {
              navigate('/orders');
            }
            return;
          }
          const timeoutMessage =
            'Réseau lent. Vérifiez vos commandes: la confirmation peut déjà être enregistrée.';
          setError(timeoutMessage);
          showToast(timeoutMessage, { variant: 'warning' });
          navigate('/orders');
          return;
        }
        const message = err.response?.data?.message || 'Impossible de créer la commande en tranche.';
        setError(message);
        showToast(message, { variant: 'error' });
      } finally {
        setLoading(false);
      }
      return;
    }

    const invalidSeller = sellerGroups.some(
      (group) => !group.sellerId || group.sellerId === 'unknown'
    );
    if (invalidSeller) {
      setError('Impossible de déterminer le vendeur pour certains articles.');
      return;
    }
    const missingPayment = sellerGroups.some((group) => {
      const entry = payments[group.sellerId] || {};
      return !entry.payerName?.trim() || !entry.transactionCode?.trim();
    });
    if (missingPayment) {
      setError(
        sellerGroups.length > 1
          ? 'Veuillez renseigner le nom et le code de transaction pour chaque vendeur.'
          : 'Veuillez renseigner le nom et le code de transaction.'
      );
      return;
    }
    const invalidTransactionCode = sellerGroups.some((group) => {
      const entry = payments[group.sellerId] || {};
      const code = (entry.transactionCode || '').trim().replace(/\D/g, '');
      return code.length !== 10;
    });
    if (invalidTransactionCode) {
      setError('Le code de transaction doit contenir exactement 10 chiffres.');
      return;
    }
    const normalizedTransactionCodes = sellerGroups.map((group) =>
      String(payments[group.sellerId]?.transactionCode || '')
        .trim()
        .replace(/\D/g, '')
    );
    if (new Set(normalizedTransactionCodes).size !== normalizedTransactionCodes.length) {
      setError('Chaque vendeur doit avoir un code transaction unique.');
      return;
    }
    try {
      const transactionChecks = await Promise.all(
        normalizedTransactionCodes.map((code) => verifyTransactionCodeAvailability(code))
      );
      const invalidCode = transactionChecks.find((result) => !result.available);
      if (invalidCode) {
        const message = invalidCode.message || 'Ce code de transaction est déjà utilisé.';
        setError(message);
        showToast(message, { variant: 'error' });
        return;
      }
    } catch (verificationError) {
      const message =
        verificationError?.response?.data?.message ||
        'Impossible de vérifier les codes de transaction.';
      setError(message);
      showToast(message, { variant: 'error' });
      return;
    }
    const hasUnvalidatedPromo = sellerGroups.some((group) => {
      const entry = payments[group.sellerId] || {};
      const typedCode = String(entry.promoCode || '').trim().toUpperCase();
      if (!typedCode) return false;
      return !isPromoAppliedForSeller(group.sellerId);
    });
    if (hasUnvalidatedPromo) {
      setError('Veuillez appliquer/valider chaque code promo saisi avant de confirmer.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(
        '/orders/checkout',
        {
          paymentMode: isFullPaymentSelected ? 'FULL_PAYMENT' : 'STANDARD',
          checkoutPromotionApplied: isFullPaymentSelected,
          deliveryMode,
          shippingAddress,
          payments: sellerGroups.map((group) => {
            const entry = payments[group.sellerId] || {};
            const normalizedPromoCode = String(entry.promoCode || '').trim().toUpperCase();
            const promoCode = isPromoAppliedForSeller(group.sellerId) ? normalizedPromoCode : '';
            return {
              sellerId: group.sellerId,
              payerName: entry.payerName.trim(),
              transactionCode: entry.transactionCode.trim().replace(/\D/g, ''),
              promoCode
            };
          })
        }
      );
      const createdOrderId = extractFirstOrderId(data);
      setOrderConfirmed(true);
      await clearCart();
      showToast(
        isFullPaymentSelected
          ? 'Commande payée intégralement. Livraison offerte activée.'
          : 'Commande enregistrée. Elle est en attente de validation.',
        { variant: 'success' }
      );
      if (createdOrderId) {
        navigate(`/order/detail/${createdOrderId}`);
      } else {
        navigate('/orders');
      }
    } catch (err) {
      if (isApiTimeoutError(err)) {
        const reconciliation = await reconcileCheckoutAfterTimeout({
          transactionCodes: normalizedTransactionCodes,
          expectedCount: sellerGroups.length || normalizedTransactionCodes.length || 1
        });
        if (reconciliation.confirmed) {
          setOrderConfirmed(true);
          await clearCart();
          showToast('Commande confirmée (vérification automatique après délai réseau).', {
            variant: 'success'
          });
          if (reconciliation.orderId) {
            navigate(`/order/detail/${reconciliation.orderId}`);
          } else {
            navigate('/orders');
          }
          return;
        }
        const timeoutMessage =
          'Réseau lent. Vérifiez vos commandes: la confirmation peut déjà être enregistrée.';
        setError(timeoutMessage);
        showToast(timeoutMessage, { variant: 'warning' });
        navigate('/orders');
        return;
      }
      const message = err.response?.data?.message || 'Impossible de confirmer la commande.';
      setError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentChange = (sellerId, field, value) => {
    if (field === 'transactionCode') {
      value = String(value).replace(/\D/g, '').slice(0, 10);
    }
    if (field === 'promoCode') {
      value = String(value || '').toUpperCase();
    }
    setPayments((prev) => ({
      ...prev,
      [sellerId]: {
        ...(prev[sellerId] || {}),
        [field]: value
      }
    }));
    if (field === 'promoCode') {
      const normalized = String(value || '').trim().toUpperCase();
      setPromoStates((prev) => {
        const current = prev[sellerId] || { status: 'idle', message: '', code: '', pricing: null, promo: null };
        if (!normalized) {
          return {
            ...prev,
            [sellerId]: { status: 'idle', message: '', code: '', pricing: null, promo: null }
          };
        }
        if (current.code && current.code !== normalized) {
          return {
            ...prev,
            [sellerId]: {
              status: 'idle',
              message: 'Code modifié, cliquez sur "Appliquer".',
              code: '',
              pricing: null,
              promo: null
            }
          };
        }
        return prev;
      });
    }
  };

  const applyPromoCodeForSeller = async (group) => {
    const sellerId = group?.sellerId;
    if (!sellerId || sellerId === 'unknown') return;
    const entry = payments[sellerId] || {};
    const code = String(entry.promoCode || '').trim().toUpperCase();
    if (!code) {
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'error',
          message: 'Veuillez saisir un code promo.',
          code: '',
          pricing: null,
          promo: null
        }
      }));
      return;
    }

    const previewItems = (group.items || [])
      .map((item) => ({
        productId: item?.product?._id,
        quantity: Number(item?.quantity || 1)
      }))
      .filter((item) => Boolean(item.productId));

    if (!previewItems.length) {
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'error',
          message: 'Aucun produit valide pour ce vendeur.',
          code: '',
          pricing: null,
          promo: null
        }
      }));
      return;
    }

    setPromoLoadingBySeller((prev) => ({ ...prev, [sellerId]: true }));
    try {
      const { data } = await api.post('/marketplace-promo-codes/preview', {
        code,
        items: previewItems
      });
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'valid',
          message: data?.message || 'Code promo appliqué.',
          code,
          pricing: data?.pricing || null,
          promo: data?.promo || null
        }
      }));
      showToast('Code promo appliqué.', { variant: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || 'Code promo invalide ou expiré.';
      setPromoStates((prev) => ({
        ...prev,
        [sellerId]: {
          status: 'error',
          message,
          code: '',
          pricing: null,
          promo: null
        }
      }));
      showToast(message, { variant: 'error' });
    } finally {
      setPromoLoadingBySeller((prev) => ({ ...prev, [sellerId]: false }));
    }
  };

  // Load draft payments if available
  useEffect(() => {
    if (!user || !items.length) return;

    const loadDraftPayments = async () => {
      try {
        const { data } = await api.get('/orders/draft');
        if (data.items && data.items.length > 0) {
          // Restore payments from draft
          const draftPayments = {};
          data.items.forEach((draft) => {
            if (draft.draftPayments && draft.draftPayments.length > 0) {
              draft.draftPayments.forEach((payment) => {
                if (payment.sellerId) {
                  const code = (payment.transactionCode || '').replace(/\D/g, '').slice(0, 10);
                  draftPayments[String(payment.sellerId)] = {
                    payerName: payment.payerName || '',
                    transactionCode: code,
                    promoCode: String(payment.promoCode || '').toUpperCase()
                  };
                }
              });
            }
          });
          if (Object.keys(draftPayments).length > 0) {
            setPayments((prev) => ({ ...prev, ...draftPayments }));
          }
        }
      } catch (error) {
        // Silently fail - draft loading is optional
        console.error('Failed to load draft payments:', error);
      }
    };

    loadDraftPayments();
  }, [user, items.length]);

  // Save draft order when user leaves without confirming
  useEffect(() => {
    if (!user || !items.length || loading || orderConfirmed || isInstallmentPayment) return;

    const saveDraft = async () => {
      try {
        const paymentsArray = sellerGroups.map((group) => {
          const entry = payments[group.sellerId] || {};
          return {
            sellerId: group.sellerId,
            payerName: entry.payerName?.trim() || '',
            transactionCode: entry.transactionCode?.trim() || '',
            promoCode: entry.promoCode?.trim()?.toUpperCase() || ''
          };
        });

        await api.post('/orders/draft', { payments: paymentsArray });
      } catch (error) {
        // Silently fail - don't interrupt user navigation
        console.error('Failed to save draft order:', error);
      }
    };

    // Save draft on component unmount (when user leaves)
    return () => {
      if (!orderConfirmed) {
        saveDraft();
      }
    };
  }, [user, items.length, sellerGroups, payments, loading, orderConfirmed, isInstallmentPayment]);

  if (!items.length) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mb-6 shadow-lg border border-neutral-200">
            <ClipboardList size={32} className="text-neutral-900" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">Votre panier est vide</h1>
          <p className="text-gray-600 font-medium mb-8">
            Ajoutez des produits avant de confirmer une commande.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-900 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <ShoppingBag size={18} />
            Explorer le marché
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header Enhanced */}
      <header className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-lg">
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="font-medium text-sm">Retour au panier</span>
        </Link>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900">Confirmer votre commande</h1>
          <p className="text-gray-600 font-medium">{paymentModeDescription}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 sm:gap-8">
        {/* Order Summary Enhanced */}
        <section className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Résumé de la commande</h2>
          </div>
          <div className="space-y-3">
            {items.map(({ product, quantity, lineTotal }) => (
              <div key={product._id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-200">
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/80'}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-sm sm:text-base line-clamp-2 mb-1">{product.title}</p>
                  <p className="text-xs text-gray-600 font-medium mb-1">Quantité: x{quantity}</p>
                  <p className="text-xs text-gray-500">
                    Vendeur: {product.user?.phone || product.contactPhone || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-black text-neutral-900 text-base sm:text-lg">
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-gray-200 pt-4 space-y-3">
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
              <span className="text-gray-700 font-semibold">Total commande</span>
              <span className="font-black text-gray-900 text-lg">
                {formatCurrency(summaryOrderTotal)}
              </span>
            </div>
            {!isInstallmentPayment && deliveryMode === 'DELIVERY' && (
              <div className="flex justify-between items-center py-2 px-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <span className="text-neutral-700 font-semibold">
                  Livraison ({DELIVERY_SOURCE_LABELS[primaryDeliverySourcePreview] || 'Source'})
                </span>
                <span className={`font-black text-lg ${isFullPaymentSelected ? 'text-emerald-700' : 'text-neutral-700'}`}>
                  {isFullPaymentSelected ? 'GRATUITE' : formatCurrency(effectiveDeliveryFeePreviewTotal)}
                </span>
              </div>
            )}
            {isFullPaymentSelected && (
              <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 font-semibold">Livraison offerte</span>
                <span className="font-black text-emerald-700 text-lg">0 FCFA</span>
              </div>
            )}
            {!isInstallmentPayment && checkoutSavings > 0 && (
              <div className="flex justify-between items-center py-2 px-3 bg-neutral-100 rounded-xl border border-neutral-200">
                <span className="text-neutral-700 font-semibold">Économie via promo</span>
                <span className="font-black text-neutral-700 text-lg">
                  -{formatCurrency(checkoutSavings)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 px-3 bg-neutral-100 rounded-xl border border-neutral-200">
              <span className="text-neutral-700 font-semibold">
                {summaryPrimaryPaymentLabel}
              </span>
              <span className="font-black text-neutral-900 text-lg">
                {formatCurrency(summaryPaidAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
              <span className="text-gray-700 font-semibold">Reste à payer</span>
              <span className="font-black text-gray-900 text-lg">
                {formatCurrency(summaryRemainingAmount)}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-100 p-4 text-xs sm:text-sm text-neutral-800 flex items-start gap-3">
            <ShieldCheck size={16} />
            <span>
              {isInstallmentPayment
                ? 'Le vendeur doit confirmer la vente puis valider chaque tranche.'
                : isFullPaymentSelected
                  ? 'Le paiement intégral confirme la commande. Les frais de livraison sont offerts et ne peuvent plus être ajoutés.'
                  : 'Le paiement de l’acompte confirme la commande. Le solde sera réglé à la livraison.'}
            </span>
          </div>
        </section>

        {/* Payment Form Enhanced */}
        <section className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center shadow-lg">
              <CreditCard size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Informations de paiement</h2>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="rounded-2xl border-2 border-gray-200 bg-gray-50/60 p-4 space-y-3">
              <p className="text-xs font-bold uppercase text-gray-700">Mode de livraison</p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('PICKUP')}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    deliveryMode === 'PICKUP'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Store size={14} className="inline mr-1" />
                  Passer récupérer
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode('DELIVERY')}
                  disabled={hasPickupOnlyProducts}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    deliveryMode === 'DELIVERY'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  } ${hasPickupOnlyProducts ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Truck size={14} className="inline mr-1" />
                  Se faire livrer
                </button>
              </div>
              {hasPickupOnlyProducts && (
                <p className="text-xs text-neutral-700 bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2">
                  Un ou plusieurs produits sont en retrait boutique uniquement.
                </p>
              )}
              {deliveryMode === 'DELIVERY' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Ville</label>
                    <select
                      value={shippingAddress.cityId || ''}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({
                          ...prev,
                          cityId: e.target.value,
                          communeId: ''
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Sélectionner une ville</option>
                      {cities.map((entry) => (
                        <option key={entry._id} value={entry._id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Commune</label>
                    <select
                      value={shippingAddress.communeId || ''}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({
                          ...prev,
                          communeId: e.target.value
                        }))
                      }
                      disabled={!shippingAddress.cityId}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      <option value="">Sélectionner une commune</option>
                      {availableCommunes.map((entry) => (
                        <option key={entry._id} value={entry._id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700">Adresse</label>
                    <input
                      type="text"
                      value={shippingAddress.addressLine}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({ ...prev, addressLine: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="Quartier, rue, repère"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700">Téléphone</label>
                    <input
                      type="tel"
                      value={shippingAddress.phone}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      placeholder="Ex: 06xxxxxxx"
                    />
                  </div>
                  <div className="md:col-span-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
                    <MapPin size={14} className="inline mr-1" />
                    {selectedCity?.name ? `${selectedCity.name} · ` : ''}
                    Livraison: {DELIVERY_SOURCE_LABELS[primaryDeliverySourcePreview] || 'Source en attente'} (
                    {isFullPaymentSelected ? 'GRATUITE' : formatCurrency(deliveryFeePreviewTotal)})
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                  Retrait boutique sélectionné. Aucun frais de livraison ne sera ajouté.
                </div>
              )}
            </div>

            {(isInstallmentProductEligible || showFullPaymentOption) && (
              <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-100 p-4 space-y-3">
                <p className="text-xs font-bold uppercase text-neutral-700">Mode de paiement</p>
                <div className={`grid gap-2 ${isInstallmentProductEligible && showFullPaymentOption ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  <button
                    type="button"
                    onClick={() => setPaymentMode(PAYMENT_MODES.STANDARD)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                      isStandardPayment
                        ? 'border-neutral-500 bg-white text-neutral-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <span className="block font-bold text-gray-900">Paiement classique</span>
                    <span className="mt-1 block text-xs text-gray-500">Acompte de 25% maintenant, solde plus tard.</span>
                  </button>
                  {showFullPaymentOption ? (
                    <button
                      type="button"
                      onClick={() => setPaymentMode(PAYMENT_MODES.FULL_PAYMENT)}
                      className={`relative rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                        isFullPaymentSelected
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm'
                          : 'border-emerald-200 bg-white text-gray-700'
                      }`}
                    >
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                        {fullPaymentLabelText}
                      </span>
                      <span className="block pr-20 font-bold text-gray-900">Paiement intégral</span>
                      <span className="mt-1 block text-xs text-gray-600">
                        Vous payez tout maintenant. Livraison offerte.
                      </span>
                      {deliveryMode === 'DELIVERY' && Number(deliveryFeePreviewTotal || 0) > 0 ? (
                        <span className="mt-2 inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          Économisez {formatCurrency(deliveryFeePreviewTotal)} sur la livraison
                        </span>
                      ) : (
                        <span className="mt-2 inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          Livraison gratuite activée
                        </span>
                      )}
                    </button>
                  ) : null}
                  {isInstallmentProductEligible ? (
                    <button
                      type="button"
                      onClick={() => setPaymentMode(PAYMENT_MODES.INSTALLMENT)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                        isInstallmentPayment
                          ? 'border-neutral-500 bg-white text-neutral-700 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      <span className="block font-bold text-gray-900">Paiement par tranche</span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {installmentDuration} jours avec échéancier validé par le vendeur.
                      </span>
                    </button>
                  ) : null}
                </div>
                {showFullPaymentOption && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <p className="font-semibold">Vous payez le montant total maintenant. Les frais de livraison sont offerts.</p>
                    <p className="mt-1">Sous-total: {formatCurrency(checkoutSubtotal)} · Livraison: GRATUITE · Total: {formatCurrency(checkoutSubtotal)}</p>
                  </div>
                )}
                {isInstallmentProductEligible && (
                  <p className="text-xs text-neutral-700">
                    Paiement en plusieurs fois disponible
                  </p>
                )}
                {installmentEligibility.score !== null && (
                  <p className="text-xs text-neutral-700">
                    Score d'éligibilité: <span className="font-semibold">{installmentEligibility.score}/100</span>{' '}
                    ({installmentEligibility.riskLevel || 'medium'})
                  </p>
                )}
              </div>
            )}

            {sellerGroups.map((group) => {
              const payment = payments[group.sellerId] || {};
              const promoState = getSellerPromoState(group.sellerId);
              const groupEffectiveSubtotal = getSellerEffectiveSubtotal(group);
              const groupDeliveryFee =
                !isInstallmentPayment && deliveryMode === 'DELIVERY'
                  ? isFullPaymentSelected
                    ? 0
                    : Number(deliveryPreviewBySeller[group.sellerId]?.fee || 0)
                  : 0;
              const groupTotalWithDelivery = Number(groupEffectiveSubtotal || 0) + groupDeliveryFee;
              const groupDeposit = isInstallmentPayment
                ? installmentFirstPaymentAmount
                : isFullPaymentSelected
                  ? Number(groupTotalWithDelivery || 0)
                  : Math.round(Number(groupTotalWithDelivery || 0) * 0.25);
              const groupRemaining = Math.max(0, Number(groupTotalWithDelivery || 0) - groupDeposit);
              return (
                <div
                  key={group.sellerId}
                  className="rounded-2xl border-2 border-gray-200 bg-neutral-50 p-4 sm:p-6 space-y-4 shadow-md"
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-gray-200">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase text-gray-500 tracking-wide">Paiement vendeur</p>
                      <p className="text-base sm:text-lg font-black text-gray-900">{group.sellerName}</p>
                      {group.sellerPhone && (
                        <p className="text-xs text-gray-600 font-medium">📞 {group.sellerPhone}</p>
                      )}
                    </div>
                    <div className="text-right bg-neutral-100 px-3 py-2 rounded-xl border border-neutral-200">
                      <p className="text-base sm:text-lg font-black text-neutral-900">
                        {formatCurrency(groupDeposit)}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">
                        {isInstallmentPayment ? 'Premier paiement' : isFullPaymentSelected ? 'Paiement intégral' : 'Acompte (25%)'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                        Nom du payeur
                      </label>
                      <input
                        type="text"
                        value={payment.payerName || ''}
                        onChange={(e) =>
                          handlePaymentChange(group.sellerId, 'payerName', e.target.value)
                        }
                        className="w-full rounded-2xl border-2 border-gray-300 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all bg-white"
                        placeholder={user?.name || 'Ex: Jean K.'}
                      />
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-100/50 p-3 overflow-hidden">
                      <p className="text-xs font-bold uppercase text-neutral-800 mb-2">Exemple : où trouver l'ID dans le SMS</p>
                      <img
                        src="/images/transaction-id-sms-example-checkout.png"
                        alt="Exemple de SMS Mobile Money montrant l'ID de la transaction (ex: 7232173826)"
                        className="w-full max-w-sm mx-auto rounded-lg border border-gray-200 bg-white shadow-sm object-contain"
                      />
                      <p className="text-xs text-neutral-700 mt-2 text-center">
                        Saisissez le numéro indiqué à côté de «&nbsp;ID&nbsp;» ou «&nbsp;ID de la transaction&nbsp;» dans le SMS de confirmation.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                        Code transaction
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border-2 border-gray-300 px-4 py-3 bg-white focus-within:ring-2 focus-within:ring-neutral-500 focus-within:border-neutral-500 transition-all">
                        <CreditCard size={18} className="text-gray-400 flex-shrink-0" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={payment.transactionCode || ''}
                          onChange={(e) =>
                            handlePaymentChange(group.sellerId, 'transactionCode', e.target.value)
                          }
                          className="w-full border-none p-0 text-sm font-medium focus:outline-none"
                          placeholder="10 chiffres (ex: 7232173826)"
                          title="ID de la transaction : 10 chiffres reçus par SMS"
                        />
                      </div>
                    </div>

                    {!isInstallmentPayment && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase text-gray-700">
                          Code promo vendeur
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 rounded-2xl border-2 border-gray-300 px-3 py-2.5 bg-white flex-1">
                            <Tag size={16} className="text-gray-400 flex-shrink-0" />
                            <input
                              type="text"
                              value={payment.promoCode || ''}
                              onChange={(e) =>
                                handlePaymentChange(group.sellerId, 'promoCode', e.target.value)
                              }
                              className="w-full border-none p-0 text-sm font-medium focus:outline-none uppercase"
                              placeholder="Ex: WELCOME20"
                              maxLength={40}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => applyPromoCodeForSeller(group)}
                            disabled={Boolean(promoLoadingBySeller[group.sellerId]) || !String(payment.promoCode || '').trim()}
                            className="rounded-2xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                          >
                            {promoLoadingBySeller[group.sellerId] ? 'Validation...' : 'Appliquer'}
                          </button>
                        </div>
                        {(promoState.message || promoState.status === 'valid') && (
                          <div
                            className={`rounded-xl border px-3 py-2 text-xs ${
                              promoState.status === 'valid'
                                ? 'border-neutral-200 bg-neutral-100 text-neutral-700'
                                : promoState.status === 'error'
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-gray-50 text-gray-600'
                            }`}
                          >
                            <p className="font-semibold">{promoState.message || 'Code prêt à être appliqué.'}</p>
                            {promoState.status === 'valid' && promoState.pricing && (
                              <p className="mt-1">
                                Nouveau total vendeur: {formatCurrency(promoState.pricing.finalAmount)}
                                {' · '}Économie: {formatCurrency(promoState.pricing.discountAmount)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isInstallmentPayment && (
                      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-100 p-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-neutral-700 mb-2">
                            Premier paiement fixe ({formatCurrency(installmentMinAmount)})
                          </label>
                          <input
                            type="number"
                            min={installmentMinAmount || 1}
                            max={Number(group.subtotal || 0)}
                            value={installmentFirstPaymentAmount}
                            readOnly
                            disabled
                            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
                          />
                          <p className="mt-1 text-xs text-neutral-700">
                            Reste estimé: {formatCurrency(installmentRemainingAmount)}
                          </p>
                        </div>

                        {installmentRequiresGuarantor && (
                          <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3">
                            <p className="text-xs font-bold uppercase text-neutral-700">Informations garant</p>
                            <input
                              type="text"
                              placeholder="Nom complet"
                              value={guarantor.fullName}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, fullName: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Téléphone"
                              value={guarantor.phone}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, phone: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Relation avec le client"
                              value={guarantor.relation}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, relation: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Pièce d'identité (optionnel)"
                              value={guarantor.nationalId}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, nationalId: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Adresse"
                              value={guarantor.address}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, address: e.target.value }))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-100 px-4 py-3 space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-semibold">Sous-total vendeur</span>
                      <span className="font-black text-gray-900">
                        {formatCurrency(groupEffectiveSubtotal)}
                      </span>
                    </div>
                    {!isInstallmentPayment && deliveryMode === 'DELIVERY' && (
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-700 font-semibold">
                          Livraison ({DELIVERY_SOURCE_LABELS[deliveryPreviewBySeller[group.sellerId]?.source] || 'Source'})
                        </span>
                        <span className={`font-black ${isFullPaymentSelected ? 'text-emerald-700' : 'text-neutral-700'}`}>
                          {isFullPaymentSelected ? 'GRATUITE' : formatCurrency(groupDeliveryFee)}
                        </span>
                      </div>
                    )}
                    {!isInstallmentPayment && groupEffectiveSubtotal < Number(group.subtotal || 0) && (
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-700 font-semibold">Économie promo</span>
                        <span className="font-black text-neutral-700">
                          -{formatCurrency(Number(group.subtotal || 0) - groupEffectiveSubtotal)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-700 font-semibold">
                        {isInstallmentPayment ? 'Premier paiement' : isFullPaymentSelected ? 'Paiement intégral' : 'Acompte (25%)'}
                      </span>
                      <span className="font-black text-neutral-900">
                        {formatCurrency(groupDeposit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                      <span className="text-gray-700 font-semibold">Reste à payer</span>
                      <span className="font-black text-gray-900">
                        {formatCurrency(groupRemaining)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-100 px-4 py-3 text-xs sm:text-sm text-neutral-800 flex items-start gap-3">
              <CheckCircle size={18} className="text-neutral-700 flex-shrink-0 mt-0.5" />
              {paymentCommitmentMessage}
            </div>
            {error && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-semibold">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-6 py-4 text-sm sm:text-base font-semibold text-white hover:bg-neutral-900 disabled:opacity-60 transition-all duration-200 active:scale-95 shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isFullPaymentSelected ? 'Paiement intégral...' : 'Confirmation...'}
                </>
              ) : (
                <>
                  <Lock size={18} />
                  {isFullPaymentSelected ? 'Payer intégralement et confirmer' : 'Confirmer la commande'}
                </>
              )}
            </button>
          </form>
        </section>
      </div>
      </div>
    </div>
  );
}
