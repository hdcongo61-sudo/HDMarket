import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import OnboardingSequence from '../models/onboardingSequenceModel.js';
import User from '../models/userModel.js';

// One-off seed for the default 5-step onboarding sequence (Welcome / Discover
// products / Buy For Me / Delivery / Selling). Upserts by a stable slug so
// re-running this script never duplicates the sequence or clobbers an
// admin's later edits — it only creates the doc if that slug doesn't exist
// yet. Run manually: node scripts/seedDefaultOnboardingSequence.js
// (add --activate to also flip isActive:true for brand-new installs).

const SLUG = 'default-onboarding-v1';
const activate = process.argv.includes('--activate');

const steps = [
  {
    order: 0,
    title: 'Bienvenue sur HDMarket 👋',
    message: 'Achetez, vendez et découvrez des produits et services près de chez vous.',
    delayValue: 0,
    delayUnit: 'minutes',
    action: { enabled: true, label: 'Explorer HDMarket', type: 'internal_route', target: '/' },
    conditions: [],
    channels: { inApp: true, push: true, email: false, sms: false }
  },
  {
    order: 1,
    title: 'Trouvez ce qu’il vous faut 🔎',
    message: 'Recherche, catégories, produits locaux et recommandations personnalisées : tout est à portée de main.',
    delayValue: 24,
    delayUnit: 'hours',
    action: { enabled: true, label: 'Explorer les produits', type: 'internal_route', target: '/products' },
    conditions: ['hasPlacedOrder'],
    channels: { inApp: true, push: true, email: false, sms: false }
  },
  {
    order: 2,
    title: 'Introuvable sur HDMarket ? 🛍️',
    message: 'Le service Acheter pour moi permet à quelqu’un d’acheter et de vous livrer un produit que vous ne trouvez pas sur la plateforme.',
    delayValue: 48,
    delayUnit: 'hours',
    action: { enabled: true, label: 'Découvrir Acheter pour moi', type: 'internal_route', target: '/buy-for-me' },
    conditions: ['hasUsedBuyForMe'],
    channels: { inApp: true, push: true, email: false, sms: false }
  },
  {
    order: 3,
    title: 'Faites livrer vos achats 🛵',
    message: 'HDMarket propose plusieurs options de livraison pour recevoir vos commandes rapidement et en toute sécurité.',
    delayValue: 48,
    delayUnit: 'hours',
    action: { enabled: true, label: 'Découvrir la livraison', type: 'internal_route', target: '/parcels/new' },
    conditions: ['hasUsedDelivery'],
    channels: { inApp: true, push: true, email: false, sms: false }
  },
  {
    order: 4,
    title: 'Envie de vendre sur HDMarket ? 🚀',
    message: 'Créez votre boutique et commencez à vendre vos produits à des milliers d’acheteurs.',
    delayValue: 72,
    delayUnit: 'hours',
    action: { enabled: true, label: 'Commencer à vendre', type: 'internal_route', target: '/shop-conversion-request' },
    conditions: ['hasCreatedShop', 'hasPublishedProduct'],
    channels: { inApp: true, push: true, email: false, sms: false }
  }
];

const run = async () => {
  await connectDB();

  const existing = await OnboardingSequence.findOne({ slug: SLUG });
  if (existing) {
    console.log(`Sequence "${SLUG}" already exists (id=${existing._id}) — leaving it untouched.`);
    console.log('Delete it manually first if you really want to reseed from scratch.');
    return;
  }

  const founder = await User.findOne({ role: 'founder' }).select('_id').lean();
  const admin = founder || (await User.findOne({ role: 'admin' }).select('_id').lean());
  if (!admin) {
    throw new Error('No founder/admin user found to attribute this seed to — create one first.');
  }

  const sequence = await OnboardingSequence.create({
    name: 'Onboarding par défaut',
    description: 'Séquence de bienvenue standard HDMarket (5 étapes) — éditable depuis Admin > Onboarding.',
    slug: SLUG,
    isActive: activate,
    countryRules: [],
    roleRules: [],
    steps,
    createdBy: admin._id
  });

  console.log(`Created onboarding sequence "${sequence.name}" (id=${sequence._id}, active=${sequence.isActive}).`);
  if (!activate) {
    console.log('Not activated — activate it from Admin > Onboarding, or rerun with --activate.');
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
