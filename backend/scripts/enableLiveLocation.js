// One-off sync for TAOBAO_GAP_ANALYSIS_V2.md A.1 — "Live courier GPS tracking".
// runtimeSettingsCatalog.js's enable_live_location default was flipped to
// `true`, but ensureRuntimeConfigBootstrap only seeds AppSetting docs on first
// insert ($setOnInsert), so an environment with a pre-existing record (this
// one dates to 2026-06-10, before the fix, description still says
// "préparation future") never picks up the new default. Without this, the
// GPS write path (pingDeliveryAgentLocation / pingParcelAgentLocation) is
// silently a no-op even though the client-side watchers and UI are live.
//
// Safe to re-run. After this, toggle it via Admin > System Settings > the
// "delivery_platform" category if it ever needs to go back off.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { getRuntimeConfig, setRuntimeConfig } from '../services/configService.js';

dotenv.config();
await connectDB();

const KEY = 'enable_live_location';

try {
  const before = await getRuntimeConfig(KEY);
  console.log('Before:', before);

  const after = await setRuntimeConfig(KEY, true, { environment: 'all' });
  console.log('After:', after);
  console.log('Done.');
} catch (error) {
  console.error('Failed to sync runtime config:', error);
} finally {
  await mongoose.disconnect();
  process.exit(0);
}
