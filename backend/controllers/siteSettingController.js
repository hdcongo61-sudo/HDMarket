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

export const getAppLogo = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const legacyLogo = settings?.appLogo || null;
  res.json({
    appLogoDesktop: settings?.appLogoDesktop || legacyLogo,
    appLogoMobile: settings?.appLogoMobile || legacyLogo
  });
});

const createAppLogoUpdater = (fieldKey, folderSegment) =>
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Veuillez sélectionner un logo.' });
    }
    if (!req.file.mimetype?.startsWith('image/')) {
      return res.status(400).json({ message: 'Le fichier doit être une image.' });
    }
    if (!isCloudinaryConfigured()) {
      return res
        .status(503)
        .json({ message: 'Cloudinary n’est pas configuré. Définissez CLOUDINARY_* pour publier des médias.' });
    }
    const folder = getCloudinaryFolder(['site', 'logo', folderSegment]);
    const uploaded = await uploadToCloudinary({
      buffer: req.file.buffer,
      resourceType: 'image',
      folder,
      options: { format: 'png' }
    });
    const logoUrl = uploaded.secure_url || uploaded.url;
    const settings = await SiteSetting.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { [fieldKey]: logoUrl, updatedBy: req.user.id },
      { new: true, upsert: true }
    );
    res.json({ [fieldKey]: settings[fieldKey] || logoUrl });
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

export const updateAppLogoDesktop = createAppLogoUpdater('appLogoDesktop', 'desktop');
export const updateAppLogoMobile = createAppLogoUpdater('appLogoMobile', 'mobile');
