/**
 * One-off data repair: link all legacy cities and communes (countryId: null)
 * to the République du Congo country. Commune countryId follows its city.
 * Also ensures the country keeps exactly one default city when none exists.
 *
 * Run:  cd backend && node scripts/linkCitiesCommunesToCountry.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Country from '../models/countryModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const country = await Country.findOne({
    $or: [{ code: 'CG' }, { iso3: 'COG' }]
  }).sort({ isDefault: -1 });

  if (!country) {
    console.error('Congo country (CG/COG) not found — aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Country: ${country.name} (${country.code}/${country.iso3}) [${country._id}]`);

  // ── Cities ──────────────────────────────────────────────────────────────
  const citiesMissing = await City.find({ countryId: null });
  if (citiesMissing.length) {
    await City.updateMany({ _id: { $in: citiesMissing.map((c) => c._id) } }, { $set: { countryId: country._id } });
    console.log(`Linked ${citiesMissing.length} cities to ${country.name}.`);
  } else {
    console.log('All cities already linked to a country.');
  }

  // Ensure one default city per country when none is marked.
  const defaultCity = await City.findOne({ countryId: country._id, isDefault: true });
  if (!defaultCity) {
    const firstCity = await City.findOne({ countryId: country._id }).sort({ order: 1, name: 1 });
    if (firstCity) {
      firstCity.isDefault = true;
      await firstCity.save();
      console.log(`Marked "${firstCity.name}" as the default city.`);
    }
  }

  // ── Communes ────────────────────────────────────────────────────────────
  const allCities = await City.find({ countryId: country._id }).lean();
  const cityCountryById = new Map(allCities.map((city) => [String(city._id), String(city.countryId)]));
  const communes = await Commune.find({}).lean();

  const toFix = communes.filter((commune) => {
    const cityCountry = cityCountryById.get(String(commune.cityId));
    if (!cityCountry) return false; // orphan commune — handled below
    return String(commune.countryId || '') !== cityCountry;
  });
  if (toFix.length) {
    await Commune.updateMany(
      { _id: { $in: toFix.map((c) => c._id) } },
      { $set: { countryId: country._id } }
    );
    console.log(`Linked ${toFix.length} communes to ${country.name}.`);
  } else {
    console.log('All communes already linked to their city country.');
  }

  const orphans = communes.filter((commune) => !cityCountryById.get(String(commune.cityId)));
  if (orphans.length) {
    console.warn(`Warning: ${orphans.length} commune(s) point to a city outside the Congo country — left untouched.`);
  }

  // ── Recap ───────────────────────────────────────────────────────────────
  const cityCount = await City.countDocuments({ countryId: country._id });
  const communeCount = await Commune.countDocuments({ countryId: country._id });
  console.log(`Done — country now has ${cityCount} cities and ${communeCount} communes.`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
