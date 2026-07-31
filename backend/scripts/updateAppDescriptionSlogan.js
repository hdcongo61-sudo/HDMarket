// One-off content update: the public app_information.description (shown in
// Footer.jsx's brand blurb) only mentioned buying/selling. Requested addition:
// mention parcel delivery ("Envoyer un colis") and Buy For Me ("Acheter Pour
// Moi") since both are now promoted on the home page.
//
// app_information is stored per-environment (config/runtimeSettingsCatalog.js's
// normalizeConfigEnvironment): an env-scoped record (e.g. "dev:app_information")
// shadows the base "all" record when both exist. This environment already had
// a "dev" override, so both scopes are updated here — otherwise fixing only
// "all" leaves dev-mode servers reading the stale text.
//
// Safe to re-run. Merges into the existing app_information JSON blob rather
// than replacing it, so other fields (contacts, legal info, social links)
// are preserved untouched.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { getRuntimeConfig, setRuntimeConfig } from '../services/configService.js';

dotenv.config();
await connectDB();

const KEY = 'app_information';
const NEW_DESCRIPTION =
  'Achetez et vendez en toute confiance, envoyez des colis et faites livrer vos courses, partout au Congo.';
const ENVIRONMENTS_TO_SYNC = ['all', 'dev'];

try {
  for (const environment of ENVIRONMENTS_TO_SYNC) {
    const before = await getRuntimeConfig(KEY, { environment });
    if (!before) {
      console.log(`[${environment}] no existing record — skipping (nothing to merge into).`);
      continue;
    }
    console.log(`[${environment}] before:`, before.description);
    const merged = { ...before, description: NEW_DESCRIPTION };
    await setRuntimeConfig(KEY, merged, { environment });
    const after = await getRuntimeConfig(KEY, { environment });
    console.log(`[${environment}] after:`, after.description);
  }
  console.log('Done.');
} catch (error) {
  console.error('Failed to update app_information:', error);
} finally {
  await mongoose.disconnect();
  process.exit(0);
}
