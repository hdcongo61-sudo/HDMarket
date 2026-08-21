import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import FeatureFlag from '../models/featureFlagModel.js';

// One-off seed for the Social Commerce Hub's feature flags. Upserts by
// {featureName, environment:'all'} with $setOnInsert only — never touches a
// flag that already exists, so re-running this (or an admin's later edits)
// is always safe. All flags start DISABLED: this is a brand-new subsystem
// with no verified provider credentials yet, so "off until an admin
// explicitly turns it on after configuring WhatsApp/Instagram/Messenger" is
// the responsible default (also trivially satisfies "SOCIAL_COMMERCE off ->
// existing app behavior unchanged").
// Run manually: node scripts/seedSocialCommerceFeatureFlags.js

const FLAGS = [
  {
    featureName: 'social_commerce',
    displayName: 'Social Commerce Hub',
    category: 'commerce',
    icon: 'Share2',
    description: 'Master switch — hides all Social Commerce UI (seller + admin) and product-lookup/click endpoints when off.'
  },
  {
    featureName: 'social_whatsapp',
    displayName: 'Social Commerce — WhatsApp',
    category: 'commerce',
    icon: 'MessageCircle',
    description: 'Processes inbound WhatsApp webhook messages through the product resolver/intent/response pipeline.'
  },
  {
    featureName: 'social_instagram',
    displayName: 'Social Commerce — Instagram',
    category: 'commerce',
    icon: 'Instagram',
    description: 'Processes inbound Instagram DM webhook messages.'
  },
  {
    featureName: 'social_facebook_messenger',
    displayName: 'Social Commerce — Facebook Messenger',
    category: 'commerce',
    icon: 'Facebook',
    description: 'Processes inbound Facebook Messenger webhook messages.'
  },
  {
    featureName: 'social_tiktok_messaging',
    displayName: 'Social Commerce — TikTok Messaging',
    category: 'commerce',
    icon: 'Music2',
    description: 'Not available — TikTok direct messaging has no configured provider in this deployment. TikTok traffic routes through WhatsApp instead. Do not enable without a real TikTok messaging integration.'
  },
  {
    featureName: 'social_shop_connections',
    displayName: 'Social Commerce — Shop-owned connections',
    category: 'commerce',
    icon: 'Store',
    description: 'Lets individual shops connect their own Instagram/Facebook/WhatsApp Business accounts instead of using the platform-owned ones. Architecture-ready, UI not built yet — keep off.'
  },
  {
    featureName: 'social_campaigns',
    displayName: 'Social Commerce — Campaigns',
    category: 'commerce',
    icon: 'Megaphone',
    description: 'Lets sellers create campaign-tagged smart links and lets admin see campaign analytics.'
  },
  {
    featureName: 'social_analytics',
    displayName: 'Social Commerce — Analytics',
    category: 'commerce',
    icon: 'BarChart3',
    description: 'Seller/admin Social Commerce analytics dashboards.'
  }
];

const run = async () => {
  await connectDB();

  for (const flag of FLAGS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await FeatureFlag.findOneAndUpdate(
      { featureName: flag.featureName, environment: 'all' },
      {
        $setOnInsert: {
          ...flag,
          version: '1.0.0',
          enabled: false,
          releaseStage: 'development',
          scope: 'GLOBAL',
          rollout: 'TEST',
          rolesAllowed: ['admin', 'founder'],
          rolloutPercentage: 100,
          environment: 'all'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
    );
    const created = !result.lastErrorObject?.updatedExisting;
    console.log(`${created ? 'Created' : 'Already exists, left untouched'}: ${flag.featureName}`);
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
