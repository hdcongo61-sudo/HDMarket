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

const parsePromoDate = (value, edge) => {
  if (typeof value !== 'string') {
    return { value: undefined };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const date =
      edge === 'end'
        ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
        : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return { value: date };
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { error: true };
  }
  return { value: parsed };
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

export const getPromoBanner = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({
    promoBanner: settings?.promoBanner || null,
    promoBannerMobile: settings?.promoBannerMobile || null,
    promoBannerLink: settings?.promoBannerLink || '',
    promoBannerStartAt: settings?.promoBannerStartAt || null,
    promoBannerEndAt: settings?.promoBannerEndAt || null
  });
});

export const getSplash = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const duration = Math.min(30, Math.max(1, Number(settings?.splashDurationSeconds) || 3));
  // Default to true when not set (backward compatible)
  const splashEnabled = settings?.splashEnabled !== false;
  res.json({
    splashImage: settings?.splashImage || null,
    splashDurationSeconds: duration,
    splashEnabled
  });
});

export const updateSplash = asyncHandler(async (req, res) => {
  const durationRaw = req.body?.splashDurationSeconds;
  const duration =
    durationRaw !== undefined && durationRaw !== ''
      ? Math.min(30, Math.max(1, Math.round(Number(durationRaw)) || 3))
      : undefined;
  const splashEnabledRaw = req.body?.splashEnabled;

  const updates = { updatedBy: req.user.id };
  if (duration !== undefined) {
    updates.splashDurationSeconds = duration;
  }
  if (splashEnabledRaw !== undefined) {
    updates.splashEnabled = splashEnabledRaw === true || splashEnabledRaw === 'true';
  }

  if (req.file) {
    if (!req.file.mimetype?.startsWith('image/')) {
      return res.status(400).json({ message: 'Le fichier doit être une image.' });
    }
    if (!isCloudinaryConfigured()) {
      return res
        .status(503)
        .json({ message: 'Cloudinary n’est pas configuré. Définissez CLOUDINARY_* pour publier des médias.' });
    }
    const folder = getCloudinaryFolder(['site', 'splash']);
    const uploaded = await uploadToCloudinary({
      buffer: req.file.buffer,
      resourceType: 'image',
      folder
    });
    updates.splashImage = uploaded.secure_url || uploaded.url;
  }

  const hasSplashEnabledUpdate = splashEnabledRaw !== undefined;
  if (!req.file && duration === undefined && !hasSplashEnabledUpdate) {
    return res.status(400).json({ message: 'Veuillez fournir une image, une durée (secondes) ou activer/désactiver l’écran de démarrage.' });
  }

  const settings = await SiteSetting.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: updates },
    { new: true, upsert: true }
  );

  const finalDuration = Math.min(30, Math.max(1, Number(settings?.splashDurationSeconds) || 3));
  const splashEnabled = settings?.splashEnabled !== false;
  res.json({
    splashImage: settings?.splashImage || null,
    splashDurationSeconds: finalDuration,
    splashEnabled
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

export const updatePromoBanner = asyncHandler(async (req, res) => {
  const promoBannerFile = req.files?.promoBanner?.[0] || req.file || null;
  const promoBannerMobileFile = req.files?.promoBannerMobile?.[0] || null;
  const hasFile = Boolean(promoBannerFile || promoBannerMobileFile);
  const hasLink = typeof req.body?.promoBannerLink === 'string';
  const startResult = parsePromoDate(req.body?.promoBannerStartAt, 'start');
  const endResult = parsePromoDate(req.body?.promoBannerEndAt, 'end');
  const hasDates = startResult.value !== undefined || endResult.value !== undefined;
  if (!hasFile && !hasLink && !hasDates) {
    return res.status(400).json({ message: 'Veuillez sélectionner une bannière, un lien ou des dates.' });
  }
  if (startResult.error || endResult.error) {
    return res.status(400).json({ message: 'Dates de bannière invalides.' });
  }
  if (promoBannerFile && !promoBannerFile.mimetype?.startsWith('image/')) {
    return res.status(400).json({ message: 'Le fichier doit être une image.' });
  }
  if (promoBannerMobileFile && !promoBannerMobileFile.mimetype?.startsWith('image/')) {
    return res.status(400).json({ message: 'Le fichier doit être une image.' });
  }
  if ((promoBannerFile || promoBannerMobileFile) && !isCloudinaryConfigured()) {
    return res
      .status(503)
      .json({ message: 'Cloudinary n’est pas configuré. Définissez CLOUDINARY_* pour publier des médias.' });
  }

  const updates = { updatedBy: req.user.id };
  if (startResult.value !== undefined) {
    updates.promoBannerStartAt = startResult.value;
  }
  if (endResult.value !== undefined) {
    updates.promoBannerEndAt = endResult.value;
  }
  if (
    startResult.value instanceof Date &&
    endResult.value instanceof Date &&
    endResult.value < startResult.value
  ) {
    return res.status(400).json({ message: 'La date de fin doit être après la date de début.' });
  }
  if (promoBannerFile) {
    const folder = getCloudinaryFolder(['site', 'promo']);
    const uploaded = await uploadToCloudinary({
      buffer: promoBannerFile.buffer,
      resourceType: 'image',
      folder
    });
    updates.promoBanner = uploaded.secure_url || uploaded.url;
  }
  if (promoBannerMobileFile) {
    const folder = getCloudinaryFolder(['site', 'promo', 'mobile']);
    const uploaded = await uploadToCloudinary({
      buffer: promoBannerMobileFile.buffer,
      resourceType: 'image',
      folder
    });
    updates.promoBannerMobile = uploaded.secure_url || uploaded.url;
  }
  if (hasLink) {
    updates.promoBannerLink = req.body.promoBannerLink.trim();
  }

  const settings = await SiteSetting.findOneAndUpdate(
    { key: SETTINGS_KEY },
    updates,
    { new: true, upsert: true }
  );

  res.json({
    promoBanner: settings?.promoBanner || updates.promoBanner || null,
    promoBannerMobile: settings?.promoBannerMobile || updates.promoBannerMobile || null,
    promoBannerLink: settings?.promoBannerLink || updates.promoBannerLink || '',
    promoBannerStartAt: settings?.promoBannerStartAt || updates.promoBannerStartAt || null,
    promoBannerEndAt: settings?.promoBannerEndAt || updates.promoBannerEndAt || null
  });
});
