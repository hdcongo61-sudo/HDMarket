/**
 * One-off data migration: embed the existing GLOBAL data into the République
 * du Congo country so every market owns its data (admins, users, campaigns,
 * notifications, promo codes, flash sales, commerce records…).
 *
 * Run:  cd backend && node scripts/migrateGlobalDataToCongo.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Country from '../models/countryModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import Payment from '../models/paymentModel.js';
import Cart from '../models/cartModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import ParcelRequest from '../models/parcelRequestModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import DeliveryGuyApplication from '../models/deliveryGuyApplicationModel.js';
import QuotationRequest from '../models/quotationRequestModel.js';
import BoostRequest from '../models/boostRequestModel.js';
import BuyForMeOrder from '../models/buyForMeOrderModel.js';
import GlobalNotificationRequest from '../models/globalNotificationRequestModel.js';
import NotificationCampaign from '../models/notificationCampaignModel.js';
import PromoCode from '../models/promoCodeModel.js';
import MarketplacePromoCode from '../models/marketplacePromoCodeModel.js';
import FlashSale from '../models/flashSaleModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import Complaint from '../models/complaintModel.js';
import Dispute from '../models/disputeModel.js';
import Refund from '../models/refundModel.js';
import OrderMessage from '../models/orderMessageModel.js';
import ChatSession from '../models/chatSessionModel.js';
import ChatMessage from '../models/chatMessageModel.js';
import Notification from '../models/notificationModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';
import Report from '../models/reportModel.js';
import PromoCodeUsage from '../models/promoCodeUsageModel.js';
import QuotationItem from '../models/quotationItemModel.js';
import ProductQuestion from '../models/productQuestionModel.js';
import ProductVideo from '../models/productVideoModel.js';
import SellerPayout from '../models/sellerPayoutModel.js';
import SellerSettlement from '../models/sellerSettlementModel.js';
import DeliveryLog from '../models/deliveryLogModel.js';
import GroupBuy from '../models/groupBuyModel.js';
import SocialCampaign from '../models/socialCampaignModel.js';
import SearchHistory from '../models/searchHistoryModel.js';
import RewardPoints from '../models/rewardPointsModel.js';
import PlatformDailyAnalytics from '../models/platformDailyAnalyticsModel.js';
import ProductDraft from '../models/productDraftModel.js';

const NULL_COUNTRY = { $or: [{ countryId: null }, { countryId: { $exists: false } }] };

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const country = await Country.findOne({ $or: [{ code: 'CG' }, { iso3: 'COG' }] }).sort({ isDefault: -1 });
  if (!country) {
    console.error('Congo country (CG/COG) not found — aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const cid = country._id;
  console.log(`Country: ${country.name} (${country.code}/${country.iso3}) [${cid}]`);

  // ── Admins: every admin becomes an admin OF Congo (no more global admins) ──
  const adminFix = await User.updateMany(
    { role: 'admin', $or: [{ adminCountryIds: [] }, { adminCountryIds: { $exists: false } }] },
    { $set: { adminCountryIds: [cid] } }
  );
  console.log(`admins registered to Congo: ${adminFix.modifiedCount || adminFix.nModified || 0}`);

  // ── All users (any role, founder included) attached to Congo when missing ──
  const userFix = await User.updateMany(NULL_COUNTRY, { $set: { countryId: cid } });
  console.log(`users attached to Congo: ${userFix.modifiedCount || userFix.nModified || 0}`);

  // ── Commerce / operations records with a country dimension ────────────────
  const commerceModels = {
    products: Product,
    orders: Order,
    payments: Payment,
    carts: Cart,
    deliveryRequests: DeliveryRequest,
    parcelRequests: ParcelRequest,
    deliveryGuys: DeliveryGuy,
    deliveryGuyApplications: DeliveryGuyApplication,
    quotations: QuotationRequest,
    boostRequests: BoostRequest,
    buyForMeOrders: BuyForMeOrder,
    globalNotifications: GlobalNotificationRequest,
    notificationCampaigns: NotificationCampaign,
    promoCodes: PromoCode,
    marketplacePromoCodes: MarketplacePromoCode,
    flashSales: FlashSale,
    cities: City,
    communes: Commune
  };

  for (const [label, Model] of Object.entries(commerceModels)) {
    const result = await Model.updateMany(NULL_COUNTRY, { $set: { countryId: cid } });
    console.log(`${label} attached to Congo: ${result.modifiedCount || result.nModified || 0}`);
  }

  // ── Derived backfill for the collections that just gained countryId ───────
  // These derive their country from the linked user or the parent commerce
  // record (both already attached to Congo above). Idempotent: only touches
  // documents that still lack a countryId.
  const backfillFrom = async ({ Model, localField, sourceModel, sourceField = 'countryId', label }) => {
    const missing = await Model.find(NULL_COUNTRY).select(localField).lean();
    if (!missing.length) {
      console.log(`${label} backfilled: 0`);
      return;
    }
    const keys = [
      ...new Set(
        missing
          .map((doc) => String(doc?.[localField] || '').trim())
          .filter(Boolean)
      )
    ];
    const sources = keys.length
      ? await sourceModel.find({ _id: { $in: keys } }).select(`_id ${sourceField}`).lean()
      : [];
    const countryById = new Map(
      sources
        .map((src) => [String(src._id), String(src[sourceField] || '').trim()])
        .filter(([, country]) => Boolean(country))
    );
    const ops = [];
    for (const doc of missing) {
      const value = countryById.get(String(doc[localField] || ''));
      if (!value) continue;
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { countryId: value } } } });
    }
    if (ops.length) await Model.bulkWrite(ops, { ordered: false });
    console.log(`${label} backfilled: ${ops.length}`);
  };

  await backfillFrom({ Model: Complaint, localField: 'user', sourceModel: User, label: 'complaints' });
  await backfillFrom({ Model: Dispute, localField: 'orderId', sourceModel: Order, label: 'disputes' });
  await backfillFrom({ Model: Refund, localField: 'order', sourceModel: Order, label: 'refunds' });
  await backfillFrom({ Model: OrderMessage, localField: 'order', sourceModel: Order, label: 'orderMessages' });
  await backfillFrom({ Model: ChatSession, localField: 'userId', sourceModel: User, label: 'chatSessions' });
  await backfillFrom({ Model: Notification, localField: 'user', sourceModel: User, label: 'notifications' });
  await backfillFrom({ Model: Comment, localField: 'user', sourceModel: User, label: 'comments' });
  await backfillFrom({ Model: Rating, localField: 'user', sourceModel: User, label: 'ratings' });
  await backfillFrom({ Model: Report, localField: 'reporter', sourceModel: User, label: 'reports' });
  await backfillFrom({ Model: PromoCodeUsage, localField: 'promoCode', sourceModel: PromoCode, label: 'promoCodeUsages' });
  await backfillFrom({ Model: QuotationItem, localField: 'quotation', sourceModel: QuotationRequest, label: 'quotationItems' });
  await backfillFrom({ Model: ProductQuestion, localField: 'productId', sourceModel: Product, label: 'productQuestions' });
  await backfillFrom({ Model: ProductVideo, localField: 'product', sourceModel: Product, label: 'productVideos' });
  await backfillFrom({ Model: SellerPayout, localField: 'seller', sourceModel: User, label: 'sellerPayouts' });
  await backfillFrom({ Model: SellerSettlement, localField: 'seller', sourceModel: User, label: 'sellerSettlements' });
  await backfillFrom({ Model: DeliveryLog, localField: 'sellerId', sourceModel: User, label: 'deliveryLogs' });
  await backfillFrom({ Model: GroupBuy, localField: 'productId', sourceModel: Product, label: 'groupBuys' });
  await backfillFrom({ Model: SocialCampaign, localField: 'productId', sourceModel: Product, label: 'socialCampaigns' });
  await backfillFrom({ Model: SearchHistory, localField: 'user', sourceModel: User, label: 'searchHistory' });
  await backfillFrom({ Model: RewardPoints, localField: 'user', sourceModel: User, label: 'rewardPoints' });
  await backfillFrom({ Model: ProductDraft, localField: 'user', sourceModel: User, label: 'productDrafts' });

  // Chat messages store the author as Mixed (id string, { _id }, …).
  const chatMessages = await ChatMessage.find(NULL_COUNTRY).select('user').lean();
  const chatKeys = [
    ...new Set(
      chatMessages
        .map((doc) => {
          const raw = doc?.user;
          if (mongoose.isValidObjectId(raw)) return String(raw);
          if (raw && typeof raw === 'object') {
            const id = raw?._id || raw?.userId || raw?.id;
            return id && mongoose.isValidObjectId(id) ? String(id) : null;
          }
          return null;
        })
        .filter(Boolean)
    )
  ];
  const chatUsers = chatKeys.length
    ? await User.find({ _id: { $in: chatKeys } }).select('_id countryId').lean()
    : [];
  const chatCountryById = new Map(
    chatUsers.map((user) => [String(user._id), String(user.countryId || '')]).filter(([, country]) => Boolean(country))
  );
  const chatOps = [];
  for (const doc of chatMessages) {
    const raw = doc?.user;
    const id = mongoose.isValidObjectId(raw)
      ? String(raw)
      : raw && typeof raw === 'object'
        ? String(raw?._id || raw?.userId || raw?.id || '')
        : '';
    const value = chatCountryById.get(id);
    if (!value) continue;
    chatOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { countryId: value } } } });
  }
  if (chatOps.length) await ChatMessage.bulkWrite(chatOps, { ordered: false });
  console.log(`chatMessages backfilled: ${chatOps.length}`);

  // Platform daily analytics has no owner — attach to the default country.
  const analyticsFix = await PlatformDailyAnalytics.updateMany(NULL_COUNTRY, { $set: { countryId: cid } });
  console.log(`platformDailyAnalytics attached to Congo: ${analyticsFix.modifiedCount || analyticsFix.nModified || 0}`);

  console.log('Migration complete.');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
