import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';
import User from '../models/userModel.js';
import ProhibitedWord from '../models/prohibitedWordModel.js';
import { createNotification } from '../utils/notificationService.js';
import {
  uploadToCloudinary,
  getCloudinaryFolder,
  isCloudinaryConfigured
} from '../utils/cloudinaryUploader.js';
import { buildIdentifierQuery } from '../utils/idResolver.js';
import { ensureDocumentSlug } from '../utils/slugUtils.js';

const MAX_PRODUCT_IMAGES = 3;
const SHOP_SELECT_FIELDS =
  'name phone accountType shopName shopAddress shopLogo city country shopVerified isBlocked slug';

const ensureProductSlug = async (productDoc) => {
  if (!productDoc) return null;
  if (productDoc.slug) return productDoc;
  await ensureDocumentSlug({ document: productDoc, sourceValue: productDoc.title });
  return productDoc;
};

const isVideoFile = (mimetype) => typeof mimetype === 'string' && mimetype.startsWith('video/');

const getProductMediaFolder = (resourceType) =>
  getCloudinaryFolder(['products', resourceType === 'video' ? 'videos' : 'images']);

const uploadProductMedia = async (file) => {
  const resourceType = isVideoFile(file.mimetype) ? 'video' : 'image';
  const folder = getProductMediaFolder(resourceType);
  const uploaded = await uploadToCloudinary({
    buffer: file.buffer,
    resourceType,
    folder
  });
  return uploaded.secure_url || uploaded.url;
};

const getUploadedFiles = (files, fieldName) => {
  if (!files) return [];
  if (fieldName && Array.isArray(files[fieldName])) return files[fieldName];
  if (!fieldName && Array.isArray(files)) return files;
  return [];
};

const detectProhibitedWords = async (title = '', description = '') => {
  const combined = `${title || ''} ${description || ''}`.toLowerCase();
  if (!combined.trim()) return [];
  const words = await ProhibitedWord.find().lean();
  const matches = new Set();
  words.forEach((entry) => {
    const candidate = (entry?.word || '').toLowerCase().trim();
    if (!candidate) return;
    if (combined.includes(candidate)) {
      matches.add(candidate);
    }
  });
  return Array.from(matches);
};

const getBlockedSellerIdsSet = async () => {
  const blockedUsers = await User.find({ isBlocked: true }).select('_id').lean();
  if (!blockedUsers.length) return new Set();
  return new Set(blockedUsers.map((user) => String(user._id)));
};

const applyBlockedUsersToFilter = (baseFilter = {}, blockedSet) => {
  if (!blockedSet.size) return baseFilter;
  const filterCopy = { ...baseFilter };
  const existingUserFilter = filterCopy.user || {};
  const hasUserConditions = Object.keys(existingUserFilter).length > 0;

  if (!hasUserConditions) {
    filterCopy.user = { $nin: Array.from(blockedSet) };
    return filterCopy;
  }

  if (existingUserFilter.$nin) {
    filterCopy.user = {
      ...existingUserFilter,
      $nin: Array.from(new Set([...existingUserFilter.$nin, ...Array.from(blockedSet)]))
    };
  } else if (existingUserFilter.$in) {
    const allowed = existingUserFilter.$in.filter((value) => !blockedSet.has(String(value)));
    filterCopy.user = { ...existingUserFilter, $in: allowed };
  } else {
    filterCopy.user = {
      ...existingUserFilter,
      $nin: Array.from(blockedSet)
    };
  }

  return filterCopy;
};

export const createProduct = asyncHandler(async (req, res) => {
  const { title, description, price, category, discount, condition } = req.body;
  if (!title || !description || !price || !category)
    return res.status(400).json({ message: 'Missing fields' });

  const prohibitedMatches = await detectProhibitedWords(title, description);
  if (prohibitedMatches.length) {
    return res.status(400).json({
      message: `Votre annonce contient des mots interdits (${prohibitedMatches.join(
        ', '
      )}). Veuillez les retirer avant de publier.`
    });
  }

  const priceValue = Number(price);
  if (Number.isNaN(priceValue)) {
    return res.status(400).json({ message: 'Invalid price value' });
  }

  let discountValue = discount !== undefined && discount !== null ? Number(discount) : 0;
  if (Number.isNaN(discountValue) || discountValue < 0 || discountValue >= 100) {
    return res.status(400).json({ message: 'Discount must be between 0 and 100' });
  }

  let finalPrice = priceValue;
  let priceBeforeDiscount;

  if (discountValue > 0) {
    priceBeforeDiscount = priceValue;
    finalPrice = Number((priceValue * (1 - discountValue / 100)).toFixed(2));
  }

  const resolvedCondition = (condition || 'used').toString().toLowerCase();
  const safeCondition = resolvedCondition === 'new' ? 'new' : 'used';
  const seller =
    (await User.findById(req.user.id).select('city country shopVerified accountType')) || null;
  if (!seller) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }
  const ownerCity = seller.city || 'Brazzaville';
  const ownerCountry = seller.country || 'République du Congo';
  const isVerifiedShop = seller.accountType === 'shop' && Boolean(seller.shopVerified);

  const imageFiles = getUploadedFiles(req.files, 'images');
  const videoFiles = getUploadedFiles(req.files, 'video');

  if (imageFiles.length > MAX_PRODUCT_IMAGES) {
    return res.status(400).json({
      message: `Vous pouvez télécharger jusqu'à ${MAX_PRODUCT_IMAGES} photos par annonce.`
    });
  }

  if (videoFiles.length > 1) {
    return res.status(400).json({
      message: 'Vous ne pouvez importer qu’une seule vidéo par annonce.'
    });
  }

  if (videoFiles.length && !isVerifiedShop) {
    return res.status(403).json({
      message: 'Seules les boutiques certifiées peuvent ajouter une vidéo produit.'
    });
  }

  if (!isCloudinaryConfigured() && (imageFiles.length || videoFiles.length)) {
    return res
      .status(503)
      .json({ message: 'Cloudinary n’est pas configuré. Définissez CLOUDINARY_* pour publier des médias.' });
  }

  let images = [];
  try {
    if (imageFiles.length) {
      images = await Promise.all(imageFiles.map(uploadProductMedia));
    }
  } catch (error) {
    console.error('Erreur upload images produit', error);
    return res.status(500).json({ message: 'Erreur lors de l’upload des images.' });
  }

  let videoUrl;
  if (videoFiles.length) {
    const [videoFile] = videoFiles;
    if (!isVideoFile(videoFile.mimetype)) {
      return res.status(400).json({ message: 'Le fichier doit être une vidéo valide.' });
    }
    try {
      videoUrl = await uploadProductMedia(videoFile);
    } catch (error) {
      console.error('Erreur upload vidéo produit', error);
      return res.status(500).json({ message: 'Erreur lors de l’upload de la vidéo.' });
    }
  }

  const product = await Product.create({
    title,
    description,
    price: finalPrice,
    category,
    discount: discountValue,
    condition: safeCondition,
    priceBeforeDiscount,
    images,
    video: videoUrl,
    user: req.user.id,
    status: 'pending',
    city: ownerCity,
    country: ownerCountry
  });

  res.status(201).json(product);
});

export const getPublicProducts = asyncHandler(async (req, res) => {
  const {
    q,
    category,
    minPrice,
    maxPrice,
    city: cityParam,
    certified,
    sort = 'new',
    page = 1,
    limit = 12
  } = req.query;

  const filter = { status: 'approved' };
  if (certified === 'true') {
    filter.certified = true;
  } else if (certified === 'false') {
    filter.certified = false;
  }

  if (req.query?.boosted === 'true') {
    filter.boosted = true;
  }

  if (q) {
    const matcher = new RegExp(q.trim(), 'i');
    filter.$or = [{ title: matcher }, { description: matcher }];
  }

  if (category) {
    filter.category = new RegExp(`^${category.trim()}$`, 'i');
  }

  if (cityParam) {
    const normalizedCity = cityParam.trim();
    if (['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'].includes(normalizedCity)) {
      filter.city = normalizedCity;
    }
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  const sortOptions = {
    new: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    discount: { discount: -1, createdAt: -1 }
  };

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 12));
  const skip = (pageNumber - 1) * pageSize;

  if (sort === 'discount') {
    filter.discount = { $gt: 0 };
  }

  const blockedSellerIds = await getBlockedSellerIdsSet();
  const activeFilter = applyBlockedUsersToFilter(filter, blockedSellerIds);
  const baseSort = { boosted: -1, boostScore: -1 };
  const [itemsRaw, total] = await Promise.all([
    Product.find(activeFilter)
      .sort({ ...baseSort, ...(sortOptions[sort] || sortOptions.new) })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Product.countDocuments(activeFilter)
  ]);

  await Product.populate(itemsRaw, { path: 'user', select: SHOP_SELECT_FIELDS });

  const productIds = itemsRaw.map((item) => item._id);

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

  const items = itemsRaw.map((item) => {
    const commentCount = commentMap.get(String(item._id)) || 0;
    const rating = ratingMap.get(String(item._id)) || { average: 0, count: 0 };
    return {
      ...item,
      commentCount,
      ratingAverage: rating.average,
      ratingCount: rating.count
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: totalPages
    }
  });
});

export const getPublicHighlights = asyncHandler(async (req, res) => {
  const limitParam = Number(req.query?.limit);
  const limit = Math.max(1, Math.min(Number.isFinite(limitParam) ? limitParam : 6, 60));

  const baseFilter = { status: 'approved' };
  const blockedSellerIds = await getBlockedSellerIdsSet();
  const activeBaseFilter = applyBlockedUsersToFilter(baseFilter, blockedSellerIds);

  const favoritesRaw = await Product.find(activeBaseFilter)
    .sort({ favoritesCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  const dealsRaw = await Product.find(activeBaseFilter)
    .sort({ price: 1, createdAt: -1 })
    .limit(limit)
    .lean();

  const discountRaw = await Product.find({ ...activeBaseFilter, discount: { $gt: 0 } })
    .sort({ discount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  const newRaw = await Product.find({ ...activeBaseFilter, condition: 'new' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const usedRaw = await Product.find({ ...activeBaseFilter, condition: 'used' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const topRatingStats = await Rating.aggregate([
    { $group: { _id: '$product', average: { $avg: '$value' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 0 } } },
    { $sort: { average: -1, count: -1 } },
    { $limit: limit * 5 }
  ]);

  const cityList = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
  const cityProductsRaw = await Product.find({ ...activeBaseFilter, city: { $in: cityList } })
    .sort({ createdAt: -1 })
    .limit(limit * cityList.length)
    .lean();

  const ratingCandidateIds = topRatingStats.map((stat) => stat._id);
  let ratingProductsRaw = [];
  if (ratingCandidateIds.length) {
    const ratingFilter = applyBlockedUsersToFilter(
      { _id: { $in: ratingCandidateIds }, status: 'approved' },
      blockedSellerIds
    );
    ratingProductsRaw = await Product.find(ratingFilter).lean();
  }

  const ratingProductMap = new Map(ratingProductsRaw.map((doc) => [String(doc._id), doc]));
  const topRatedRaw = [];
  for (const stat of topRatingStats) {
    const product = ratingProductMap.get(String(stat._id));
    if (product) {
      topRatedRaw.push(product);
      if (topRatedRaw.length >= limit) break;
    }
  }

  const combinedMap = new Map();
  const pushUnique = (doc) => {
    if (doc) combinedMap.set(String(doc._id), doc);
  };

  favoritesRaw.forEach(pushUnique);
  topRatedRaw.forEach(pushUnique);
  dealsRaw.forEach(pushUnique);
  discountRaw.forEach(pushUnique);
  newRaw.forEach(pushUnique);
  usedRaw.forEach(pushUnique);
  cityProductsRaw.forEach(pushUnique);
  const combinedDocs = Array.from(combinedMap.values());
  await Product.populate(combinedDocs, { path: 'user', select: SHOP_SELECT_FIELDS });

  const productIds = combinedDocs.map((doc) => doc._id);

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

  const serialize = (doc) => {
    const idStr = String(doc._id);
    const rating = ratingMap.get(idStr) || { average: 0, count: 0 };
    return {
      ...doc,
      commentCount: commentMap.get(idStr) || 0,
      ratingAverage: rating.average,
      ratingCount: rating.count
    };
  };

  const favorites = favoritesRaw.map(serialize);
  const topRated = topRatedRaw.map(serialize);
  const topDeals = dealsRaw
    .map(serialize)
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    .slice(0, limit);
  const topDiscounts = discountRaw.map(serialize).slice(0, limit);
  const newProducts = newRaw.map(serialize).slice(0, limit);
  const usedProducts = usedRaw.map(serialize).slice(0, limit);
  const cityHighlights = Object.fromEntries(cityList.map((city) => [city, []]));
  const cityLimit = Math.min(limit, 12);

  cityProductsRaw.forEach((doc) => {
    const city = doc.city;
    if (!city || !cityHighlights[city] || cityHighlights[city].length >= cityLimit) return;
    cityHighlights[city].push(serialize(doc));
  });

  res.json({ favorites, topRated, topDeals, topDiscounts, newProducts, usedProducts, cityHighlights });
});

export const getPublicProductById = asyncHandler(async (req, res) => {
  const query = buildIdentifierQuery(req.params.id);
  const productDoc = await Product.findOne(query)
    .select('-payment')
    .populate('user', SHOP_SELECT_FIELDS);
  await ensureProductSlug(productDoc);
  if (!productDoc || productDoc.status !== 'approved') {
    return res.status(404).json({ message: 'Produit introuvable ou non publié.' });
  }

  if (productDoc.user?.isBlocked) {
    return res.status(403).json({ message: 'Ce vendeur a été suspendu. Cette annonce n’est plus accessible.' });
  }

  const [commentCount, ratingData] = await Promise.all([
    Comment.countDocuments({ product: productDoc._id }),
    Rating.aggregate([
      { $match: { product: productDoc._id } },
      { $group: { _id: '$product', average: { $avg: '$value' }, count: { $sum: 1 } } }
    ])
  ]);

  const rating = ratingData[0]
    ? { average: Number(ratingData[0].average?.toFixed(2) ?? 0), count: ratingData[0].count }
    : { average: 0, count: 0 };

  const product = productDoc.toObject();
  product.commentCount = commentCount;
  product.ratingAverage = rating.average;
  product.ratingCount = rating.count;

  res.json(product);
});

export const getMyProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ user: req.user.id })
    .populate('payment')
    .sort('-createdAt');
  res.json(products);
});

export const getAllProductsAdmin = asyncHandler(async (req, res) => {
  const { status } = req.query; // optional filter
  const query = status ? { status } : {};
  const products = await Product.find(query)
    .populate('user', `name email phone accountType shopName shopAddress shopLogo city country shopVerified slug`)
    .populate('payment');
  res.json(products);
});

export const listAdminProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    category,
    certified,
    search,
    sort = 'recent'
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = new RegExp(`^${category.trim()}$`, 'i');
  if (certified === 'true') filter.certified = true;
  else if (certified === 'false') filter.certified = false;
  if (search) {
    const matcher = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: matcher }, { description: matcher }];
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 20));
  const skip = (pageNumber - 1) * pageSize;

  const sortOptions = {
    recent: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    discount: { discount: -1, createdAt: -1 }
  };

  const usersProjection =
    'name email phone accountType shopName shopAddress shopLogo city country shopVerified slug';

  const [items, filteredTotal, statusCountsRaw, certifiedCount, overallTotal, topCategoriesRaw] =
    await Promise.all([
      Product.find(filter)
        .sort(sortOptions[sort] || sortOptions.recent)
        .skip(skip)
        .limit(pageSize)
        .populate('user', usersProjection)
        .populate('payment')
        .populate('certifiedBy', 'name email')
        .lean(),
      Product.countDocuments(filter),
      Product.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Product.countDocuments({ certified: true }),
      Product.countDocuments(),
      Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ])
    ]);

  const statusCounts = statusCountsRaw.reduce((acc, entry) => {
    if (!entry?._id) return acc;
    acc[entry._id] = entry.count;
    return acc;
  }, {});

  const stats = {
    totalProducts: overallTotal,
    statusCounts,
    certifiedCount,
    uncertifiedCount: Math.max(0, overallTotal - certifiedCount),
    topCategories: topCategoriesRaw
      .filter((entry) => entry && entry._id)
      .map((entry) => ({ category: entry._id, count: entry.count }))
  };

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total: filteredTotal,
      pages: Math.max(1, Math.ceil(filteredTotal / pageSize))
    },
    stats
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const query = buildIdentifierQuery(req.params.id);
  const product = await Product.findOne(query);
  await ensureProductSlug(product);
  if (!product) return res.status(404).json({ message: 'Not found' });
  const isModerator = ['admin', 'manager'].includes(req.user.role);

  if (product.status === 'disabled' && product.user.toString() !== req.user.id && !isModerator) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const query = buildIdentifierQuery(req.params.id);
  const product = await Product.findOne(query);
  await ensureProductSlug(product);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });

  const seller =
    (await User.findById(req.user.id).select('shopVerified accountType')) || null;
  const isVerifiedShop = seller?.accountType === 'shop' && Boolean(seller?.shopVerified);
  if (!seller) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }

  const titleToCheck = typeof req.body.title === 'string' ? req.body.title : product.title;
  const descriptionToCheck =
    typeof req.body.description === 'string' ? req.body.description : product.description;
  const prohibitedMatches = await detectProhibitedWords(titleToCheck, descriptionToCheck);
  if (prohibitedMatches.length) {
    return res.status(400).json({
      message: `Votre annonce contient des mots interdits (${prohibitedMatches.join(
        ', '
      )}). Veuillez les retirer avant de mettre à jour.`
    });
  }

  const previousDiscount = Number(product.discount || 0);
  const { title, description, category, discount, condition } = req.body;
  if (title) product.title = title;
  if (description) product.description = description;
  if (category) product.category = category;

  let promotionApplied = false;
  if (discount !== undefined) {
    const parsed = Number(discount);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= 100) {
      return res.status(400).json({ message: 'Discount must be between 0 and 100' });
    }
    const basePrice = product.priceBeforeDiscount ?? product.price;
    if (parsed > 0) {
      product.priceBeforeDiscount = basePrice;
      product.price = Number((basePrice * (1 - parsed / 100)).toFixed(2));
      product.discount = parsed;
      if (parsed !== previousDiscount) {
        promotionApplied = true;
      }
    } else {
      product.price = basePrice;
      product.priceBeforeDiscount = undefined;
      product.discount = 0;
    }
  }

  if (condition) {
    const normalized = condition.toString().toLowerCase();
    if (normalized === 'new' || normalized === 'used') {
      product.condition = normalized;
    }
  }

  const removeImagesRaw = req.body?.removeImages;
  const removeImagesList = Array.isArray(removeImagesRaw)
    ? removeImagesRaw
    : removeImagesRaw
    ? [removeImagesRaw]
    : [];
  if (removeImagesList.length) {
    const removeSet = new Set(removeImagesList);
    const currentImages = Array.isArray(product.images) ? product.images : [];
    product.images = currentImages.filter((image) => !removeSet.has(image));
  }

  const imageFiles = getUploadedFiles(req.files, 'images');
  const videoFiles = getUploadedFiles(req.files, 'video');
  const hasUploads = imageFiles.length + videoFiles.length > 0;

  if (videoFiles.length > 1) {
    return res.status(400).json({
      message: 'Vous ne pouvez importer qu’une seule vidéo par annonce.'
    });
  }

  if (videoFiles.length && !isVerifiedShop) {
    return res.status(403).json({
      message: 'Seules les boutiques certifiées peuvent ajouter une vidéo produit.'
    });
  }

  if (hasUploads && !isCloudinaryConfigured()) {
    return res
      .status(503)
      .json({ message: 'Cloudinary n’est pas configuré. Définissez CLOUDINARY_* pour publier des médias.' });
  }

  if (imageFiles.length) {
    const existingImages = Array.isArray(product.images) ? product.images : [];
    const remainingSlots = MAX_PRODUCT_IMAGES - existingImages.length;
    if (remainingSlots <= 0) {
      return res.status(400).json({
        message: `Nombre maximal de photos atteint (${MAX_PRODUCT_IMAGES}).`
      });
    }
    if (imageFiles.length > remainingSlots) {
      return res.status(400).json({
        message: `Vous ne pouvez ajouter que ${remainingSlots} photo(s) supplémentaire(s).`
      });
    }
    try {
      const uploaded = await Promise.all(imageFiles.map(uploadProductMedia));
      product.images = [...existingImages, ...uploaded];
    } catch (error) {
      console.error('Erreur upload images produit', error);
      return res.status(500).json({ message: 'Erreur lors de l’upload des images.' });
    }
  }

  if (req.body?.removeVideo === 'true') {
    product.video = undefined;
  }

  if (videoFiles.length) {
    const [videoFile] = videoFiles;
    if (!isVideoFile(videoFile.mimetype)) {
      return res.status(400).json({ message: 'Le fichier doit être une vidéo valide.' });
    }
    try {
      product.video = await uploadProductMedia(videoFile);
    } catch (error) {
      console.error('Erreur upload vidéo produit', error);
      return res.status(500).json({ message: 'Erreur lors de l’upload de la vidéo.' });
    }
  }

  await product.save();

  if (promotionApplied && product.discount > 0) {
    await createNotification({
      userId: product.user,
      actorId: req.user.id,
      productId: product._id,
      type: 'promotional',
      metadata: {
        discount: product.discount
      },
      allowSelf: String(product.user) === req.user.id
    });

    const followers = await User.find({ favorites: product._id })
      .select('_id')
      .lean();

    if (followers.length) {
      const ops = followers
        .filter((follower) => String(follower._id) !== String(req.user.id))
        .map((follower) =>
          createNotification({
            userId: follower._id,
            actorId: req.user.id,
            productId: product._id,
            type: 'promotional',
            metadata: {
              discount: product.discount,
              productTitle: product.title || ''
            }
          })
        );
      if (ops.length) {
        await Promise.all(ops);
      }
    }
  }

  res.json(product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const query = buildIdentifierQuery(req.params.id);
  const product = await Product.findOne(query);
  await ensureProductSlug(product);
  if (!product) return res.status(404).json({ message: 'Not found' });
  if (product.user.toString() !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Forbidden' });
  await product.deleteOne();
  res.json({ message: 'Deleted' });
});

export const disableProduct = asyncHandler(async (req, res) => {
  const query = buildIdentifierQuery(req.params.id);
  const product = await Product.findOne(query);
  await ensureProductSlug(product);
  if (!product) return res.status(404).json({ message: 'Not found' });
  const isModerator = ['admin', 'manager'].includes(req.user.role);
  if (product.user.toString() !== req.user.id && !isModerator)
    return res.status(403).json({ message: 'Forbidden' });

  if (product.status !== 'disabled') {
    product.lastStatusBeforeDisable = product.status;
  }
  product.status = 'disabled';
  product.disabledByAdmin = isModerator;
  product.disabledBySuspension = false;
  await product.save();
  res.json(product);
});

export const enableProduct = asyncHandler(async (req, res) => {
  const query = buildIdentifierQuery(req.params.id);
  const product = await Product.findOne(query).populate('payment', 'status');
  await ensureProductSlug(product);
  if (!product) return res.status(404).json({ message: 'Not found' });
  const isModerator = ['admin', 'manager'].includes(req.user.role);
  if (product.user.toString() !== req.user.id && !isModerator)
    return res.status(403).json({ message: 'Forbidden' });

  if (product.disabledByAdmin && !isModerator) {
    return res
      .status(403)
      .json({
        message:
          'Cette annonce a été désactivée par l\'administration. Merci de contacter un administrateur pour la réactiver.'
      });
  }

  const paymentStatus = product.payment?.status || null;
  let restoredStatus = product.lastStatusBeforeDisable;

  if (paymentStatus === 'verified') {
    restoredStatus = 'approved';
  } else if (!restoredStatus) {
    restoredStatus = paymentStatus ? 'pending' : 'approved';
  }

  if (restoredStatus === 'disabled' || !restoredStatus) {
    restoredStatus = 'approved';
  }

  product.status = restoredStatus;
  product.lastStatusBeforeDisable = null;
  product.disabledByAdmin = false;
  product.disabledBySuspension = false;
  await product.save();
  res.json(product);
});

export const listBoostProductCandidatesAdmin = asyncHandler(async (req, res) => {
  const {
    q,
    page = 1,
    limit = 12,
    category,
    sort = 'boosted'
  } = req.query;
  const filter = { status: 'approved' };
  const boostedFilter = req.query.boosted;

  if (q) {
    const matcher = new RegExp(q.trim(), 'i');
    filter.$or = [{ title: matcher }, { description: matcher }];
  }
  if (category) filter.category = new RegExp(`^${category.trim()}$`, 'i');
  if (boostedFilter !== undefined) {
    if (boostedFilter === 'true' || boostedFilter === true) {
      filter.boosted = true;
    } else if (boostedFilter === 'false' || boostedFilter === false) {
      filter.boosted = false;
    }
  }

  const sortOptions = {
    boosted: { boosted: -1, boostScore: -1, createdAt: -1 },
    recent: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 }
  };

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 12));
  const skip = (pageNumber - 1) * pageSize;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOptions[sort] || sortOptions.boosted)
      .skip(skip)
      .limit(pageSize)
      .populate('user', 'shopName name shopVerified slug')
      .lean(),
    Product.countDocuments(filter)
  ]);

  res.json({
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

export const toggleProductBoost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant produit invalide.' });
  }
  const product = await Product.findById(id);
  if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
  product.boosted = !product.boosted;
  product.boostScore = product.boosted ? Date.now() : 0;
  await product.save();
  res.json({
    _id: product._id,
    boosted: product.boosted,
    boostScore: product.boostScore
  });
});

export const certifyProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Seuls les administrateurs peuvent certifier les produits.' });
  }
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Identifiant produit invalide.' });
  }
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable.' });
  }

  const shouldCertify = Boolean(req.body.certified);
  product.certified = shouldCertify;
  product.certifiedBy = shouldCertify ? req.user.id : null;
  product.certifiedAt = shouldCertify ? new Date() : null;
  await product.save();
  await product.populate('certifiedBy', 'name email');
  await createNotification({
    userId: product.user,
    actorId: req.user.id,
    productId: product._id,
    type: 'product_certified',
    metadata: {
      certified: shouldCertify
    }
  });

  res.json({
    _id: product._id,
    certified: product.certified,
    certifiedBy: product.certifiedBy,
    certifiedAt: product.certifiedAt
  });
});

export const registerWhatsappClick = asyncHandler(async (req, res) => {
  const query = {
    ...buildIdentifierQuery(req.params.id),
    status: { $ne: 'disabled' }
  };
  const product = await Product.findOneAndUpdate(
    query,
    { $inc: { whatsappClicks: 1 } },
    { new: true, select: '_id whatsappClicks' }
  );

  if (!product) {
    return res.status(404).json({ message: 'Produit introuvable ou désactivé.' });
  }

  res.json({ whatsappClicks: product.whatsappClicks });
});
