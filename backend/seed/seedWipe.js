import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

dotenv.config();
await connectDB();

const db = mongoose.connection.db;
const collections = await db.listCollections().toArray();
const names = collections.map((c) => c.name);

console.log(`⚠️  About to WIPE ${names.length} collections:\n  ${names.join('\n  ')}`);
console.log('\n🗑️  Deleting all data in 3 seconds... (Ctrl+C to abort)');

await new Promise((r) => setTimeout(r, 3000));

let deleted = 0;
for (const name of names) {
  const result = await db.collection(name).deleteMany({});
  deleted += result.deletedCount;
  console.log(`  ✅ ${name}: ${result.deletedCount} documents deleted`);
}

console.log(`\n🎯 Done. ${deleted} total documents deleted across ${names.length} collections.`);

await mongoose.disconnect();
process.exit(0);
