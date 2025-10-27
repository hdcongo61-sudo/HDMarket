import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

const genToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, accountType = 'person', shopName, shopAddress } = req.body;
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  if (accountType === 'shop') {
    if (!shopName) {
      return res.status(400).json({ message: 'Le nom de la boutique est requis.' });
    }
    if (!shopAddress) {
      return res.status(400).json({ message: "L'adresse de la boutique est requise." });
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
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: role === 'admin' ? 'admin' : 'user',
    accountType: accountType === 'shop' ? 'shop' : 'person',
    shopName: accountType === 'shop' ? shopName : undefined,
    shopAddress: accountType === 'shop' ? shopAddress : undefined,
    shopLogo: accountType === 'shop' ? shopLogoUrl : undefined
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
    token
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
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
    token
  });
});
