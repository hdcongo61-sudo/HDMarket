import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import BuyForMeOrder from '../models/buyForMeOrderModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import User from '../models/userModel.js';

// Registry of behavioral onboarding-step conditions. Each evaluates
// "has this user already done X" so onboardingService.js can skip the
// corresponding tutorial step instead of dumbly firing on a timer.
//
// Deliberately NOT duplicated onto the User model (per the feature spec) —
// every condition here is derived from data that already exists elsewhere,
// queried lazily and cheaply (indexed .exists() lookups, or fields already
// loaded on the user doc).
//
// Extensible: add a new key here and it's immediately usable from the
// OnboardingSequence step builder (see models/onboardingSequenceModel.js
// ONBOARDING_STEP_CONDITIONS, which must be kept in sync).
const CONDITION_REGISTRY = {
  hasPlacedOrder: async (userId) => Order.exists({ customer: userId, isDraft: { $ne: true } }).then(Boolean),
  hasPublishedProduct: async (userId) => Product.exists({ user: userId }).then(Boolean),
  hasCreatedShop: async (userId) => {
    const user = await User.findById(userId).select('accountType').lean();
    return user?.accountType === 'shop';
  },
  hasUsedBuyForMe: async (userId) => BuyForMeOrder.exists({ customerId: userId }).then(Boolean),
  hasUsedDelivery: async (userId) => DeliveryRequest.exists({ buyerId: userId }).then(Boolean),
  hasAddedFavorite: async (userId) => {
    const user = await User.findById(userId).select('favorites').lean();
    return Boolean(user?.favorites?.length);
  },
  // "Completed" here means enriched beyond the required-at-signup fields
  // (phone, address, city, gender are already mandatory in authController.js
  // register()) — profile picture + email are the optional ones left.
  hasCompletedProfile: async (userId) => {
    const user = await User.findById(userId).select('profileImage email').lean();
    return Boolean(user?.profileImage) && Boolean(user?.email);
  }
};

export const CONDITION_KEYS = Object.freeze(Object.keys(CONDITION_REGISTRY));

/**
 * A step should be SKIPPED if the user already satisfies ALL of its listed
 * conditions (i.e. they don't need the tutorial anymore). An empty/unknown
 * conditions list means "always deliver".
 */
export const shouldSkipStep = async (userId, conditions = []) => {
  const keys = (Array.isArray(conditions) ? conditions : []).filter((key) => CONDITION_REGISTRY[key]);
  if (!keys.length) return false;
  const results = await Promise.all(keys.map((key) => CONDITION_REGISTRY[key](userId).catch(() => false)));
  return results.every(Boolean);
};

export const evaluateCondition = async (key, userId) => {
  const fn = CONDITION_REGISTRY[key];
  if (!fn) return false;
  return fn(userId).catch(() => false);
};

export default { CONDITION_KEYS, shouldSkipStep, evaluateCondition };
