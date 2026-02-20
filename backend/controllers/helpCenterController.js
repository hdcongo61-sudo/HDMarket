import asyncHandler from 'express-async-handler';
import HelpCenter from '../models/helpCenterModel.js';

const defaultConditions = [
  {
    title: 'Paiements sécurisés',
    description:
      'Tous les paiements vers ETS HD Tech Filial sont vérifiés manuellement avant la mise en ligne d’une annonce.'
  },
  {
    title: 'Vendeurs vérifiés',
    description:
      'Les boutiques et les particuliers doivent fournir des informations valides pour publier sur HDMarket.'
  },
  {
    title: 'Service client réactif',
    description:
      'Notre support répond sous 24h ouvrées par email ou WhatsApp pour toute réclamation ou assistance.'
  }
];

const ensureHelpCenter = async () => {
  let doc = await HelpCenter.findOne();
  if (!doc) {
    doc = await HelpCenter.create({
      companyName: 'ETS HD Tech Filial',
      conditions: defaultConditions
    });
  }
  return doc;
};

const toPlainText = (value = '') =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getHelpCenter = asyncHandler(async (req, res) => {
  const doc = await ensureHelpCenter();
  res.json(doc);
});

export const updateHelpCenter = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin' && req.user?.canManageHelpCenter !== true) {
    return res
      .status(403)
      .json({ message: 'Vous n\'avez pas les droits pour modifier ces informations.' });
  }

  const { conditions = [], companyName } = req.body || {};
  if (!Array.isArray(conditions) || !conditions.length) {
    return res.status(400).json({ message: 'Merci de fournir au moins une condition valide.' });
  }

  const sanitized = conditions
    .map((item) => ({
      title: (item?.title || '').toString().trim(),
      description: (item?.description || '').toString().trim()
    }))
    .filter((item) => item.title && item.description);

  if (!sanitized.length) {
    return res.status(400).json({
      message: 'Chaque condition doit contenir un titre et une description.'
    });
  }

  const doc = await ensureHelpCenter();
  doc.conditions = sanitized;
  if (companyName && companyName.trim()) {
    doc.companyName = companyName.trim();
  }
  doc.updatedBy = req.user.id;
  await doc.save();
  res.json(doc);
});

export const addHelpCenterCondition = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin' && req.user?.canManageHelpCenter !== true) {
    return res
      .status(403)
      .json({ message: 'Vous n\'avez pas les droits pour modifier ces informations.' });
  }

  const title = (req.body?.title || req.body?.subject || '').toString().trim();
  const description = (
    req.body?.descriptionHtml ||
    req.body?.description ||
    req.body?.plainText ||
    ''
  )
    .toString()
    .trim();
  const descriptionPlain = toPlainText(description);

  if (!title || title.length < 4) {
    return res
      .status(400)
      .json({ message: 'Le titre est requis (minimum 4 caractères).' });
  }

  if (!descriptionPlain || descriptionPlain.length < 15) {
    return res
      .status(400)
      .json({ message: 'La description est requise (minimum 15 caractères).' });
  }

  const doc = await ensureHelpCenter();
  doc.conditions = [{ title, description }, ...(doc.conditions || [])].slice(0, 50);
  doc.updatedBy = req.user.id;
  await doc.save();

  res.status(201).json({
    message: 'Condition ajoutée avec succès.',
    condition: doc.conditions[0],
    conditions: doc.conditions
  });
});

export const updateHelpCenterCondition = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin' && req.user?.canManageHelpCenter !== true) {
    return res
      .status(403)
      .json({ message: 'Vous n\'avez pas les droits pour modifier ces informations.' });
  }

  const index = Number.parseInt(req.params.index, 10);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ message: 'Index de condition invalide.' });
  }

  const title = (req.body?.title || '').toString().trim();
  const description = (
    req.body?.descriptionHtml ||
    req.body?.description ||
    req.body?.plainText ||
    ''
  )
    .toString()
    .trim();
  const descriptionPlain = toPlainText(description);

  if (!title || title.length < 4) {
    return res
      .status(400)
      .json({ message: 'Le titre est requis (minimum 4 caractères).' });
  }

  if (!descriptionPlain || descriptionPlain.length < 15) {
    return res
      .status(400)
      .json({ message: 'La description est requise (minimum 15 caractères).' });
  }

  const doc = await ensureHelpCenter();
  if (!Array.isArray(doc.conditions) || index >= doc.conditions.length) {
    return res.status(404).json({ message: 'Condition introuvable.' });
  }

  doc.conditions[index] = { title, description };
  doc.updatedBy = req.user.id;
  await doc.save();

  res.json({
    message: 'Condition mise à jour.',
    conditions: doc.conditions
  });
});

export const deleteHelpCenterCondition = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin' && req.user?.canManageHelpCenter !== true) {
    return res
      .status(403)
      .json({ message: 'Vous n\'avez pas les droits pour modifier ces informations.' });
  }

  const index = Number.parseInt(req.params.index, 10);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ message: 'Index de condition invalide.' });
  }

  const doc = await ensureHelpCenter();
  if (!Array.isArray(doc.conditions) || index >= doc.conditions.length) {
    return res.status(404).json({ message: 'Condition introuvable.' });
  }

  doc.conditions.splice(index, 1);
  doc.updatedBy = req.user.id;
  await doc.save();

  res.json({
    message: 'Condition supprimée.',
    conditions: doc.conditions
  });
});
