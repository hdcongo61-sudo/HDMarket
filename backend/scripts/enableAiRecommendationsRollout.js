// One-off sync for TAOBAO_GAP_ANALYSIS_V2.md Part A.3 — "Enable the AI
// recommendation rollout". FEATURE_FLAG_DEFAULTS in
// config/runtimeSettingsCatalog.js only seeds a FeatureFlag doc on first
// insert ($setOnInsert in ensureRuntimeConfigBootstrap), so an environment
// that already has an `enable_ai_recommendations` record from before this
// change won't pick up the new default just by deploying the code. This
// script upserts the live DB record to match the new default: enabled,
// rolloutPercentage 5 (first stage of 5% -> 25% -> 100%), and rolesAllowed
// widened to real buyer roles (it was previously restricted to
// admin/founder only, which made the rollout unreachable by real users).
//
// Safe to re-run. After this, progress the rollout percentage over time via
// Admin > System Settings > Feature Flags (PATCH /admin/config/feature-flags/:name) —
// no further script needed for that.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { upsertFeatureFlag, getFeatureFlag } from '../services/configService.js';
import { FEATURE_FLAG_DEFAULTS } from '../config/runtimeSettingsCatalog.js';

dotenv.config();
await connectDB();

const FEATURE_NAME = 'enable_ai_recommendations';

try {
  const before = await getFeatureFlag(FEATURE_NAME);
  console.log('Before:', before);

  const defaults = FEATURE_FLAG_DEFAULTS[FEATURE_NAME];
  const after = await upsertFeatureFlag(FEATURE_NAME, defaults, { environment: 'all' });
  console.log('After:', after);
  console.log('Done.');
} catch (error) {
  console.error('Failed to sync feature flag:', error);
} finally {
  await mongoose.disconnect();
  process.exit(0);
}
