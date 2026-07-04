import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import FlashSale from '../models/flashSaleModel.js';
import MarketplacePromoCode from '../models/marketplacePromoCodeModel.js';
import { withVerifiedPublicProductFilter } from '../utils/publicProductVisibility.js';

const SHOP_SELECT_FIELDS =
  'name shopName shopAddress shopLogo city country shopVerified isBlocked slug followersCount createdAt freeDeliveryEnabled';
const PRODUCT_SELECT_FIELDS =
  'title price priceBeforeDiscount discount images attributes user slug category condition city createdAt salesCount favoritesCount viewsCount ratingAverage ratingCount commentCount installmentEnabled installmentStartDate installmentEndDate wholesaleEnabled wholesaleTiers wholesaleMinQty promoSavedAmount boosted boostScore';

const clampLimit = (value, fallback = 8, max = 20) =>
  Math.max(1, Math.min(Number(value) || fallback, max));

const serializeProduct = (product) => ({
  ...product,
  commentCount: Number(product.commentCount || 0),
  ratingAverage: Number(product.ratingAverage || 0),
  ratingCount: Number(product.ratingCount || 0)
});

const listProducts = async ({ filter = {}, sort = { createdAt: -1 }, limit = 8 }) => {
  const items = await Product.find({ status: 'approved', ...filter })
    .select(PRODUCT_SELECT_FIELDS)
    .sort(sort)
    .limit(limit)
    .populate('user', SHOP_SELECT_FIELDS)
    .lean();
  return items.map(serializeProduct);
};

const listVerifiedShops = async (limit = 8) => {
  const shops = await User.find({
    accountType: 'shop',
    shopVerified: true,
    isBlocked: { $ne: true }
  })
    .select('name shopName shopLogo shopAddress shopVerified slug followersCount createdAt')
    .sort({ followersCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  if (!shops.length) return [];

  const shopIds = shops.map((shop) => shop._id);
  const productCounts = await Product.aggregate([
    {
      $match: await withVerifiedPublicProductFilter({
        user: { $in: shopIds },
        status: 'approved'
      })
    },
    { $group: { _id: '$user', count: { $sum: 1 } } }
  ]);
  const productCountMap = new Map(
    productCounts.map((entry) => [String(entry._id), Number(entry.count || 0)])
  );

  return shops.map((shop) => ({
    ...shop,
    shopName: shop.shopName || shop.name || 'Boutique',
    shopVerified: Boolean(shop.shopVerified),
    followersCount: Number(shop.followersCount || 0),
    productCount: productCountMap.get(String(shop._id)) || 0
  }));
};

const getPromoHomeData = async ({ shopLimit = 8, flashLimit = 8 }) => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [shopPromos, productPromos] = await Promise.all([
    MarketplacePromoCode.aggregate([
      {
        $match: {
          isActive: true,
          startDate: { $lte: weekEnd },
          endDate: { $gte: weekStart },
          boutiqueId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$boutiqueId',
          promoCountThisWeek: { $sum: 1 },
          activePromoCountNow: {
            $sum: {
              $cond: [{ $and: [{ $lte: ['$startDate', now] }, { $gte: ['$endDate', now] }] }, 1, 0]
            }
          },
          maxDiscountValue: { $max: '$discountValue' },
          nextEndingAt: { $min: '$endDate' }
        }
      },
      { $sort: { activePromoCountNow: -1, promoCountThisWeek: -1, nextEndingAt: 1 } },
      { $limit: shopLimit * 2 }
    ]),
    MarketplacePromoCode.find({
      isActive: true,
      appliesTo: 'product',
      startDate: { $lte: now },
      endDate: { $gte: now },
      productId: { $ne: null }
    })
      .select('discountType discountValue endDate productId')
      .sort({ endDate: 1, createdAt: -1 })
      .limit(flashLimit * 3)
      .lean()
  ]);

  const shopObjectIds = shopPromos
    .map((entry) => String(entry._id || ''))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const productIds = productPromos
    .map((promo) => String(promo.productId || ''))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [shopDocs, productCounts, flashProducts] = await Promise.all([
    shopObjectIds.length
      ? User.find({
          _id: { $in: shopObjectIds },
          $or: [{ accountType: 'shop' }, { role: 'boutique_owner' }],
          isBlocked: { $ne: true }
        })
          .select('name shopName shopLogo shopAddress shopVerified slug role accountType')
          .lean()
      : [],
    shopObjectIds.length
      ? Product.aggregate([
          { $match: { user: { $in: shopObjectIds }, status: 'approved' } },
          { $group: { _id: '$user', count: { $sum: 1 } } }
        ])
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds }, status: 'approved' })
          .select(PRODUCT_SELECT_FIELDS)
          .populate('user', SHOP_SELECT_FIELDS)
          .lean()
      : []
  ]);

  const productCountMap = new Map(productCounts.map((entry) => [String(entry._id), Number(entry.count || 0)]));
  const shopMap = new Map(shopDocs.map((shop) => [String(shop._id), shop]));
  const promoShops = shopPromos
    .map((entry) => {
      const shop = shopMap.get(String(entry._id));
      if (!shop) return null;
      return {
        _id: shop._id,
        slug: shop.slug || null,
        shopName: shop.shopName || shop.name || 'Boutique',
        shopLogo: shop.shopLogo || null,
        shopAddress: shop.shopAddress || '',
        shopVerified: Boolean(shop.shopVerified),
        productCount: productCountMap.get(String(shop._id)) || 0,
        promoCountThisWeek: Number(entry.promoCountThisWeek || 0),
        activePromoCountNow: Number(entry.activePromoCountNow || 0),
        maxDiscountValue: Number(entry.maxDiscountValue || 0),
        nextEndingAt: entry.nextEndingAt || null
      };
    })
    .filter(Boolean)
    .slice(0, shopLimit);

  const promoByProduct = new Map(productPromos.map((promo) => [String(promo.productId), promo]));
  const flashDeals = flashProducts.slice(0, flashLimit).map((product) => {
    const promo = promoByProduct.get(String(product._id));
    return {
      ...serializeProduct(product),
      flashPromo: promo
        ? {
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            endDate: promo.endDate
          }
        : null
    };
  });

  return { promoShops, flashDeals };
};

export const getHomeFeed = asyncHandler(async (req, res) => {
  const secondaryLimit = clampLimit(req.query.secondaryLimit, 8, 16);
  const cityLimit = clampLimit(req.query.cityLimit, 6, 12);
  const city = String(req.query.city || '').trim();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [
    favorites,
    topRated,
    topDeals,
    topDiscounts,
    newProducts,
    usedProducts,
    installmentProducts,
    topSales,
    discountProducts,
    verifiedShops,
    promoHome,
    activeFlashSales,
    wholesaleProducts,
    topSalesCityToday
  ] = await Promise.all([
    listProducts({ sort: { favoritesCount: -1, createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ sort: { ratingAverage: -1, ratingCount: -1, createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ sort: { discount: -1, createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ filter: { discount: { $gt: 0 } }, sort: { discount: -1, createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ filter: { condition: 'new' }, sort: { createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ filter: { condition: 'used' }, sort: { createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ filter: { installmentEnabled: true }, sort: { createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ filter: { salesCount: { $gt: 0 } }, sort: { salesCount: -1, createdAt: -1 }, limit: secondaryLimit }),
    listProducts({ filter: { discount: { $gt: 0 } }, sort: { discount: -1, createdAt: -1 }, limit: secondaryLimit }),
    listVerifiedShops(secondaryLimit),
    getPromoHomeData({ shopLimit: secondaryLimit, flashLimit: secondaryLimit }),
    FlashSale.find({ status: 'active', isVisible: { $ne: false }, endDate: { $gte: now } })
      .sort({ endDate: 1 })
      .limit(secondaryLimit)
      .populate('product', PRODUCT_SELECT_FIELDS)
      .populate('seller', 'shopName name slug shopLogo')
      .lean(),
    listProducts({ filter: { wholesaleEnabled: true }, sort: { createdAt: -1 }, limit: secondaryLimit }),
    city
      ? listProducts({
          filter: { city, salesCount: { $gt: 0 }, updatedAt: { $gte: todayStart } },
          sort: { salesCount: -1, updatedAt: -1 },
          limit: cityLimit
        })
      : []
  ]);

  res.json({
    highlights: {
      favorites,
      topRated,
      topDeals,
      topDiscounts,
      newProducts,
      usedProducts,
      installmentProducts,
      cityHighlights: {}
    },
    topSales,
    discountProducts,
    verifiedShops,
    promoShops: promoHome.promoShops,
    flashDeals: promoHome.flashDeals,
    activeFlashSales: activeFlashSales.map((sale) => ({
      ...sale,
      product: sale.product ? serializeProduct(sale.product) : sale.product
    })),
    wholesaleProducts,
    topSalesCityToday
  });
});
