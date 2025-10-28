import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';
import Rating from '../models/ratingModel.js';
import Notification from '../models/notificationModel.js';
import { registerNotificationStream } from '../utils/notificationEmitter.js';
import { createNotification } from '../utils/notificationService.js';

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountType: user.accountType,
  shopName: user.shopName,
  shopAddress: user.shopAddress,
  shopLogo: user.shopLogo,
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
    Product.find({ user: userId }).select('_id status favoritesCount').lean(),
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

  products.forEach((product) => {
    if (product?.status && Object.prototype.hasOwnProperty.call(listings, product.status)) {
      listings[product.status] += 1;
    }
    favoritesReceived += Number(product?.favoritesCount || 0);
  });

  const productIds = products.map((product) => product._id);

  let commentsReceived = 0;
  if (productIds.length) {
    commentsReceived = await Comment.countDocuments({ product: { $in: productIds } });
  }

  res.json({
    listings,
    engagement: {
      favoritesReceived,
      commentsReceived,
      favoritesSaved: userDoc?.favorites?.length || 0
    }
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  const { name, email, phone, password, accountType, shopName, shopAddress } = req.body;

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

  if (typeof shopName !== 'undefined') {
    user.shopName = shopName;
  }
  if (typeof shopAddress !== 'undefined') {
    user.shopAddress = shopAddress;
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
    if (req.file) {
      user.shopLogo = `${req.protocol}://${req.get('host')}/${req.file.path.replace('\\', '/')}`;
    } else if (!user.shopLogo) {
      return res.status(400).json({ message: 'Le logo de la boutique est requis.' });
    }
  } else {
    user.shopName = undefined;
    user.shopAddress = undefined;
    user.shopLogo = undefined;
  }

  if (password) user.password = password;

  await user.save();

  res.json(sanitizeUser(user));
});

export const getNotifications = asyncHandler(async (req, res) => {
  const [notifications, viewer] = await Promise.all([
    Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('product', 'title status')
      .populate('actor', 'name email'),
    User.findById(req.user.id).select('notificationsReadAt')
  ]);

  const lastRead = viewer?.notificationsReadAt ? new Date(viewer.notificationsReadAt) : new Date(0);

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
    const actorName = actor?.name || 'Un utilisateur';
    const productLabel = product?.title ? ` "${product.title}"` : '';
    const snippet =
      typeof metadata.message === 'string'
        ? metadata.message.length > 180
          ? `${metadata.message.slice(0, 177)}...`
          : metadata.message
        : '';

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
      default:
        message = `${actorName} a interagi avec votre annonce${productLabel}.`;
    }

    const isNew = notification.createdAt > lastRead;
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
      product,
      user: actor,
      actor,
      metadata,
      parent,
      isNew
    };
  });

  res.json({
    commentAlerts: alerts.filter((alert) => alert.isNew).length,
    alerts
  });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  user.notificationsReadAt = new Date();
  await user.save();
  res.json({ success: true, notificationsReadAt: user.notificationsReadAt });
});

export const streamNotifications = (req, res) => {
  registerNotificationStream(req.user.id, res);
};

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
