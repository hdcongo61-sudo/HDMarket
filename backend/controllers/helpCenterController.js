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

export const getHelpCenter = asyncHandler(async (req, res) => {
  const doc = await ensureHelpCenter();
  res.json(doc);
});

export const updateHelpCenter = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res
      .status(403)
      .json({ message: 'Seuls les administrateurs peuvent modifier ces informations.' });
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
