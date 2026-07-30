import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { canManageDeliveryRequests, getPlatformDeliveryRuntime } from '../services/platformDeliveryService.js';
import { persistDeliveryProofFile } from '../utils/deliveryProofStorage.js';
import {
  adminCancelBuyForMeOrder,
  adjustBuyForMeOverage,
  assignBuyForMeDriver,
  BALANCE_PREFERENCES,
  cancelBuyForMeOrder,
  completeBuyForMeAdditionalPayment,
  confirmBuyForMeOrder,
  createPaidBuyForMeOrder,
  declineBuyForMeAdditionalPayment,
  getAdminBuyForMeOrders as getAdminBuyForMeOrdersService,
  getAdminBuyForMeStats as getAdminBuyForMeStatsService,
  getBuyForMeConfig,
  getBuyForMeOrderForCustomer,
  listMyBuyForMeOrders,
  openBuyForMeDispute,
  quoteBuyForMe,
  respondToBuyForMeItem,
  STORE_TYPES,
  updateBuyForMeConfig
} from '../services/buyForMeService.js';

const actorId = (req) => req.user?.id || req.user?._id;
const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const sendServiceError = (res, error) => {
  const statusCode = Number(error?.statusCode || 500);
  if (statusCode < 500) return res.status(statusCode).json({ message: error.message });
  throw error;
};

const validId = (value) => mongoose.isValidObjectId(value);

export const getBuyForMeCapabilities = asyncHandler(async (_req, res) => {
  const config = await getBuyForMeConfig();
  return res.json({
    enabled: Boolean(config?.enabled),
    storeTypes: config?.supportedStoreTypes || STORE_TYPES,
    minimumBudget: config?.minimumBudget || 0,
    maximumBudget: config?.maximumBudget || 0,
    supportedCities: config?.supportedCities || []
  });
});

export const estimateBuyForMe = asyncHandler(async (req, res) => {
  try {
    const quote = await quoteBuyForMe({
      storeType: req.body?.storeType,
      pickup: parseJson(req.body?.pickup),
      dropoff: parseJson(req.body?.dropoff),
      items: parseJson(req.body?.items, []),
      authorizationMode: req.body?.authorizationMode,
      shoppingBudget: req.body?.shoppingBudget
    });
    return res.json(quote);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const uploadBuyForMeItemImage = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Sélectionnez une image du produit.' });
  const imageUrl = await persistDeliveryProofFile(req.file, { category: 'buy-for-me-item' });
  if (!imageUrl) return res.status(500).json({ message: 'L’image du produit n’a pas pu être enregistrée.' });
  return res.status(201).json({ imageUrl });
});

export const getMyBuyForMeOrders = asyncHandler(async (req, res) => {
  return res.json(await listMyBuyForMeOrders({ customerId: actorId(req), page: req.query?.page, limit: req.query?.limit }));
});

export const getMyBuyForMeOrder = asyncHandler(async (req, res) => {
  if (!validId(req.params?.id)) return res.status(400).json({ message: 'Demande invalide.' });
  try {
    return res.json(await getBuyForMeOrderForCustomer({ orderId: req.params.id, customerId: actorId(req) }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const cancelMyBuyForMeOrder = asyncHandler(async (req, res) => {
  if (!validId(req.params?.id)) return res.status(400).json({ message: 'Demande invalide.' });
  try {
    return res.json(await cancelBuyForMeOrder({ orderId: req.params.id, customerId: actorId(req), reason: req.body?.reason }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const confirmMyBuyForMeOrder = asyncHandler(async (req, res) => {
  if (!validId(req.params?.id)) return res.status(400).json({ message: 'Demande invalide.' });
  try {
    return res.json(await confirmBuyForMeOrder({ orderId: req.params.id, customerId: actorId(req) }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const respondMyBuyForMeItem = asyncHandler(async (req, res) => {
  if (!validId(req.params?.id) || !validId(req.params?.itemId)) return res.status(400).json({ message: 'Article ou demande invalide.' });
  try {
    return res.json(await respondToBuyForMeItem({
      orderId: req.params.id,
      customerId: actorId(req),
      itemId: req.params.itemId,
      action: req.body?.action,
      replacementNote: req.body?.replacementNote
    }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const declineMyBuyForMeAdditionalPayment = asyncHandler(async (req, res) => {
  if (!validId(req.params?.id)) return res.status(400).json({ message: 'Demande invalide.' });
  try {
    return res.json(await declineBuyForMeAdditionalPayment({ orderId: req.params.id, customerId: actorId(req) }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const adjustMyBuyForMeOverage = asyncHandler(async (req, res) => {
  if (!validId(req.params?.id)) return res.status(400).json({ message: 'Demande invalide.' });
  try {
    return res.json(await adjustBuyForMeOverage({
      orderId: req.params.id,
      customerId: actorId(req),
      adjustments: req.body?.adjustments
    }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const createMyBuyForMeDispute = asyncHandler(async (req, res) => {
  if (!validId(req.params?.id)) return res.status(400).json({ message: 'Demande invalide.' });
  try {
    const dispute = await openBuyForMeDispute({ orderId: req.params.id, customerId: actorId(req), reason: req.body?.reason });
    return res.status(201).json(dispute);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

// Used only by the PawaPay checkout completion controller. Price and amount
// are recalculated server-side; the browser never creates a paid order itself.
export const pawaPayCreateBuyForMeOrder = asyncHandler(async (req, res) => {
  if (!req.pawaPayCheckout || req.pawaPayCheckout.status !== 'COMPLETED') {
    return res.status(403).json({ message: 'Confirmation PawaPay requise.' });
  }
  try {
    const order = await createPaidBuyForMeOrder({
      customerId: actorId(req),
      checkoutId: req.pawaPayCheckout.checkoutId,
      amountPaid: req.pawaPayCheckout.amount,
      payload: {
        storeType: req.body?.storeType,
        preferredStore: req.body?.preferredStore,
        pickup: parseJson(req.body?.pickup),
        dropoff: parseJson(req.body?.dropoff),
        items: parseJson(req.body?.items, []),
        authorizationMode: req.body?.authorizationMode,
        shoppingBudget: req.body?.shoppingBudget,
        specialInstructions: req.body?.specialInstructions,
        balancePreference: req.body?.balancePreference
      }
    });
    return res.status(201).json(order);
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const pawaPayCompleteBuyForMeAdditionalPayment = asyncHandler(async (req, res) => {
  if (!req.pawaPayCheckout || req.pawaPayCheckout.status !== 'COMPLETED') {
    return res.status(403).json({ message: 'Confirmation PawaPay requise.' });
  }
  try {
    return res.json(await completeBuyForMeAdditionalPayment({
      orderId: req.body?.orderId,
      customerId: actorId(req),
      checkoutId: req.pawaPayCheckout.checkoutId,
      amountPaid: req.pawaPayCheckout.amount
    }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

const requireBuyForMeAdmin = async (req, res) => {
  const runtime = await getPlatformDeliveryRuntime();
  if (!canManageDeliveryRequests(req.user, runtime)) {
    res.status(403).json({ message: 'Accès refusé.' });
    return false;
  }
  return true;
};

export const getAdminBuyForMeConfig = asyncHandler(async (req, res) => {
  if (!(await requireBuyForMeAdmin(req, res))) return;
  return res.json(await getBuyForMeConfig());
});

export const patchAdminBuyForMeConfig = asyncHandler(async (req, res) => {
  if (!(await requireBuyForMeAdmin(req, res))) return;
  try {
    return res.json(await updateBuyForMeConfig(req.body || {}));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const getAdminBuyForMeOrders = asyncHandler(async (req, res) => {
  if (!(await requireBuyForMeAdmin(req, res))) return;
  return res.json(await getAdminBuyForMeOrdersService({ status: req.query?.status, search: req.query?.search, page: req.query?.page, limit: req.query?.limit }));
});

export const getAdminBuyForMeStats = asyncHandler(async (req, res) => {
  if (!(await requireBuyForMeAdmin(req, res))) return;
  return res.json(await getAdminBuyForMeStatsService());
});

export const assignAdminBuyForMeDriver = asyncHandler(async (req, res) => {
  if (!(await requireBuyForMeAdmin(req, res))) return;
  if (!validId(req.params?.id) || !validId(req.body?.driverId)) return res.status(400).json({ message: 'Demande ou livreur invalide.' });
  try {
    return res.json(await assignBuyForMeDriver({ orderId: req.params.id, driverId: req.body.driverId, actorId: actorId(req) }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export const cancelAdminBuyForMeOrder = asyncHandler(async (req, res) => {
  if (!(await requireBuyForMeAdmin(req, res))) return;
  if (!validId(req.params?.id)) return res.status(400).json({ message: 'Demande invalide.' });
  try {
    return res.json(await adminCancelBuyForMeOrder({ orderId: req.params.id, actorId: actorId(req), reason: req.body?.reason }));
  } catch (error) {
    return sendServiceError(res, error);
  }
});

export { BALANCE_PREFERENCES, STORE_TYPES };
