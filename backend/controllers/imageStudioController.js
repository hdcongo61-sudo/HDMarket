import asyncHandler from 'express-async-handler';
import imageStudioService from '../services/imageStudioService.js';

const parseParameters = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const getImageStudioCapabilities = asyncHandler(async (_req, res) => {
  res.json(imageStudioService.capabilities());
});

export const analyzeImage = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Une image est requise.' });
  return res.json(imageStudioService.analyze(req.file));
});

export const processImage = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Une image est requise.' });
  const result = await imageStudioService.process({
    file: req.file,
    operation: String(req.body?.operation || '').trim(),
    parameters: parseParameters(req.body?.parameters),
    userId: req.user?.id || req.user?._id
  });
  return res.status(201).json(result);
});
