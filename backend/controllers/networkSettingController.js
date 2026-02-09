import asyncHandler from 'express-async-handler';
import NetworkSetting from '../models/networkSettingModel.js';

/**
 * Get all network settings
 */
export const getAllNetworks = asyncHandler(async (req, res) => {
  const networks = await NetworkSetting.find()
    .sort({ order: 1, createdAt: 1 })
    .lean();
  res.json(networks);
});

/**
 * Get active network settings only
 */
export const getActiveNetworks = asyncHandler(async (req, res) => {
  const networks = await NetworkSetting.find({ isActive: true })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  res.json(networks);
});

/**
 * Create a new network setting
 */
export const createNetwork = asyncHandler(async (req, res) => {
  const { name, phoneNumber, isActive, order } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Le nom du réseau est requis.' });
  }
  if (!phoneNumber || !phoneNumber.trim()) {
    return res.status(400).json({ message: 'Le numéro de téléphone est requis.' });
  }

  // Check if network name already exists
  const existing = await NetworkSetting.findOne({ name: name.trim() });
  if (existing) {
    return res.status(400).json({ message: 'Un réseau avec ce nom existe déjà.' });
  }

  const network = await NetworkSetting.create({
    name: name.trim(),
    phoneNumber: phoneNumber.trim(),
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    order: order !== undefined ? Number(order) : 0
  });

  res.status(201).json(network);
});

/**
 * Update a network setting
 */
export const updateNetwork = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phoneNumber, isActive, order } = req.body;

  const network = await NetworkSetting.findById(id);
  if (!network) {
    return res.status(404).json({ message: 'Réseau introuvable.' });
  }

  if (name && name.trim() && name.trim() !== network.name) {
    // Check if another network has this name
    const existing = await NetworkSetting.findOne({ name: name.trim(), _id: { $ne: id } });
    if (existing) {
      return res.status(400).json({ message: 'Un réseau avec ce nom existe déjà.' });
    }
    network.name = name.trim();
  }

  if (phoneNumber && phoneNumber.trim()) {
    network.phoneNumber = phoneNumber.trim();
  }

  if (typeof isActive !== 'undefined') {
    network.isActive = Boolean(isActive);
  }

  if (typeof order !== 'undefined') {
    network.order = Number(order);
  }

  await network.save();
  res.json(network);
});

/**
 * Delete a network setting
 */
export const deleteNetwork = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const network = await NetworkSetting.findById(id);
  if (!network) {
    return res.status(404).json({ message: 'Réseau introuvable.' });
  }

  await NetworkSetting.findByIdAndDelete(id);
  res.json({ message: 'Réseau supprimé avec succès.' });
});
