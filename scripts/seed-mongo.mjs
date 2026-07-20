/**
 * seed-mongo.mjs
 * ─────────────────────────────────────────────────────────────
 * Seeds real user accounts into MongoDB Atlas for Cobult Stocks.
 * Run with:  node scripts/seed-mongo.mjs
 * ─────────────────────────────────────────────────────────────
 */

import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Load .env manually (no dotenv dependency needed) ──────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.join(__dirname, '..', '.env');

try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key   = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  console.warn('⚠  Could not read .env – make sure MONGODB_URI is set in environment.');
}

// ── Connection ─────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set. Aborting.');
  process.exit(1);
}

// ── Helper ─────────────────────────────────────────────────────
function hash(password) {
  return bcrypt.hashSync(password, 10);
}

function now() {
  return new Date().toISOString();
}

// ══════════════════════════════════════════════════════════════
// ✏  REAL USER ACCOUNTS — Edit these to match your actual staff
// ══════════════════════════════════════════════════════════════
const SHOPS = [
  {
    id:                 'super_admin_shop',
    shopName:           'Cobult Head Office',
    ownerName:          'Super Administrator',
    email:              'admin@cobult.com',
    phone:              '+263771000000',
    subscriptionPlan:   'Yearly',
    subscriptionStatus: 'Active',
    expiryDate:         '2030-12-31',
    status:             'Active',
    createdAt:          now(),
  },
  {
    id:                 'shop_default',
    shopName:           'Cobult Retail',
    ownerName:          'Tinotenda Bungu',
    email:              'owner@cobult.com',
    phone:              '+263771111111',
    subscriptionPlan:   'Yearly',
    subscriptionStatus: 'Active',
    expiryDate:         '2028-12-31',
    status:             'Active',
    createdAt:          now(),
  },
];

const BRANCHES = [
  { id: 'b1', shopId: 'shop_default', name: 'Harare CBD Branch',    address: '123 Samora Machel Ave, Harare', phone: '+263771111222', createdAt: now() },
  { id: 'b2', shopId: 'shop_default', name: 'Bulawayo City Branch', address: '45 Fife St, Bulawayo',          phone: '+263772222333', createdAt: now() },
  { id: 'b3', shopId: 'shop_default', name: 'Masvingo City Branch', address: '10 Hughes St, Masvingo',        phone: '+263773333444', createdAt: now() },
];

// ─── Change usernames, emails, and passwords below ─────────────
const USERS = [
  // ── Super Admin ──────────────────────────────────────────────
  {
    id:           'u_admin',
    shopId:       'super_admin_shop',
    branchId:     '',
    username:     'superadmin',
    fullname:     'Super Admin',
    email:        'admin@cobult.com',
    role:         'SuperAdmin',
    passwordHash: hash('Admin@Cobult2026!'),   // ← change this password
    status:       'Active',
    createdAt:    now(),
    avatarUrl:    'https://ui-avatars.com/api/?name=Super+Admin&background=6366f1&color=fff',
  },

  // ── Shop Owner ───────────────────────────────────────────────
  {
    id:           'u1',
    shopId:       'shop_default',
    branchId:     'b1',
    username:     'bungutinotenda',
    fullname:     'Tinotenda Bungu',
    email:        'tinotenda@cobult.com',
    role:         'Owner',
    passwordHash: hash('Owner@Cobult2026!'),   // ← change this password
    status:       'Active',
    createdAt:    now(),
    avatarUrl:    'https://ui-avatars.com/api/?name=Tinotenda+Bungu&background=0ea5e9&color=fff',
  },

  // ── Manager – Harare ─────────────────────────────────────────
  {
    id:           'u2',
    shopId:       'shop_default',
    branchId:     'b1',
    username:     'manager_harare',
    fullname:     'Harare Branch Manager',
    email:        'manager.harare@cobult.com',
    role:         'Manager',
    passwordHash: hash('Manager@Hre2026!'),    // ← change this password
    status:       'Active',
    createdAt:    now(),
    avatarUrl:    'https://ui-avatars.com/api/?name=Harare+Manager&background=10b981&color=fff',
  },

  // ── Cashier – Harare ─────────────────────────────────────────
  {
    id:           'u3',
    shopId:       'shop_default',
    branchId:     'b1',
    username:     'cashier_harare',
    fullname:     'Harare Cashier',
    email:        'cashier.harare@cobult.com',
    role:         'Cashier',
    passwordHash: hash('Cashier@Hre2026!'),    // ← change this password
    status:       'Active',
    createdAt:    now(),
    avatarUrl:    'https://ui-avatars.com/api/?name=Harare+Cashier&background=f59e0b&color=fff',
  },

  // ── Cashier – Bulawayo ───────────────────────────────────────
  {
    id:           'u4',
    shopId:       'shop_default',
    branchId:     'b2',
    username:     'cashier_byo',
    fullname:     'Bulawayo Cashier',
    email:        'cashier.byo@cobult.com',
    role:         'Cashier',
    passwordHash: hash('Cashier@Byo2026!'),    // ← change this password
    status:       'Active',
    createdAt:    now(),
    avatarUrl:    'https://ui-avatars.com/api/?name=Bulawayo+Cashier&background=ef4444&color=fff',
  },

  // ── Manager – Bulawayo ───────────────────────────────────────
  {
    id:           'u5',
    shopId:       'shop_default',
    branchId:     'b2',
    username:     'manager_byo',
    fullname:     'Bulawayo Branch Manager',
    email:        'manager.byo@cobult.com',
    role:         'Manager',
    passwordHash: hash('Manager@Byo2026!'),    // ← change this password
    status:       'Active',
    createdAt:    now(),
    avatarUrl:    'https://ui-avatars.com/api/?name=Bulawayo+Manager&background=8b5cf6&color=fff',
  },

  // ── Cashier – Masvingo ───────────────────────────────────────
  {
    id:           'u6',
    shopId:       'shop_default',
    branchId:     'b3',
    username:     'cashier_msv',
    fullname:     'Masvingo Cashier',
    email:        'cashier.msv@cobult.com',
    role:         'Cashier',
    passwordHash: hash('Cashier@Msv2026!'),    // ← change this password
    status:       'Active',
    createdAt:    now(),
    avatarUrl:    'https://ui-avatars.com/api/?name=Masvingo+Cashier&background=ec4899&color=fff',
  },
];

// ══════════════════════════════════════════════════════════════
// Seeding logic  – do not edit below this line
// ══════════════════════════════════════════════════════════════

async function upsertMany(collection, docs, keyField = 'id') {
  let inserted = 0, updated = 0;
  for (const doc of docs) {
    const filter = { [keyField]: doc[keyField] };
    const result = await collection.updateOne(filter, { $set: doc }, { upsert: true });
    if (result.upsertedCount) inserted++;
    else if (result.modifiedCount) updated++;
  }
  return { inserted, updated };
}

async function main() {
  console.log('\n🌱  Cobult Stocks — MongoDB Seeder');
  console.log('────────────────────────────────────');

  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS:         8000,
    serverSelectionTimeoutMS: 8000,
  });

  try {
    await client.connect();
    const db = client.db();
    console.log(`✅  Connected to MongoDB  (database: ${db.databaseName})\n`);

    // ── Shops ──────────────────────────────────────────────────
    {
      const col = db.collection('shops');
      const res = await upsertMany(col, SHOPS);
      console.log(`📦  shops       →  ${res.inserted} inserted, ${res.updated} updated`);
    }

    // ── Branches ───────────────────────────────────────────────
    {
      const col = db.collection('branches');
      const res = await upsertMany(col, BRANCHES);
      console.log(`🏬  branches    →  ${res.inserted} inserted, ${res.updated} updated`);
    }

    // ── Users ──────────────────────────────────────────────────
    {
      const col = db.collection('users');
      // Unique index: shopId + username
      await col.createIndex({ shopId: 1, username: 1 }, { unique: true }).catch(() => {});
      const res = await upsertMany(col, USERS);
      console.log(`👤  users       →  ${res.inserted} inserted, ${res.updated} updated`);
    }

    console.log('\n✔  Seeding complete!\n');
    console.log('─── Credentials Summary ────────────────────────────────────────────');
    for (const u of USERS) {
      console.log(`  [${u.role.padEnd(10)}]  ${u.username.padEnd(20)}  ${u.email}`);
    }
    console.log('────────────────────────────────────────────────────────────────────');
    console.log('  Passwords are defined in the USERS array in scripts/seed-mongo.mjs');
    console.log('  Change them via the SuperAdmin panel after first login.\n');

  } catch (err) {
    console.error('❌  Seeding failed:', err.message ?? err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
