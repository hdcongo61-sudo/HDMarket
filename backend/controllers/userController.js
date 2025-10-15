import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Comment from '../models/commentModel.js';
import Product from '../models/productModel.js';

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
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

  const { name, email, phone, password } = req.body;

  if (email && email !== user.email) {
    const exists = await User.findOne({ email });
    if (exists && exists._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    user.email = email;
  }

  if (name) user.name = name;
  if (phone) user.phone = phone;
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
