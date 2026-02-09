import asyncHandler from 'express-async-handler';
import ShopConversionRequest from '../models/shopConversionRequestModel.js';
import User from '../models/userModel.js';
import { uploadToCloudinary } from '../utils/cloudinaryUploader.js';
import { createNotification } from '../utils/notificationService.js';

/**
 * Create a shop conversion request (for particulier users only)
 */
export const createShopConversionRequest = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  // Only allow non-shop users to create requests
  if (user.accountType === 'shop') {
    return res.status(400).json({
      message: 'Les boutiques ne peuvent pas faire une demande de conversion.'
    });
  }

  // Check if user already has a pending request
  const existingPending = await ShopConversionRequest.findOne({
    user: user._id,
    status: 'pending'
  });
  if (existingPending) {
    return res.status(400).json({
      message: 'Vous avez déjà une demande en attente de traitement.'
    });
  }

  const { shopName, shopAddress, shopDescription, paymentAmount, operator, transactionName, transactionNumber } = req.body;

  // Validate required fields
  if (!shopName || !shopName.trim()) {
    return res.status(400).json({ message: 'Le nom de la boutique est requis.' });
  }
  if (!shopAddress || !shopAddress.trim()) {
    return res.status(400).json({ message: "L'adresse de la boutique est requise." });
  }
  if (!transactionName || !transactionName.trim()) {
    return res.status(400).json({ message: 'Le nom de la transaction est requis.' });
  }
  if (!transactionNumber || !transactionNumber.trim()) {
    return res.status(400).json({ message: 'Le numéro de transaction est requis.' });
  }

  // Validate transaction number (10 digits)
  const digitsOnly = transactionNumber.replace(/\D/g, '');
  if (digitsOnly.length !== 10) {
    return res.status(400).json({ message: 'Le numéro de transaction doit contenir exactement 10 chiffres.' });
  }

  // Validate operator
  if (!operator || !['MTN', 'Airtel'].includes(operator)) {
    return res.status(400).json({ message: 'Veuillez sélectionner un opérateur (MTN ou Airtel).' });
  }

  // Validate payment amount (should be 50000)
  const amount = Number(paymentAmount) || 0;
  if (amount !== 50000) {
    return res.status(400).json({ message: 'Le montant du paiement doit être de 50.000 FCFA.' });
  }

  // Handle logo upload
  let shopLogoUrl = '';
  const logoFile = req.files?.shopLogo?.[0] || req.file || null;
  if (logoFile) {
    try {
      const uploaded = await uploadToCloudinary({
        buffer: logoFile.buffer,
        resourceType: 'image',
        folder: 'shop-conversions/logos'
      });
      shopLogoUrl = uploaded.secure_url || uploaded.url;
    } catch (error) {
      console.error('Logo upload error:', error);
      return res.status(500).json({ message: 'Erreur lors de l\'upload du logo.' });
    }
  }

  // Handle payment proof upload
  let paymentProofUrl = '';
  const paymentProofFile = req.files?.paymentProof?.[0] || null;
  if (!paymentProofFile) {
    return res.status(400).json({ message: 'La preuve de paiement est requise.' });
  }
  try {
    const uploaded = await uploadToCloudinary({
      buffer: paymentProofFile.buffer,
      resourceType: 'image',
      folder: 'shop-conversions/payment-proofs'
    });
    paymentProofUrl = uploaded.secure_url || uploaded.url;
  } catch (error) {
    console.error('Payment proof upload error:', error);
    return res.status(500).json({ message: 'Erreur lors de l\'upload de la preuve de paiement.' });
  }

  // Create the request
  const request = await ShopConversionRequest.create({
    user: user._id,
    shopName: shopName.trim(),
    shopAddress: shopAddress.trim(),
    shopLogo: shopLogoUrl,
    shopDescription: (shopDescription || '').trim(),
    paymentProof: paymentProofUrl,
    paymentAmount: amount,
    operator: operator,
    transactionName: transactionName.trim(),
    transactionNumber: digitsOnly,
    status: 'pending'
  });

  // Notify all admins about the new conversion request
  try {
    const admins = await User.find({
      role: { $in: ['admin', 'manager'] }
    })
      .select('_id')
      .lean();

    const actorId = user._id;
    const metadata = {
      requestId: request._id.toString(),
      shopName: shopName.trim(),
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone
    };

    for (const admin of admins) {
      const adminId = admin._id.toString();
      if (adminId === actorId.toString()) continue;
      await createNotification({
        userId: admin._id,
        actorId: actorId,
        type: 'shop_conversion_request',
        metadata,
        allowSelf: false
      });
    }
  } catch (error) {
    console.error('Failed to send admin notifications for shop conversion request:', error);
    // Don't fail the request if notification fails
  }

  res.status(201).json({
    message: 'Demande de conversion en boutique soumise avec succès. Traitement sous 48h.',
    request: {
      _id: request._id,
      shopName: request.shopName,
      status: request.status,
      createdAt: request.createdAt
    }
  });
});

/**
 * Get user's shop conversion requests
 */
export const getUserShopConversionRequests = asyncHandler(async (req, res) => {
  const requests = await ShopConversionRequest.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .populate('processedBy', 'name email')
    .lean();

  res.json(requests);
});

/**
 * Get all shop conversion requests (admin only)
 */
export const getAllShopConversionRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    filter.status = status;
  }

  const requests = await ShopConversionRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email phone accountType')
    .populate('processedBy', 'name email')
    .lean();

  res.json(requests);
});

/**
 * Get a single shop conversion request (admin only)
 */
export const getShopConversionRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const request = await ShopConversionRequest.findById(id)
    .populate('user', 'name email phone accountType')
    .populate('processedBy', 'name email')
    .lean();

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }

  res.json(request);
});

/**
 * Approve a shop conversion request (admin only)
 */
export const approveShopConversionRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const request = await ShopConversionRequest.findById(id).populate('user');

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Cette demande a déjà été traitée.' });
  }

  const user = request.user;
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  // Update user account type
  user.accountType = 'shop';
  user.shopName = request.shopName;
  user.shopAddress = request.shopAddress;
  user.shopLogo = request.shopLogo || '';
  user.shopDescription = request.shopDescription || '';
  user.shopVerified = false; // Will need separate verification
  user.accountTypeChangedBy = req.user.id;
  user.accountTypeChangedAt = new Date();
  await user.save();

  // Update request status
  request.status = 'approved';
  request.processedBy = req.user.id;
  request.processedAt = new Date();
  await request.save();

  res.json({
    message: 'Demande approuvée. Le compte a été converti en boutique.',
    request
  });
});

/**
 * Reject a shop conversion request (admin only)
 */
export const rejectShopConversionRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  const request = await ShopConversionRequest.findById(id);

  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable.' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Cette demande a déjà été traitée.' });
  }

  request.status = 'rejected';
  request.processedBy = req.user.id;
  request.processedAt = new Date();
  request.rejectionReason = (rejectionReason || '').trim();
  await request.save();

  res.json({
    message: 'Demande rejetée.',
    request
  });
});
