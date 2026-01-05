import asyncHandler from 'express-async-handler';
import SiteSetting from '../models/siteSettingModel.js';
import {
  uploadToCloudinary,
  getCloudinaryFolder,
  isCloudinaryConfigured
} from '../utils/cloudinaryUploader.js';

const SETTINGS_KEY = 'global';

const getSettings = async () => {
  const settings = await SiteSetting.findOne({ key: SETTINGS_KEY });
  return settings;
};

export const getHeroBanner = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ heroBanner: settings?.heroBanner || null });
});

export const updateHeroBanner = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Veuillez sélectionner une image.' });
  }
  if (!isCloudinaryConfigured()) {
    return res
      .status(503)
      .json({ message: 'Cloudinary n’est pas configuré. Définissez CLOUDINARY_* pour publier des médias.' });
  }
  const folder = getCloudinaryFolder(['site', 'hero']);
  const uploaded = await uploadToCloudinary({
    buffer: req.file.buffer,
    resourceType: 'image',
    folder
  });
  const heroBanner = uploaded.secure_url || uploaded.url;
  const settings = await SiteSetting.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { heroBanner, updatedBy: req.user.id },
    { new: true, upsert: true }
  );
  res.json({ heroBanner: settings.heroBanner || heroBanner });
});
