import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Country from '../models/countryModel.js';
import CountryConfig from '../models/countryConfigModel.js';
import CountryPaymentMethod from '../models/countryPaymentMethodModel.js';
import Cart from '../models/cartModel.js';
import City from '../models/cityModel.js';
import BoostPricing from '../models/boostPricingModel.js';
import DeliveryZone from '../models/deliveryZoneModel.js';
import DeliveryZonePrice from '../models/deliveryZonePriceModel.js';
import { LEGACY_COUNTRY } from '../services/countryService.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verifyOnly = args.has('--verify');
const rollback = args.has('--rollback');
const seedRdcTest = args.has('--seed-rdc-test');
const MIGRATION_MARKER = 'multi-country-v1';

const TARGETS = [
  ['users', { selectedCountryId: true }],
  ['products', { currency: true }],
  ['orders', { currency: true, orderSnapshot: true }],
  ['payments', { currency: true, paymentSnapshot: true }],
  ['pawapaycheckouts', { currency: true }],
  ['deliveryrequests', { currency: true }],
  ['parcelrequests', { currency: true }],
  ['shopping_orders', { currency: true }],
  ['quotationrequests', { currency: true }],
  ['quotationitems', { currency: true }],
  ['carts', { currency: true }],
  ['cities', {}],
  ['communes', {}],
  ['deliveryzones', {}],
  ['deliveryzoneprices', { currency: true }],
  ['deliveryguys', {}],
  ['deliveryguyapplications', {}],
  ['boostpricings', { currency: true }],
  ['boostrequests', { currency: true }],
  ['globalnotificationrequests', { currency: true }],
  ['listingfeepayments', { currency: true }],
  ['refunds', { currency: true }],
  ['flashsales', {}],
  ['groupbuys', {}],
  ['buyformetransactions', { currency: true }],
  ['buyformerefunds', { currency: true }],
  ['sellerpayouts', { currency: true }],
  ['sellersettlements', { currency: true }],
  ['deliverypricingevents', { currency: true }],
  ['deliverypricingversions', {}],
  ['deliverypromotions', { currency: true }],
  ['deliveryspeedrules', { currency: true }],
  ['globalnotificationpricings', { currency: true }],
  ['seasonalpricings', { currency: true }]
];

const collectionExists = async (name) =>
  mongoose.connection.db.listCollections({ name }, { nameOnly: true }).hasNext();

const getLegacyFilter = () => ({
  $or: [{ countryId: null }, { countryId: { $exists: false } }]
});

const buildSet = (countryId, options = {}) => ({
  countryId,
  ...(options.selectedCountryId ? { selectedCountryId: countryId } : {}),
  ...(options.currency ? { currency: 'XAF' } : {}),
  _multiCountryMigrationVersion: MIGRATION_MARKER
});

const safeDropIndex = async (collection, indexName) => {
  if (!indexName) return;
  try { await collection.dropIndex(indexName); }
  catch (error) { if (error?.code !== 27 && error?.codeName !== 'IndexNotFound') throw error; }
};

const upgradeIndexes = async () => {
  if (await collectionExists(Cart.collection.collectionName)) {
    const indexes = await Cart.collection.indexes();
    const old = indexes.find((index) => index.unique && Object.keys(index.key || {}).length === 1 && index.key.user === 1);
    await safeDropIndex(Cart.collection, old?.name);
    await Cart.collection.createIndex({ user: 1, countryId: 1 }, { unique: true, name: 'user_1_countryId_1' });
  }
  if (await collectionExists(City.collection.collectionName)) {
    const indexes = await City.collection.indexes();
    const old = indexes.find((index) => index.unique && Object.keys(index.key || {}).length === 1 && index.key.name === 1);
    await safeDropIndex(City.collection, old?.name);
    await City.collection.createIndex({ countryId: 1, name: 1 }, { unique: true, name: 'countryId_1_name_1' });
  }
  if (await collectionExists(BoostPricing.collection.collectionName)) {
    const indexes = await BoostPricing.collection.indexes();
    const old = indexes.find((index) => index.unique && index.key?.type === 1 && index.key?.city === 1 && !index.key?.countryId);
    await safeDropIndex(BoostPricing.collection, old?.name);
    await BoostPricing.collection.createIndex({ countryId: 1, type: 1, city: 1 }, { unique: true, name: 'countryId_1_type_1_city_1' });
  }
  if (await collectionExists(DeliveryZone.collection.collectionName)) {
    await DeliveryZone.collection.createIndex({ countryId: 1, name: 1 }, { unique: true, name: 'countryId_1_name_1' });
  }
  if (await collectionExists(DeliveryZonePrice.collection.collectionName)) {
    const indexes = await DeliveryZonePrice.collection.indexes();
    const old = indexes.find((index) => index.unique && index.key?.fromZoneId === 1 && index.key?.toZoneId === 1 && !index.key?.countryId);
    await safeDropIndex(DeliveryZonePrice.collection, old?.name);
    await DeliveryZonePrice.collection.createIndex(
      { countryId: 1, fromZoneId: 1, toZoneId: 1 },
      { unique: true, name: 'countryId_1_fromZoneId_1_toZoneId_1' }
    );
  }
};

const migrateCollection = async (name, options, countryId) => {
  if (!(await collectionExists(name))) return { collection: name, exists: false, candidates: 0, modified: 0 };
  const collection = mongoose.connection.collection(name);
  const candidates = await collection.countDocuments(getLegacyFilter());
  if (dryRun || verifyOnly || candidates === 0) return { collection: name, exists: true, candidates, modified: 0 };
  const result = await collection.updateMany(getLegacyFilter(), { $set: buildSet(countryId, options) });
  if (options.orderSnapshot) {
    await collection.updateMany(
      { _multiCountryMigrationVersion: MIGRATION_MARKER, 'pricingSnapshot.capturedAt': { $in: [null] } },
      [{ $set: { pricingSnapshot: {
        amount: { $ifNull: ['$totalAmount', 0] }, currency: { $ifNull: ['$currency', 'XAF'] }, countryId,
        productPrice: { $ifNull: ['$itemsSubtotal', 0] }, discount: { $ifNull: ['$discountTotal', 0] },
        deliveryFee: { $ifNull: ['$deliveryFeeTotal', 0] }, platformFee: 0, taxes: 0,
        total: { $ifNull: ['$totalAmount', 0] }, configVersion: 1, capturedAt: '$$NOW'
      } } }]
    );
  }
  if (options.paymentSnapshot) {
    await collection.updateMany(
      { _multiCountryMigrationVersion: MIGRATION_MARKER, 'pricingSnapshot.capturedAt': { $in: [null] } },
      [{ $set: { pricingSnapshot: {
        amount: { $ifNull: ['$amountPaid', { $ifNull: ['$expectedAmount', { $ifNull: ['$amount', 0] }] }] },
        currency: { $ifNull: ['$currency', 'XAF'] }, countryId,
        total: { $ifNull: ['$amountPaid', { $ifNull: ['$expectedAmount', { $ifNull: ['$amount', 0] }] }] },
        configVersion: 1, capturedAt: '$$NOW'
      } } }]
    );
  }
  return { collection: name, exists: true, candidates, modified: result.modifiedCount };
};

const rollbackMigration = async () => {
  const results = [];
  for (const [name, options] of TARGETS) {
    if (!(await collectionExists(name))) continue;
    const collection = mongoose.connection.collection(name);
    const filter = { _multiCountryMigrationVersion: MIGRATION_MARKER };
    const count = await collection.countDocuments(filter);
    if (dryRun) { results.push({ collection: name, rollbackCandidates: count }); continue; }
    const unset = { countryId: '', _multiCountryMigrationVersion: '' };
    if (options.selectedCountryId) unset.selectedCountryId = '';
    if (options.currency) unset.currency = '';
    if (options.orderSnapshot || options.paymentSnapshot) unset.pricingSnapshot = '';
    const result = await collection.updateMany(filter, { $unset: unset });
    results.push({ collection: name, rolledBack: result.modifiedCount });
  }
  return results;
};

const seedRdc = async () => {
  const rdc = await Country.findOneAndUpdate(
    { code: 'CD' },
    {
      $setOnInsert: {
        name: 'RDC', officialName: 'République démocratique du Congo', code: 'CD', iso3: 'COD', phoneCode: '+243',
        flagEmoji: '🇨🇩', defaultLanguage: 'fr', supportedLanguages: ['fr'], timezone: 'Africa/Kinshasa',
        currency: { code: 'CDF', symbol: 'FC', name: 'Franc congolais', decimals: 2 },
        supportedCurrencies: [
          { code: 'CDF', symbol: 'FC', name: 'Franc congolais', decimals: 2 },
          { code: 'USD', symbol: '$', name: 'Dollar américain', decimals: 2 }
        ],
        status: 'TEST', isDefault: false, sortOrder: 2,
        settings: { crossBorder: { enabled: false }, delivery: { enabled: false, configured: false } }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await CountryConfig.updateOne({ countryId: rdc._id }, { $setOnInsert: { countryId: rdc._id, version: 1 } }, { upsert: true });
  return rdc;
};

const verify = async (countryId) => {
  const report = [];
  for (const [name] of TARGETS) {
    if (!(await collectionExists(name))) continue;
    const collection = mongoose.connection.collection(name);
    report.push({
      collection: name,
      total: await collection.countDocuments({}),
      missingCountryId: await collection.countDocuments(getLegacyFilter()),
      congo: countryId ? await collection.countDocuments({ countryId }) : 0
    });
  }
  return report;
};

const run = async () => {
  await connectDB();
  let congo = await Country.findOne({ $or: [{ code: 'CG' }, { isDefault: true }] });
  if (!congo && !dryRun && !verifyOnly && !rollback) congo = await Country.create(LEGACY_COUNTRY);

  if (rollback) {
    console.table(await rollbackMigration());
    return;
  }
  if (verifyOnly) {
    console.table(await verify(congo?._id || null));
    return;
  }

  const results = [];
  for (const [name, options] of TARGETS) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await migrateCollection(name, options, congo?._id || null));
  }
  if (!dryRun) {
    await upgradeIndexes();
    if (seedRdcTest) await seedRdc();
  }
  console.table(results.filter((item) => item.exists || item.candidates));
  if (dryRun) console.log('Dry-run terminé : aucune donnée modifiée.');
  else console.log(`Migration ${MIGRATION_MARKER} terminée.`);
  console.table(await verify(congo?._id || null));
};

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });
