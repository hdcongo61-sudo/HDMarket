import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';
import Rating from '../models/ratingModel.js';
import Notification from '../models/notificationModel.js';
import { registerNotificationStream } from '../utils/notificationEmitter.js';
import { createNotification } from '../utils/notificationService.js';

const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  product_comment: true,
  reply: true,
  favorite: true,
  rating: true,
  product_approval: true,
  product_rejection: true,
  promotional: true,
  shop_review: true,
  payment_pending: true,
  order_created: true,
  order_delivered: true
});

const mergeNotificationPreferences = (prefs = {}) => {
  const merged = {};
  Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).forEach((key) => {
    merged[key] =
      typeof prefs[key] === 'boolean' ? prefs[key] : DEFAULT_NOTIFICATION_PREFERENCES[key];
  });
  return merged;
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountType: user.accountType,
  country: user.country,
  address: user.address,
  city: user.city,
  gender: user.gender,
  shopName: user.shopName,
  shopAddress: user.shopAddress,
  shopLogo: user.shopLogo,
  shopVerified: Boolean(user.shopVerified),
  shopDescription: user.shopDescription || '',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(sanitizeUser(user));
});

export const getProfileStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [products, userDoc] = await Promise.all([
    Product.find({ user: userId })
      .select(
        '_id status favoritesCount whatsappClicks views title price images createdAt category condition city payment advertismentSpend'
      )
      .populate('payment', 'amount status')
      .lean(),
    User.findById(userId).select('favorites').lean()
  ]);

  const listings = {
    total: products.length,
    approved: 0,
    pending: 0,
    rejected: 0,
    disabled: 0
  };

  let favoritesReceived = 0;
  let whatsappClicks = 0;
  let totalViews = 0;

  const categoryCounts = new Map();
  const conditionCounts = new Map();
  const timelineMap = new Map();

  products.forEach((product) => {
    if (product?.status && Object.prototype.hasOwnProperty.call(listings, product.status)) {
      listings[product.status] += 1;
    }

    favoritesReceived += Number(product?.favoritesCount || 0);
    whatsappClicks += Number(product?.whatsappClicks || 0);
    totalViews += Number(product?.views || 0);

    if (product?.category) {
      categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
    }

    if (product?.condition) {
      conditionCounts.set(product.condition, (conditionCounts.get(product.condition) || 0) + 1);
    }

    if (product?.createdAt) {
      const createdAt = new Date(product.createdAt);
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;
      const entry = timelineMap.get(key) || { count: 0, favorites: 0, clicks: 0 };
      entry.count += 1;
      entry.favorites += Number(product?.favoritesCount || 0);
      entry.clicks += Number(product?.whatsappClicks || 0);
      timelineMap.set(key, entry);
    }
  });

  const productIds = products.map((product) => product._id);
  const advertismentSpend = products.reduce((sum, product) => {
    const fee = Number(product?.payment?.amount || product?.advertismentSpend || 0);
    return sum + (Number.isFinite(fee) ? fee : 0);
  }, 0);

  let commentsReceived = 0;
  if (productIds.length) {
    commentsReceived = await Comment.countDocuments({ product: { $in: productIds } });
  }

  const performance = {
    views: totalViews,
    clicks: whatsappClicks,
    conversion:
      listings.approved > 0 ? Math.min(100, Math.round((whatsappClicks / listings.approved) * 100)) : 0
  };

  const formatLabel = (monthIndex, year) => {
    const date = new Date(year, monthIndex - 1, 1);
    return date.toLocaleString('fr-FR', { month: 'short' });
  };

  const timeline = Array.from(timelineMap.entries())
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      const timestamp = new Date(year, month - 1, 1).getTime();
      return {
        label: `${formatLabel(month, year)} ${String(year).slice(-2)}`,
        month,
        year,
        count: value.count,
        favorites: value.favorites,
        clicks: value.clicks,
        timestamp
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6);

  const breakdown = {
    categories: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    conditions: ['new', 'used']
      .map((condition) => ({
        condition,
        count: conditionCounts.get(condition) || 0
      }))
      .filter((item) => item.count > 0)
  };

  const topProducts = [...products]
    .sort((a, b) => {
      const scoreA = Number(a?.favoritesCount || 0) + Number(a?.whatsappClicks || 0);
      const scoreB = Number(b?.favoritesCount || 0) + Number(b?.whatsappClicks || 0);
      return scoreB - scoreA;
    })
    .slice(0, 5)
    .map((product) => ({
      _id: product._id,
      title: product.title,
      status: product.status,
      price: product.price,
      favorites: product.favoritesCount || 0,
      whatsappClicks: product.whatsappClicks || 0,
      image: Array.isArray(product.images) ? product.images[0] : null,
      createdAt: product.createdAt,
      category: product.category
    }));

  res.json({
    listings,
    engagement: {
      favoritesReceived,
      commentsReceived,
      favoritesSaved: userDoc?.favorites?.length || 0
    },
    performance,
    breakdown,
    timeline,
    topProducts,
    advertismentSpend
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const {
    name,
    email,
    phone,
    password,
    accountType,
    shopName,
    shopAddress,
    city,
    gender,
    address,
    shopDescription
  } = req.body;

  if (email && email !== user.email) {
    const exists = await User.findOne({ email });
    if (exists && exists._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    user.email = email;
  }

  if (name) user.name = name;
  if (phone) user.phone = phone;

  if (accountType) {
    user.accountType = accountType === 'shop' ? 'shop' : 'person';
  }

  if (typeof address !== 'undefined') {
    const trimmed = address.toString().trim();
    if (!trimmed) {
      return res.status(400).json({ message: "L'adresse est requise." });
    }
    user.address = trimmed;
  }

  if (city && ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'].includes(city)) {
    user.city = city;
  }

  if (gender && ['homme', 'femme'].includes(gender)) {
    user.gender = gender;
  }

  user.country = 'République du Congo';

  if (typeof shopName !== 'undefined') {
    user.shopName = shopName;
  }
  if (typeof shopAddress !== 'undefined') {
    user.shopAddress = shopAddress;
  }
  if (typeof shopDescription !== 'undefined') {
    user.shopDescription = shopDescription.toString().trim();
  }

  if (user.accountType === 'shop') {
    user.shopName = user.shopName || shopName;
    user.shopAddress = user.shopAddress || shopAddress;
    if (!user.shopName) {
      return res.status(400).json({ message: 'Le nom de la boutique est requis.' });
    }
    if (!user.shopAddress) {
      return res.status(400).json({ message: "L'adresse de la boutique est requise." });
    }
    if (!user.shopDescription || !user.shopDescription.trim()) {
      return res.status(400).json({ message: 'Veuillez ajouter une description pour votre boutique.' });
    }
    if (typeof shopDescription === 'undefined' && !user.shopDescription) {
      user.shopDescription = '';
    }
    if (req.file) {
      user.shopLogo = `${req.protocol}://${req.get('host')}/${req.file.path.replace('\\', '/')}`;
    } else if (!user.shopLogo) {
      return res.status(400).json({ message: 'Le logo de la boutique est requis.' });
    }
  } else {
    user.shopName = undefined;
    user.shopAddress = undefined;
    user.shopLogo = undefined;
    user.shopDescription = '';
  }

  if (password) user.password = password;

  await user.save();

  if (city && ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'].includes(city)) {
    await Product.updateMany({ user: user._id }, { city, country: user.country });
  }

  res.json(sanitizeUser(user));
});

export const getNotifications = asyncHandler(async (req, res) => {
  const [notifications, userDoc] = await Promise.all([
    Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('product', 'title status')
      .populate('shop', 'shopName name')
      .populate('actor', 'name email'),
    User.findById(req.user.id).select('notificationPreferences')
  ]);

  if (!userDoc) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }

  const alerts = notifications.map((notification) => {
    const actor = notification.actor
      ? {
          _id: notification.actor._id,
          name: notification.actor.name,
          email: notification.actor.email
        }
      : null;
    const product = notification.product
      ? {
          _id: notification.product._id,
          title: notification.product.title,
          status: notification.product.status
        }
      : null;
    const metadata = notification.metadata || {};
    const shopInfo = notification.shop
      ? {
          _id: notification.shop._id,
          shopName: notification.shop.shopName,
          name: notification.shop.name
        }
      : null;
    const actorName = actor?.name || 'Un utilisateur';
    const productLabel = product?.title ? ` "${product.title}"` : '';
    const rawSnippet =
      typeof metadata.message === 'string'
        ? metadata.message
        : typeof metadata.comment === 'string'
        ? metadata.comment
        : '';
    const snippet =
      rawSnippet.length > 180
        ? `${rawSnippet.slice(0, 177)}...`
        : rawSnippet;

    let message;
    switch (notification.type) {
      case 'product_comment':
        message = snippet
          ? `${actorName} a commenté votre annonce${productLabel} : ${snippet}`
          : `${actorName} a laissé un commentaire sur votre annonce${productLabel}.`;
        break;
      case 'reply':
        message = snippet
          ? `${actorName} a répondu à votre commentaire${productLabel} : ${snippet}`
          : `${actorName} a répondu à votre commentaire${productLabel}.`;
        break;
      case 'favorite':
        message = `${actorName} a ajouté votre annonce${productLabel} à ses favoris.`;
        break;
      case 'rating':
        message = metadata.value
          ? `${actorName} a noté votre annonce${productLabel} (${metadata.value}/5).`
          : `${actorName} a noté votre annonce${productLabel}.`;
        break;
      case 'product_approval':
        message = `${actorName} a approuvé votre annonce${productLabel}. Elle est désormais visible pour les acheteurs.`;
        break;
      case 'product_rejection':
        message = `${actorName} a rejeté votre annonce${productLabel}. Contactez l'équipe support pour plus d'informations.`;
        break;
      case 'promotional': {
        const discountValue = Number(metadata.discount ?? 0);
        const hasDiscount = Number.isFinite(discountValue) && discountValue > 0;
        message = hasDiscount
          ? `${actorName} a appliqué une remise de ${discountValue}% sur votre annonce${productLabel}.`
          : `${actorName} a mis en avant votre annonce${productLabel} avec une nouvelle promotion.`;
        break;
      }
      case 'shop_review': {
        const shopLabel = shopInfo?.shopName || shopInfo?.name || metadata.shopName || 'votre boutique';
        const ratingValue = Number(metadata.rating || 0);
        const ratingText = Number.isFinite(ratingValue) && ratingValue > 0 ? ` (${ratingValue}/5)` : '';
        message = snippet
          ? `${actorName} a laissé un avis sur ${shopLabel}${ratingText} : ${snippet}`
          : `${actorName} a laissé un avis sur ${shopLabel}${ratingText}.`;
        break;
      }
      case 'payment_pending': {
        const amountValue = Number(metadata.amount || 0);
        const amountText = Number.isFinite(amountValue) && amountValue > 0
          ? ` (${amountValue.toLocaleString('fr-FR')} FCFA)`
          : '';
        const waitingCount = Number(metadata.waitingCount || 0);
        const waitingSuffix =
          waitingCount > 1 ? ` · ${waitingCount} paiements en attente` : '';
        const productText = productLabel || '';
        message = `${actorName} a soumis une preuve de paiement${productText}${amountText}. Consultez la section "Vérification des paiements"${waitingSuffix}.`;
        break;
      }
      case 'order_created': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
        const action = metadata.status === 'confirmed' ? 'confirmé' : 'créé';
        message = `${actorName} a ${action} votre commande ${orderId}${city}. Nous vous tiendrons informé des étapes de livraison.`;
        break;
      }
      case 'order_delivered': {
        const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
        const address = metadata.deliveryAddress ? ` à ${metadata.deliveryAddress}` : '';
        const city = metadata.deliveryCity ? ` (${metadata.deliveryCity})` : '';
        const deliveredAtDate = metadata.deliveredAt ? new Date(metadata.deliveredAt) : null;
        const deliveredAt = deliveredAtDate && !Number.isNaN(deliveredAtDate.getTime())
          ? ` le ${deliveredAtDate.toLocaleDateString('fr-FR')}`
          : '';
        message = `${actorName} a marqué la commande ${orderId} comme livrée${address}${city}${deliveredAt}. Merci pour votre confiance.`;
        break;
      }
      default:
        message = `${actorName} a interagi avec votre annonce${productLabel}.`;
    }

    const isNew = !notification.readAt;
    const parent =
      notification.type === 'reply' && metadata.parentMessage
        ? { message: metadata.parentMessage }
        : null;

    return {
      _id: notification._id,
      type: notification.type,
      message,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      readAt: notification.readAt,
      product,
      user: actor,
      actor,
      shop: shopInfo,
      metadata,
      parent,
      isNew
    };
  });

  const unreadCount = alerts.filter((alert) => alert.isNew).length;
  const preferences = mergeNotificationPreferences(userDoc.notificationPreferences);

  res.json({
    commentAlerts: unreadCount,
    unreadCount,
    preferences,
    alerts
  });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const { notificationIds } = req.body || {};
  const now = new Date();

  if (Array.isArray(notificationIds) && notificationIds.length) {
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds }, user: req.user.id, readAt: null },
      { $set: { readAt: now } }
    );
    return res.json({ success: true, updated: result.modifiedCount });
  }

  await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: now } });

  const user = await User.findById(req.user.id);
  if (user) {
    user.notificationsReadAt = now;
    await user.save();
  }

  res.json({ success: true, readAt: now });
});

export const streamNotifications = (req, res) => {
  registerNotificationStream(req.user.id, res);
};

export const getNotificationPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('notificationPreferences');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json({ preferences: mergeNotificationPreferences(user.notificationPreferences) });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const updates = {};
  Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates[`notificationPreferences.${key}`] = Boolean(req.body[key]);
    }
  });

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'Aucune préférence à mettre à jour.' });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updates },
    { new: true, select: 'notificationPreferences' }
  );
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  res.json({ preferences: mergeNotificationPreferences(user.notificationPreferences) });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const deleted = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id
  });
  if (!deleted) {
    return res.status(404).json({ message: 'Notification introuvable.' });
  }
  res.json({ success: true });
});

export const getFavorites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('favorites');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const favoriteIds = user.favorites || [];
  if (!favoriteIds.length) {
    return res.json([]);
  }

  const productsRaw = await Product.find({
    _id: { $in: favoriteIds },
    status: { $ne: 'disabled' }
  })
    .lean()
    .exec();

  const productIds = productsRaw.map((item) => item._id);

  let commentStats = [];
  let ratingStats = [];
  if (productIds.length) {
    commentStats = await Comment.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: '$product', count: { $sum: 1 } } }
    ]);

    ratingStats = await Rating.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: '$product', average: { $avg: '$value' }, count: { $sum: 1 } } }
    ]);
  }

  const commentMap = new Map(commentStats.map((stat) => [String(stat._id), stat.count]));
  const ratingMap = new Map(
    ratingStats.map((stat) => [
      String(stat._id),
      { average: Number(stat.average?.toFixed(2) ?? 0), count: stat.count }
    ])
  );

  const orderMap = new Map(favoriteIds.map((id, index) => [String(id), index]));

  const items = productsRaw
    .map((item) => {
      const commentCount = commentMap.get(String(item._id)) || 0;
      const rating = ratingMap.get(String(item._id)) || { average: 0, count: 0 };
      return {
        ...item,
        commentCount,
        ratingAverage: rating.average,
        ratingCount: rating.count
      };
    })
    .sort((a, b) => {
      const ai = orderMap.get(String(a._id)) ?? 0;
      const bi = orderMap.get(String(b._id)) ?? 0;
      return ai - bi;
    });

  res.json(items);
});

export const addFavorite = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ message: 'Product ID requis.' });
  }

  const product = await Product.findOne({ _id: productId, status: { $ne: 'disabled' } }).select(
    '_id user title'
  );
  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable ou désactivé.' });
  }

  const user = await User.findById(req.user.id).select('favorites');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const exists = user.favorites.some((fav) => fav.toString() === productId);
  if (!exists) {
    user.favorites.unshift(productId);
    await Promise.all([
      user.save(),
      Product.findByIdAndUpdate(productId, { $inc: { favoritesCount: 1 } }).exec()
    ]);

    if (product.user && String(product.user) !== req.user.id) {
      await createNotification({
        userId: product.user,
        actorId: req.user.id,
        productId: product._id,
        type: 'favorite',
        metadata: {
          productTitle: product.title || ''
        }
      });
    }
  }

  res.json({ favorites: user.favorites });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(req.user.id).select('favorites');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const before = user.favorites.length;
  user.favorites = user.favorites.filter((fav) => fav.toString() !== id);
  if (user.favorites.length !== before) {
    await Promise.all([
      user.save(),
      Product.findOneAndUpdate(
        { _id: id, favoritesCount: { $gt: 0 } },
        { $inc: { favoritesCount: -1 } }
      ).exec()
    ]);
  }

  res.json({ favorites: user.favorites });
});
