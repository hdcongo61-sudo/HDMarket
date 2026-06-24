import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import api, { isApiPossiblyCommittedError, isApiTimeoutError, verifyTransactionCodeAvailability } from '../services/api';
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
  MapPin,
  Wallet
} from 'lucide-react';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { useAppSettings } from '../context/AppSettingsContext';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';

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
  FULL_PAYMENT: 'full_payment',
  WALLET: 'wallet'
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
  const [checkoutStatus, setCheckoutStatus] = useState('');
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
  const isWalletPayment = paymentMode === PAYMENT_MODES.WALLET;
  const isStandardPayment = !isInstallmentPayment && !isFullPaymentSelected && !isWalletPayment;

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
      const sellerLogo = seller?.shopLogo || seller?.logo || seller?.avatar || '';
      const sellerIsShop = Boolean(seller?.shopName || seller?.accountType === 'shop');
      if (!groups.has(sellerId)) {
        groups.set(sellerId, {
          sellerId,
          sellerName,
          sellerPhone,
          sellerLogo,
          sellerIsShop,
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
    if (isFullPaymentSelected || isWalletPayment) return 0;
    return Number(deliveryFeePreviewTotal || 0);
  }, [deliveryMode, isFullPaymentSelected, isWalletPayment, deliveryFeePreviewTotal]);

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
  const depositAmount = useMemo(() => Math.round(checkoutSubtotal * 0.25), [checkoutSubtotal]);
  const remainingAmount = Math.max(0, Number(checkoutTotalWithDelivery || 0) - depositAmount);
  const summaryPaidAmount = isInstallmentPayment
    ? installmentFirstPaymentAmount
    : isFullPaymentSelected || isWalletPayment
      ? checkoutTotalWithDelivery
      : depositAmount;
  const summaryRemainingAmount =
    isInstallmentPayment
      ? Math.max(0, Number(totals.subtotal || 0) - installmentFirstPaymentAmount)
      : isFullPaymentSelected || isWalletPayment
        ? 0
        : remainingAmount;
  const summaryOrderTotal = isInstallmentPayment
    ? Number(totals.subtotal || 0)
    : Number(checkoutTotalWithDelivery || 0);
  const summaryPrimaryPaymentLabel = isInstallmentPayment
    ? 'Premier paiement'
    : isFullPaymentSelected
      ? 'Paiement intégral'
      : isWalletPayment
        ? 'Paiement portefeuille'
        : 'Acompte (25%)';
  const paymentModeDescription = isInstallmentPayment
    ? 'Cette commande sera traitée en paiement par tranche après validation du vendeur.'
    : isFullPaymentSelected
      ? 'Vous payez le montant total maintenant. Les frais de livraison sont offerts.'
      : isWalletPayment
        ? 'Aucun acompte ni code transaction requis. Le paiement est traité automatiquement.'
        : 'Un acompte de 25% est requis pour confirmer votre commande.';
  const paymentCommitmentMessage = isInstallmentPayment
    ? `Merci de payer le premier montant de ${formatCurrency(summaryPaidAmount)} puis de suivre l’échéancier.`
    : isFullPaymentSelected
      ? `Paiement intégral demandé: ${formatCurrency(summaryPaidAmount)}. La livraison est offerte et verrouillée.`
      : isWalletPayment
        ? 'Paiement portefeuille: aucun acompte à saisir. La validation se fait côté HDMarket.'
        : sellerGroups.length > 1
          ? 'Merci de payer l’acompte indiqué pour chaque vendeur avant validation.'
          : `Merci de payer exactement ${formatCurrency(depositAmount)} avant validation.`;
  const showFullPaymentOption = fullPaymentPromotionEnabled && fullPaymentFreeDeliveryEnabled;

  const paymentModeCards = useMemo(() => {
    const baseCards = [
      {
        id: PAYMENT_MODES.STANDARD,
        title: 'Paiement classique',
        subtitle: 'Acompte pour réserver, solde à régler plus tard.',
        eyebrow: 'Flexible',
        icon: CreditCard,
        amountLabel: 'À payer maintenant',
        amount: depositAmount,
        remainingLabel: 'Solde après validation',
        remaining: remainingAmount,
        tone: 'neutral',
        bullets: ['25% maintenant', 'Solde à la livraison', 'Validation admin']
      }
    ];

    if (showFullPaymentOption) {
      baseCards.push({
        id: PAYMENT_MODES.FULL_PAYMENT,
        title: 'Paiement intégral',
        subtitle: 'Tout payer maintenant pour verrouiller la commande.',
        eyebrow: fullPaymentLabelText,
        icon: ShieldCheck,
        amountLabel: 'Total à payer',
        amount: checkoutTotalWithDelivery,
        remainingLabel: 'Reste à payer',
        remaining: 0,
        tone: 'success',
        bullets: [
          'Livraison offerte',
          'Frais verrouillés',
          deliveryMode === 'DELIVERY' && Number(deliveryFeePreviewTotal || 0) > 0
            ? `Économie ${formatCurrency(deliveryFeePreviewTotal)}`
            : 'Traitement prioritaire'
        ].filter(Boolean)
      });
    }

    if (isInstallmentProductEligible) {
      baseCards.push({
        id: PAYMENT_MODES.INSTALLMENT,
        title: 'Paiement par tranche',
        subtitle: 'Premier versement, puis échéancier suivi.',
        eyebrow: `${installmentDuration || 0} jours`,
        icon: ClipboardList,
        amountLabel: 'Premier paiement',
        amount: installmentFirstPaymentAmount,
        remainingLabel: 'Reste échelonné',
        remaining: installmentRemainingAmount,
        tone: 'installment',
        bullets: [
          'Validation vendeur',
          'Suivi des tranches',
          installmentRequiresGuarantor ? 'Garant requis' : 'Garant selon profil'
        ]
      });
    }

    // Wallet payment — Proposal 6 (full payment, per-shop eligibility)
    const walletPaymentEnabled = normalizeBoolean(
      getRuntimeValue('enable_wallet_payment', false),
      false
    );
    const walletEnabledShopsStr = String(getRuntimeValue('wallet_enabled_shops', '') || '').trim();
    const walletEnabledPhones = walletEnabledShopsStr
      ? walletEnabledShopsStr.split(',').map((s) => s.trim()).filter(Boolean)
      : null; // null = all shops allowed
    const walletEligible = walletPaymentEnabled && (
      walletEnabledPhones === null ||
      walletEnabledPhones.length === 0 ||
      sellerGroups.every((g) => walletEnabledPhones.includes(String(g.sellerPhone || '').trim()))
    );

    if (walletEligible) {
      baseCards.push({
        id: PAYMENT_MODES.WALLET,
        title: 'Portefeuille HDMarket',
        subtitle: 'Aucun acompte à payer dans le checkout.',
        eyebrow: 'Auto',
        icon: Wallet,
        amountLabel: 'Acompte requis',
        amount: 0,
        amountDisplay: 'Aucun',
        remainingLabel: 'Code à saisir',
        remaining: 0,
        remainingDisplay: 'Aucun',
        tone: 'success',
        bullets: [
          'Aucun code transaction',
          'Aucun acompte frontend',
          'Validation côté HDMarket'
        ]
      });
    }

    return baseCards;
  }, [
    checkoutTotalWithDelivery,
    deliveryFeePreviewTotal,
    deliveryMode,
    depositAmount,
    fullPaymentLabelText,
    installmentDuration,
    installmentFirstPaymentAmount,
    installmentRemainingAmount,
    installmentRequiresGuarantor,
    isInstallmentProductEligible,
    remainingAmount,
    showFullPaymentOption,
    sellerGroups
  ]);

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
    paymentType = '',
    paymentSource = ''
  } = {}) => {
    const normalizedCodes = Array.from(
      new Set(
        (Array.isArray(transactionCodes) ? transactionCodes : [])
          .map((code) => String(code || '').replace(/\D/g, '').trim())
          .filter((code) => code.length === 10)
      )
    );
    const canMatchByWallet =
      String(paymentSource || '').toLowerCase() === 'wallet' || String(paymentType || '').toLowerCase() === 'full';
    if (!normalizedCodes.length && !canMatchByWallet) {
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
          if (paymentSource && String(order?.paymentSource || '') !== String(paymentSource)) return false;
          return true;
        })
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

      recentOrders.forEach((order) => {
        const createdAtMs = new Date(order?.createdAt || 0).getTime();
        if (!Number.isFinite(createdAtMs) || now - createdAtMs > cutoffMs) return;
        const sourceMatched =
          canMatchByWallet &&
          String(order?.paymentSource || '').toLowerCase() === 'wallet' &&
          ['paid', 'paid_full'].includes(String(order?.paymentStatus || '').toLowerCase());
        const orderCode = String(order?.paymentTransactionCode || '').replace(/\D/g, '').trim();
        if ((orderCode && normalizedCodes.includes(orderCode)) || sourceMatched) {
          if (orderCode) {
            matchedCodes.add(orderCode);
          }
          if (sourceMatched) {
            matchedCodes.add(`wallet:${getOrderId(order) || createdAtMs}`);
          }
          if (!orderId) {
            orderId = getOrderId(order);
          }
        }
      });

      const expected = Math.max(1, Number(expectedCount || normalizedCodes.length || 1));
      return {
        confirmed: matchedCodes.size >= Math.min(expected, normalizedCodes.length || expected),
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

  const clearCartAfterCheckout = () => {
    Promise.resolve()
      .then(() => clearCart())
      .catch(() => {
        // The order is already created; cart cleanup can be retried by the normal cart sync.
      });
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
            selectedAttributes: items[0]?.selectedAttributes || [],
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
            'Commande en cours de confirmation. Nous synchronisons automatiquement le statut.';
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
    // Payer name + transaction code validation — skipped for wallet
    if (!isWalletPayment) {
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
    setCheckoutStatus(
      isWalletPayment
        ? 'Validation du paiement portefeuille...'
        : isFullPaymentSelected
          ? 'Validation du paiement intégral...'
          : 'Confirmation de la commande...'
    );

    // Wallet payment — backend owns balance checks and deductions.
    if (paymentMode === PAYMENT_MODES.WALLET) {
      try {
        showToast('Paiement portefeuille en cours...', { variant: 'info' });
        const promoEntries = sellerGroups
          .map((group) => {
            const entry = payments[group.sellerId] || {};
            const normalizedPromoCode = String(entry.promoCode || '').trim().toUpperCase();
            const promoCode = isPromoAppliedForSeller(group.sellerId) ? normalizedPromoCode : '';
            return { sellerId: group.sellerId, promoCode };
          })
          .filter((pe) => pe.promoCode); // Only send entries with an actual promo code
        const { data } = await api.post('/orders/wallet-checkout', {
          items: items.map((item) => ({
            productId: item.product?._id || item.product,
            quantity: item.quantity,
            selectedAttributes: item.selectedAttributes || []
          })),
          deliveryMode,
          shippingAddress,
          promoEntries
        });
        const createdOrderId = extractFirstOrderId(data);
        setOrderConfirmed(true);
        setCheckoutStatus('Paiement confirmé. Redirection vers la commande...');
        showToast(data?.message || 'Commande payée via portefeuille HDMarket.', { variant: 'success' });
        clearCartAfterCheckout();
        if (createdOrderId) {
          navigate(`/order/detail/${createdOrderId}`, { replace: true });
        } else {
          navigate('/orders', { replace: true });
        }
      } catch (err) {
        if (isApiTimeoutError(err) || isApiPossiblyCommittedError(err)) {
          setCheckoutStatus('Vérification de la commande portefeuille...');
          const reconciliation = await reconcileCheckoutAfterTimeout({
            expectedCount: Math.max(1, sellerGroups.length || 1),
            paymentType: 'full',
            paymentSource: 'wallet'
          });
          if (reconciliation.confirmed) {
            setOrderConfirmed(true);
            setCheckoutStatus('Paiement confirmé. Redirection vers la commande...');
            showToast('Commande payée via portefeuille HDMarket.', { variant: 'success' });
            clearCartAfterCheckout();
            if (reconciliation.orderId) {
              navigate(`/order/detail/${reconciliation.orderId}`, { replace: true });
            } else {
              navigate('/orders', { replace: true });
            }
            return;
          }
          const timeoutMessage =
            'Paiement portefeuille en cours de confirmation. Nous ouvrons vos commandes.';
          setError(timeoutMessage);
          showToast(timeoutMessage, { variant: 'warning' });
          navigate('/orders', { replace: true });
          return;
        }
        const message = err.response?.data?.message || 'Impossible de finaliser le paiement portefeuille.';
        setError(message);
        setCheckoutStatus('');
        showToast(message, { variant: 'error' });
      } finally {
        setLoading(false);
      }
      return;
    }

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
        },
        {
          silentGlobalError: true
        }
      );
      const createdOrderId = extractFirstOrderId(data);
      setOrderConfirmed(true);
      await clearCart();
      setCheckoutStatus('');
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
      if (isApiPossiblyCommittedError(err)) {
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
          'Commande en cours de confirmation. Nous synchronisons automatiquement le statut.';
        setError(timeoutMessage);
        showToast(timeoutMessage, { variant: 'warning' });
        navigate('/orders');
        return;
      }
      const message = err.response?.data?.message || 'Impossible de confirmer la commande.';
      setError(message);
      setCheckoutStatus('');
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
      <div className="hd-order-flow hd-commerce-shell min-h-screen dark:bg-black flex items-center justify-center px-4 py-10">
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
    <div className="hd-order-flow hd-commerce-shell min-h-screen bg-[#f5f5f5] pb-28 dark:bg-black lg:pb-8">
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      {/* Header Enhanced */}
      <header className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/cart"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:border-gray-200 hover:bg-gray-100 hover:text-[#ff6a00]"
          >
            <ArrowLeft size={16} />
            <span>Retour panier</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wide">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[#ff6a00]">{totals.quantity} article{totals.quantity > 1 ? 's' : ''}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Paiement sécurisé</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Confirmer votre commande</h1>
            <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-600">{paymentModeDescription}</p>
          </div>
          <div className="hidden rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-right lg:block">
            <p className="text-[11px] font-black uppercase tracking-wide text-orange-800">À payer maintenant</p>
            <p className="text-2xl font-black text-[#ff6a00]">
              {isWalletPayment ? 'Automatique' : formatCurrency(summaryPaidAmount)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
        {/* Order Summary Enhanced */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white shadow-sm">
                <ShoppingBag size={19} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Résumé</h2>
                <p className="text-xs font-semibold text-slate-500">{items.length} ligne{items.length > 1 ? 's' : ''} dans le panier</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>
          <div className="max-h-none divide-y divide-slate-100 lg:max-h-[42vh] lg:overflow-y-auto">
            {items.map(({ product, quantity, lineTotal, selectedAttributes, selectionKey }) => (
              <div key={`${product._id}-${selectionKey || 'default'}`} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:p-5">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-[76px] sm:w-[76px]">
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/80'}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="mb-1 line-clamp-2 text-sm font-black leading-5 text-slate-950 sm:text-base">{product.title}</p>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">x{quantity}</span>
                    <span>{product.user?.shopName || product.user?.name || 'Boutique'}</span>
                  </div>
                  <SelectedAttributesList
                    selectedAttributes={selectedAttributes}
                    compact
                    className="mb-1"
                  />
                  <p className="text-xs text-gray-500">
                    Vendeur: {product.user?.phone || product.contactPhone || '—'}
                  </p>
                  <p className="mt-2 text-base font-black text-[#ff6a00] sm:hidden">
                    {formatCurrency(lineTotal)}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Total ligne</p>
                  <span className="mt-1 block text-lg font-black text-slate-950">
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3 border-t border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-5 py-4">
              <span className="text-base font-black text-slate-700">Total commande</span>
              <span className="text-2xl font-black text-slate-950">
                {formatCurrency(summaryOrderTotal)}
              </span>
            </div>
            {!isInstallmentPayment && deliveryMode === 'DELIVERY' && (
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <span className="text-base font-bold text-slate-600">
                  Livraison ({DELIVERY_SOURCE_LABELS[primaryDeliverySourcePreview] || 'Source'})
                </span>
                <span className={`text-lg font-black ${(isFullPaymentSelected || isWalletPayment) ? 'text-emerald-700' : 'text-neutral-700'}`}>
                  {(isFullPaymentSelected || isWalletPayment) ? 'GRATUITE' : formatCurrency(effectiveDeliveryFeePreviewTotal)}
                </span>
              </div>
            )}
            {(isFullPaymentSelected || isWalletPayment) && (
              <div className="flex items-center justify-between rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4">
                <span className="text-base font-black text-emerald-700">Livraison offerte</span>
                <span className="text-lg font-black text-emerald-700">0 FCFA</span>
              </div>
            )}
            {!isInstallmentPayment && checkoutSavings > 0 && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                <span className="text-base font-black text-emerald-700">Économie via promo</span>
                <span className="text-lg font-black text-emerald-700">
                  -{formatCurrency(checkoutSavings)}
                </span>
              </div>
            )}
            {!isWalletPayment && (
              <div className="flex items-center justify-between rounded-2xl border-2 border-gray-200 bg-gray-100 px-5 py-4">
                <span className="text-base font-black text-orange-800">
                  {summaryPrimaryPaymentLabel}
                </span>
                <span className="text-2xl font-black text-[#ff6a00]">
                  {formatCurrency(summaryPaidAmount)}
                </span>
              </div>
            )}
            {summaryRemainingAmount > 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-5 py-4">
                <span className="text-base font-bold text-slate-600">Reste à payer</span>
                <span className="text-lg font-black text-slate-950">
                  {formatCurrency(summaryRemainingAmount)}
                </span>
              </div>
            )}
          </div>
          <div className="mx-5 mb-5 flex items-start gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-800 sm:text-base">
            <ShieldCheck size={20} className="mt-0.5 flex-shrink-0" />
            <span>
              {isInstallmentPayment
                ? 'Le vendeur doit confirmer la vente puis valider chaque tranche.'
                : isFullPaymentSelected
                  ? 'Le paiement intégral confirme la commande. Les frais de livraison sont offerts et ne peuvent plus être ajoutés.'
                  : isWalletPayment
                    ? 'Aucun acompte ni code transaction requis. HDMarket traite le paiement automatiquement.'
                    : 'Le paiement de l’acompte confirme la commande. Le solde sera réglé à la livraison.'}
            </span>
          </div>
        </section>

        {/* Payment Form Enhanced */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-100 text-[#ff6a00]">
                <CreditCard size={19} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Paiement et livraison</h2>
                <p className="text-xs font-semibold text-slate-500">Complétez les informations nécessaires.</p>
              </div>
            </div>
          </div>
          
          <form id="order-checkout-form" className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-600">Mode de livraison</p>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 ring-1 ring-slate-200">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('PICKUP')}
                  className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition-all ${
                    deliveryMode === 'PICKUP'
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Store size={15} />
                  Retrait
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode('DELIVERY')}
                  disabled={hasPickupOnlyProducts}
                  className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition-all ${
                    deliveryMode === 'DELIVERY'
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  } ${hasPickupOnlyProducts ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Truck size={15} />
                  Livraison
                </button>
              </div>
              {hasPickupOnlyProducts && (
                <p className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Un ou plusieurs produits sont en retrait boutique uniquement.
                </p>
              )}
              {deliveryMode === 'DELIVERY' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Ville</label>
                    <select
                      value={shippingAddress.cityId || ''}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({
                          ...prev,
                          cityId: e.target.value,
                          communeId: ''
                        }))
                      }
                      className="min-h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#ff6a00] focus:ring-2 focus:ring-gray-200"
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
                    <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Commune</label>
                    <select
                      value={shippingAddress.communeId || ''}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({
                          ...prev,
                          communeId: e.target.value
                        }))
                      }
                      disabled={!shippingAddress.cityId}
                      className="min-h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition disabled:bg-slate-100 focus:border-[#ff6a00] focus:ring-2 focus:ring-gray-200"
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
                    <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Adresse</label>
                    <input
                      type="text"
                      value={shippingAddress.addressLine}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({ ...prev, addressLine: e.target.value }))
                      }
                      className="min-h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#ff6a00] focus:ring-2 focus:ring-gray-200"
                      placeholder="Quartier, rue, repère"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Téléphone</label>
                    <input
                      type="tel"
                      value={shippingAddress.phone}
                      onChange={(e) =>
                        setShippingAddress((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="min-h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#ff6a00] focus:ring-2 focus:ring-gray-200"
                      placeholder="Ex: 06xxxxxxx"
                    />
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                    <MapPin size={14} className="inline mr-1" />
                    {selectedCity?.name ? `${selectedCity.name} · ` : ''}
                    {DELIVERY_SOURCE_LABELS[primaryDeliverySourcePreview] || 'Source en attente'} · {(isFullPaymentSelected || isWalletPayment) ? 'GRATUITE' : formatCurrency(effectiveDeliveryFeePreviewTotal)}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-700">
                  Retrait boutique sélectionné. Aucun frais de livraison ne sera ajouté.
                </div>
              )}
            </div>

            {paymentModeCards.length > 1 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-[#ff6a00]">
                        Mode de paiement
                      </p>
                      <h3 className="mt-1 text-base font-black leading-tight text-slate-950">
                        Sélectionnez l'option la plus adaptée
                      </h3>
                    </div>
                    <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-white px-3 text-[11px] font-black text-slate-700 ring-1 ring-slate-200">
                      {paymentModeCards.length} option{paymentModeCards.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 p-3 sm:p-4">
                  {paymentModeCards.map((option) => {
                    const selected = paymentMode === option.id;
                    const Icon = option.icon;
                    const isSuccess = option.tone === 'success';
                    const isInstallment = option.tone === 'installment';
                    const toneClasses = isSuccess
                      ? {
                          card: selected
                            ? 'border-emerald-500 bg-emerald-50 shadow-[0_14px_30px_rgba(16,185,129,0.16)] ring-2 ring-emerald-100'
                            : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/35',
                          icon: selected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700',
                          badge: selected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700',
                          amount: 'text-emerald-700',
                          chip: 'bg-white text-emerald-700 ring-emerald-100'
                        }
                      : isInstallment
                        ? {
                            card: selected
                              ? 'border-amber-500 bg-amber-50 shadow-[0_14px_30px_rgba(245,158,11,0.16)] ring-2 ring-amber-100'
                              : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/35',
                            icon: selected ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700',
                            badge: selected ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700',
                            amount: 'text-amber-700',
                            chip: 'bg-white text-amber-700 ring-amber-100'
                          }
                        : {
                            card: selected
                              ? 'border-[#ff6a00] bg-gray-100 shadow-[0_14px_30px_rgba(255,106,0,0.16)] ring-2 ring-gray-200'
                              : 'border-slate-200 bg-white hover:border-gray-200 hover:bg-gray-100/35',
                            icon: selected ? 'bg-[#ff6a00] text-white' : 'bg-gray-100 text-[#ff6a00]',
                            badge: selected ? 'bg-[#ff6a00] text-white' : 'bg-gray-100 text-gray-500',
                            amount: 'text-gray-950',
                            chip: 'bg-white text-gray-500 ring-gray-200'
                          };

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPaymentMode(option.id)}
                        className={`group relative min-h-[188px] overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.985] sm:p-4 ${toneClasses.card}`}
                        aria-pressed={selected}
                      >
                        {selected && (
                          <span className="absolute right-0 top-0 rounded-bl-2xl bg-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white">
                            Sélectionné
                          </span>
                        )}

                        <div className="flex items-start gap-3 pr-16">
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${toneClasses.icon}`}>
                            <Icon size={19} />
                          </span>
                          <div className="min-w-0">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${toneClasses.badge}`}>
                              {option.eyebrow}
                            </span>
                            <h4 className="mt-2 text-[15px] font-black leading-tight text-slate-950 sm:text-base">{option.title}</h4>
                          </div>
                        </div>

                        <p className="mt-3 min-h-[36px] text-xs font-semibold leading-relaxed text-slate-600">
                          {option.subtitle}
                        </p>

                        <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                {option.amountLabel}
                              </p>
                              <p className={`mt-1 truncate text-lg font-black leading-none ${toneClasses.amount}`}>
                                {option.amountDisplay || formatCurrency(option.amount)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                {option.remainingLabel}
                              </p>
                              <p className="mt-1 max-w-[96px] truncate text-sm font-black text-slate-900 sm:max-w-[120px]">
                                {option.remainingDisplay || formatCurrency(option.remaining)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {option.bullets.map((item) => (
                            <span
                              key={`${option.id}-${item}`}
                              className={`rounded-full px-2 py-1 text-[10px] font-black ring-1 ${toneClasses.chip}`}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {showFullPaymentOption && (
                  <div className="mx-3 mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:mx-4 sm:mb-4">
                    <p className="font-semibold">Vous payez le montant total maintenant. Les frais de livraison sont offerts.</p>
                    <p className="mt-1">Sous-total: {formatCurrency(checkoutSubtotal)} · Livraison: GRATUITE · Total: {formatCurrency(checkoutSubtotal)}</p>
                  </div>
                )}
                {isInstallmentProductEligible && (
                  <p className="mx-3 mb-2 text-xs font-semibold text-slate-600 sm:mx-4">
                    Paiement en plusieurs fois disponible
                  </p>
                )}
                {installmentEligibility.score !== null && (
                  <p className="mx-3 mb-3 text-xs font-semibold text-slate-600 sm:mx-4 sm:mb-4">
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
                  ? (isFullPaymentSelected || isWalletPayment)
                    ? 0
                    : Number(deliveryPreviewBySeller[group.sellerId]?.fee || 0)
                  : 0;
              const groupTotalWithDelivery = Number(groupEffectiveSubtotal || 0) + groupDeliveryFee;
              const groupDeposit = isInstallmentPayment
                ? installmentFirstPaymentAmount
                : isFullPaymentSelected || isWalletPayment
                  ? Number(groupTotalWithDelivery || 0)
                  : Math.round(Number(groupEffectiveSubtotal || 0) * 0.25);
              const groupRemaining = isWalletPayment
                ? 0
                : Math.max(0, Number(groupTotalWithDelivery || 0) - groupDeposit);
              return (
                <div
                  key={group.sellerId}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {group.sellerLogo ? (
                        <img
                          src={group.sellerLogo}
                          alt={group.sellerName}
                          className="h-11 w-11 shrink-0 rounded-2xl border border-slate-200 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e4] text-base font-black text-[#ff6a00]">
                          {String(group.sellerName || 'V').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[11px] font-black uppercase tracking-wide text-[#ff6a00]">
                          {group.sellerIsShop ? 'Boutique' : 'Vendeur'}
                        </p>
                        <p className="truncate text-base font-black text-slate-950 sm:text-lg">{group.sellerName}</p>
                        {group.sellerPhone && (
                          <p className="truncate text-xs font-semibold text-slate-500">{group.sellerPhone}</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-100 px-3 py-2 text-right">
                      <p className="text-base font-black text-[#ff6a00] sm:text-lg">
                        {isWalletPayment ? 'Automatique' : formatCurrency(groupDeposit)}
                      </p>
                      <p className="text-xs font-black text-orange-800">
                        {isInstallmentPayment ? 'Premier paiement' : isFullPaymentSelected ? 'Paiement intégral' : isWalletPayment ? 'Paiement portefeuille' : 'Acompte (25%)'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Payer name + transaction code — not needed for wallet */}
                    {paymentMode !== PAYMENT_MODES.WALLET && (
                      <>
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                            Nom du payeur
                          </label>
                          <input
                            type="text"
                            value={payment.payerName || ''}
                            onChange={(e) =>
                              handlePaymentChange(group.sellerId, 'payerName', e.target.value)
                            }
                            className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#ff6a00] focus:ring-2 focus:ring-gray-200"
                            placeholder={user?.name || 'Ex: Jean K.'}
                          />
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">Exemple : où trouver l'ID dans le SMS</p>
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
                          <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                            Code transaction
                          </label>
                          <div className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition-all focus-within:border-[#ff6a00] focus-within:ring-2 focus-within:ring-gray-200">
                            <CreditCard size={18} className="flex-shrink-0 text-slate-400" />
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={10}
                              value={payment.transactionCode || ''}
                              onChange={(e) =>
                                handlePaymentChange(group.sellerId, 'transactionCode', e.target.value)
                              }
                              className="w-full border-none p-0 text-sm font-semibold focus:outline-none"
                              placeholder="10 chiffres (ex: 7232173826)"
                              title="ID de la transaction : 10 chiffres reçus par SMS"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Wallet payment info */}
                    {paymentMode === PAYMENT_MODES.WALLET && (
                      <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-sm font-black text-emerald-800">
                          Paiement par portefeuille HDMarket
                        </p>
                        <p className="text-xs font-semibold text-emerald-700">
                          Aucun acompte ni code transaction requis ici. Le paiement est traité côté HDMarket.
                        </p>
                      </div>
                    )}

                    {!isInstallmentPayment && (
                      <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500">
                          Code promo vendeur
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex min-h-[46px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                            <Tag size={16} className="flex-shrink-0 text-slate-400" />
                            <input
                              type="text"
                              value={payment.promoCode || ''}
                              onChange={(e) =>
                                handlePaymentChange(group.sellerId, 'promoCode', e.target.value)
                              }
                              className="w-full border-none p-0 text-sm font-semibold uppercase focus:outline-none"
                              placeholder="Ex: WELCOME20"
                              maxLength={40}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => applyPromoCodeForSeller(group)}
                            disabled={Boolean(promoLoadingBySeller[group.sellerId]) || !String(payment.promoCode || '').trim()}
                            className="min-h-[46px] rounded-2xl bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
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
                      <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-wide text-amber-700">
                            Premier paiement fixe ({formatCurrency(installmentMinAmount)})
                          </label>
                          <input
                            type="number"
                            min={installmentMinAmount || 1}
                            max={Number(group.subtotal || 0)}
                            value={installmentFirstPaymentAmount}
                            readOnly
                            disabled
                            className="min-h-[48px] w-full rounded-2xl border border-amber-100 bg-white px-4 text-sm font-semibold text-slate-700"
                          />
                          <p className="mt-1 text-xs font-semibold text-amber-800">
                            Reste estimé: {formatCurrency(installmentRemainingAmount)}
                          </p>
                        </div>

                        {installmentRequiresGuarantor && (
                          <div className="space-y-3 rounded-2xl border border-amber-100 bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-amber-700">Informations garant</p>
                            <input
                              type="text"
                              placeholder="Nom complet"
                              value={guarantor.fullName}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, fullName: e.target.value }))}
                              className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                            />
                            <input
                              type="text"
                              placeholder="Téléphone"
                              value={guarantor.phone}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, phone: e.target.value }))}
                              className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                            />
                            <input
                              type="text"
                              placeholder="Relation avec le client"
                              value={guarantor.relation}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, relation: e.target.value }))}
                              className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                            />
                            <input
                              type="text"
                              placeholder="Pièce d'identité (optionnel)"
                              value={guarantor.nationalId}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, nationalId: e.target.value }))}
                              className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                            />
                            <input
                              type="text"
                              placeholder="Adresse"
                              value={guarantor.address}
                              onChange={(e) => setGuarantor((prev) => ({ ...prev, address: e.target.value }))}
                              className="min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm">
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
                        <span className={`font-black ${(isFullPaymentSelected || isWalletPayment) ? 'text-emerald-700' : 'text-neutral-700'}`}>
                          {(isFullPaymentSelected || isWalletPayment) ? 'GRATUITE' : formatCurrency(groupDeliveryFee)}
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
                        {isInstallmentPayment ? 'Premier paiement' : isFullPaymentSelected ? 'Paiement intégral' : isWalletPayment ? 'Paiement portefeuille' : 'Acompte (25%)'}
                      </span>
                      <span className="font-black text-neutral-900">
                        {isWalletPayment ? 'Automatique' : formatCurrency(groupDeposit)}
                      </span>
                    </div>
                    {groupRemaining > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                        <span className="text-gray-700 font-semibold">Reste à payer</span>
                        <span className="font-black text-gray-900">
                          {formatCurrency(groupRemaining)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 sm:text-sm">
              <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-emerald-700" />
              {paymentCommitmentMessage}
            </div>
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-semibold">{error}</p>
              </div>
            )}
            {loading && checkoutStatus && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                <p className="text-sm font-bold text-emerald-800">{checkoutStatus}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#ff6a00] px-8 py-5 text-lg font-black text-white shadow-[0_14px_32px_rgba(255,106,0,0.28)] transition hover:bg-[#f05f00] active:scale-[0.98] disabled:opacity-60 sm:text-xl"
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
                  {checkoutStatus || (isWalletPayment ? 'Validation portefeuille...' : isFullPaymentSelected ? 'Paiement intégral...' : 'Confirmation...')}
                </>
              ) : (
                <>
                  <Lock size={22} />
                  {isWalletPayment ? 'Payer avec le portefeuille' : isFullPaymentSelected ? 'Payer intégralement et confirmer' : 'Confirmer la commande'}
                </>
              )}
            </button>
          </form>
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-slate-200 bg-white/95 px-5 py-5 shadow-[0_-16px_36px_rgba(15,23,42,0.14)] backdrop-blur lg:hidden safe-area-bottom">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              {isWalletPayment ? 'Paiement portefeuille' : summaryPrimaryPaymentLabel}
            </p>
            <p className="truncate text-2xl font-black text-[#ff6a00]">
              {isWalletPayment ? 'Automatique' : formatCurrency(summaryPaidAmount)}
            </p>
          </div>
          <button
            type="submit"
            form="order-checkout-form"
            disabled={loading}
            className="inline-flex min-h-[56px] min-w-[160px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-7 text-lg font-black text-white shadow-[0_14px_28px_rgba(255,106,0,0.30)] active:scale-[0.97] disabled:opacity-60"
          >
            {loading ? (
              <div className="h-6 w-6 rounded-full border-[3px] border-white border-t-transparent animate-spin" />
            ) : (
              <Lock size={20} />
            )}
            {loading ? 'Validation...' : 'Confirmer'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
