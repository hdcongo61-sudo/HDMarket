import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

const genToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

export const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    role,
    accountType = 'person',
    shopName,
    shopAddress,
    city,
    address,
    gender,
    shopDescription
  } = req.body;
  if (!name || !email || !password || !phone || !city || !gender || !address?.trim()) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const shopDescriptionValue =
    shopDescription && typeof shopDescription === 'string'
      ? shopDescription.trim()
      : '';

  if (accountType === 'shop') {
    if (!shopName) {
      return res.status(400).json({ message: 'Le nom de la boutique est requis.' });
    }
    if (!shopAddress) {
      return res.status(400).json({ message: "L'adresse de la boutique est requise." });
    }
    if (!shopDescriptionValue) {
      return res.status(400).json({ message: 'La section À propos de la boutique est requise.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Le logo de la boutique est requis.' });
    }
  }
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already used' });
  const shopLogoUrl = req.file
    ? `${req.protocol}://${req.get('host')}/${req.file.path.replace('\\', '/')}`
    : undefined;
  const normalizedRole = role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'user';

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: normalizedRole,
    accountType: accountType === 'shop' ? 'shop' : 'person',
    shopName: accountType === 'shop' ? shopName : undefined,
    shopAddress: accountType === 'shop' ? shopAddress : undefined,
    shopLogo: accountType === 'shop' ? shopLogoUrl : undefined,
    shopDescription: accountType === 'shop' ? shopDescriptionValue : '',
    country: 'République du Congo',
    address: address.trim(),
    city,
    gender
  });
  const token = genToken(user);
  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountType: user.accountType,
    shopName: user.shopName || null,
    shopAddress: user.shopAddress || null,
    shopLogo: user.shopLogo || null,
    country: user.country,
    address: user.address || '',
    city: user.city,
    gender: user.gender,
    shopDescription: user.shopDescription || '',
    token
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (user.isBlocked) {
    const reason = user.blockedReason ? ` Motif : ${user.blockedReason}` : '';
    return res.status(403).json({
      message: `Votre compte est suspendu. Contactez l’administrateur pour plus d’informations.${reason}`,
      reason: user.blockedReason || '',
      code: 'ACCOUNT_BLOCKED'
    });
  }
  const token = genToken(user);
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountType: user.accountType,
    shopName: user.shopName || null,
    shopAddress: user.shopAddress || null,
    shopLogo: user.shopLogo || null,
    country: user.country,
    address: user.address || '',
    city: user.city,
    gender: user.gender,
    shopDescription: user.shopDescription || '',
    token
  });
});
