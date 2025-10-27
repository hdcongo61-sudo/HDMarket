import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';
import Rating from '../models/ratingModel.js';

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
  const [products, viewer] = await Promise.all([
    Product.find({ user: req.user.id }).select('_id title'),
    User.findById(req.user.id).select('notificationsReadAt')
  ]);

  const productIds = products.map((p) => p._id);
  const alertsMap = new Map();
  const lastRead = viewer?.notificationsReadAt ? new Date(viewer.notificationsReadAt) : new Date(0);

  const addAlert = (type, commentDoc) => {
    const key = commentDoc._id.toString();
    if (alertsMap.has(key)) return;
    const product = commentDoc.product
      ? { _id: commentDoc.product._id, title: commentDoc.product.title }
      : null;
    const user = commentDoc.user
      ? { _id: commentDoc.user._id, name: commentDoc.user.name, email: commentDoc.user.email }
      : null;
    const parent = commentDoc.parent
      ? {
          _id: commentDoc.parent._id,
          message: commentDoc.parent.message,
          user: commentDoc.parent.user
            ? {
                _id: commentDoc.parent.user._id,
                name: commentDoc.parent.user.name,
                email: commentDoc.parent.user.email
              }
            : null
        }
      : null;
    const createdAt = new Date(commentDoc.createdAt);

    alertsMap.set(key, {
      _id: commentDoc._id,
      type,
      message: commentDoc.message,
      createdAt: commentDoc.createdAt,
      product,
      user,
      parent,
      isNew: createdAt > lastRead
    });
  };

  if (productIds.length) {
    const productComments = await Comment.find({
      product: { $in: productIds },
      user: { $ne: req.user.id }
    })
      .populate('user', 'name email')
      .populate('product', 'title')
      .populate({
        path: 'parent',
        select: 'message user',
        populate: { path: 'user', select: 'name email' }
      });

    productComments.forEach((comment) => addAlert('product_comment', comment));
  }

  const userComments = await Comment.find({ user: req.user.id }).select('_id');
  const parentIds = userComments.map((c) => c._id);

  if (parentIds.length) {
    const replies = await Comment.find({
      parent: { $in: parentIds },
      user: { $ne: req.user.id }
    })
      .populate('user', 'name email')
      .populate('product', 'title')
      .populate({
        path: 'parent',
        select: 'message user',
        populate: { path: 'user', select: 'name email' }
      });

    replies.forEach((comment) => addAlert('reply', comment));
  }

  const alerts = Array.from(alertsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json({
    commentAlerts: alerts.filter((alert) => alert.isNew).length,
    alerts: alerts.slice(0, 50)
  });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  user.notificationsReadAt = new Date();
  await user.save();
  res.json({ success: true, notificationsReadAt: user.notificationsReadAt });
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

  const product = await Product.findOne({ _id: productId, status: { $ne: 'disabled' } })
    .select('_id')
    .lean();
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
