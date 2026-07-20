/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MongoClient, Db } from 'mongodb';
import { getStore, saveStore, DBStore } from './db_sim.ts';
import { 
  Shop, User, Branch, Product, Supplier, Customer, Sale, PurchaseOrder, AuditLog, Quotation, Expense, StockMovement, Return, UserRole 
} from './types.ts';

let mongoClient: MongoClient | null = null;
let db: Db | null = null;

/**
 * Clean MongoDB internal properties (_id) from the document
 * to prevent any serialization or type issues.
 */
function cleanDoc<T>(doc: any): T {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest as T;
}

function cleanDocs<T>(docs: any[]): T[] {
  return docs.map(doc => cleanDoc<T>(doc));
}

/**
 * Connect to MongoDB Atlas. Falls back gracefully to null on error.
 */
export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    return null;
  }

  if (db) {
    try {
      await db.command({ ping: 1 });
      return db;
    } catch (e) {
      console.warn('[MongoDB] Existing connection lost. Re-establishing connection...', e);
      db = null;
      mongoClient = null;
    }
  }

  try {
    console.log('[MongoDB] Attempting to connect to Atlas...');
    const client = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    
    await client.connect();
    const activeDb = client.db();
    
    await activeDb.command({ ping: 1 });
    console.log('[MongoDB] Connection to Atlas established and verified successfully.');

    mongoClient = client;
    db = activeDb;

    // Seed collections if empty
    await seedDatabaseIfNeeded(db);

    // Create Indexes for High Scalability (10,000+ Shops, Millions of Sales/Products)
    console.log('[MongoDB] Optimizing database indexes...');
    await activeDb.collection('shops').createIndex({ id: 1 }, { unique: true });
    await activeDb.collection('users').createIndex({ shopId: 1, username: 1 }, { unique: true });
    await activeDb.collection('users').createIndex({ email: 1 });
    await activeDb.collection('branches').createIndex({ shopId: 1, id: 1 });
    await activeDb.collection('products').createIndex({ shopId: 1, barcode: 1 });
    await activeDb.collection('products').createIndex({ shopId: 1, branchId: 1 });
    await activeDb.collection('sales').createIndex({ shopId: 1, invoiceNumber: 1 });
    await activeDb.collection('sales').createIndex({ shopId: 1, branchId: 1 });
    await activeDb.collection('suppliers').createIndex({ shopId: 1, id: 1 });
    await activeDb.collection('customers').createIndex({ shopId: 1, id: 1 });
    await activeDb.collection('expenses').createIndex({ shopId: 1, branchId: 1 });
    await activeDb.collection('purchases').createIndex({ shopId: 1, branchId: 1 });
    await activeDb.collection('stockMovements').createIndex({ shopId: 1 });
    await activeDb.collection('returns').createIndex({ shopId: 1 });
    await activeDb.collection('auditLogs').createIndex({ shopId: 1, timestamp: -1 });

    return db;
  } catch (error) {
    console.error('[MongoDB] Connection failed. Fallback to local simulated storage:', error);
    db = null;
    mongoClient = null;
    return null;
  }
}

/**
 * Seed MongoDB collections with the initial SaaS baseline datasets on connection.
 */
async function seedDatabaseIfNeeded(database: Db) {
  const store = getStore();
  const collectionsToSeed = [
    { name: 'shops', data: store.shops },
    { name: 'branches', data: store.branches },
    { name: 'users', data: store.users },
    { name: 'suppliers', data: store.suppliers },
    { name: 'customers', data: store.customers },
    { name: 'products', data: store.products },
    { name: 'sales', data: store.sales },
    { name: 'purchases', data: store.purchases },
    { name: 'auditLogs', data: store.auditLogs },
    { name: 'quotations', data: store.quotations },
    { name: 'expenses', data: store.expenses || [] },
    { name: 'stockMovements', data: store.stockMovements || [] },
    { name: 'returns', data: store.returns || [] }
  ];

  for (const col of collectionsToSeed) {
    try {
      const count = await database.collection(col.name).countDocuments();
      if (count === 0 && col.data.length > 0) {
        console.log(`[MongoDB] Seeding collection "${col.name}" with ${col.data.length} baseline records...`);
        await database.collection(col.name).insertMany(col.data);
      }
    } catch (err) {
      console.error(`[MongoDB] Failed to seed collection "${col.name}":`, err);
    }
  }
}

// ==========================================
// 1. SHOPS (TENANTS) OPERATIONS
// ==========================================

export async function getShops(): Promise<Shop[]> {
  try {
    const database = await getDb();
    if (database) {
      const docs = await database.collection('shops').find().toArray();
      return cleanDocs<Shop>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch shops:', error);
  }
  return getStore().shops;
}

export async function saveShop(shop: Shop): Promise<Shop> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('shops').insertOne({ ...shop });
      return shop;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save shop:', error);
  }
  const store = getStore();
  store.shops.push(shop);
  saveStore(store);
  return shop;
}

export async function updateShop(id: string, shopData: Partial<Shop>): Promise<Shop | null> {
  try {
    const database = await getDb();
    if (database) {
      const res = await database.collection('shops').findOneAndUpdate(
        { id },
        { $set: shopData },
        { returnDocument: 'after' }
      );
      return res ? cleanDoc<Shop>(res) : null;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to update shop:', error);
  }
  const store = getStore();
  const idx = store.shops.findIndex(s => s.id === id);
  if (idx !== -1) {
    store.shops[idx] = { ...store.shops[idx], ...shopData };
    saveStore(store);
    return store.shops[idx];
  }
  return null;
}

export async function deleteShop(id: string): Promise<boolean> {
  try {
    const database = await getDb();
    if (database) {
      const res = await database.collection('shops').deleteOne({ id });
      return res.deletedCount > 0;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to delete shop:', error);
  }
  const store = getStore();
  const idx = store.shops.findIndex(s => s.id === id);
  if (idx !== -1) {
    store.shops.splice(idx, 1);
    saveStore(store);
    return true;
  }
  return false;
}

// ==========================================
// 2. BRANCHES OPERATIONS
// ==========================================

export async function getBranches(shopId: string = 'shop_default'): Promise<Branch[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter = shopId === 'super_admin_shop' ? {} : { shopId };
      const docs = await database.collection('branches').find(filter).toArray();
      return cleanDocs<Branch>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch branches:', error);
  }
  const branches = getStore().branches;
  if (shopId === 'super_admin_shop') return branches;
  return branches.filter(b => b.shopId === shopId);
}

export async function saveBranch(branch: Branch): Promise<Branch> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('branches').insertOne({ ...branch });
      return branch;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save branch:', error);
  }
  const store = getStore();
  store.branches.push(branch);
  saveStore(store);
  return branch;
}

// ==========================================
// 3. USERS OPERATIONS
// ==========================================

export async function getUsers(shopId: string = 'shop_default'): Promise<User[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter = shopId === 'super_admin_shop' ? {} : { shopId };
      const docs = await database.collection('users').find(filter).toArray();
      return cleanDocs<User>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch users:', error);
  }
  const users = getStore().users;
  if (shopId === 'super_admin_shop') return users;
  return users.filter(u => u.shopId === shopId);
}

export async function saveUser(user: User): Promise<User> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('users').insertOne({ ...user });
      return user;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save user:', error);
  }
  const store = getStore();
  store.users.push(user);
  saveStore(store);
  return user;
}

export async function updateUser(id: string, userData: Partial<User>): Promise<User | null> {
  try {
    const database = await getDb();
    if (database) {
      const res = await database.collection('users').findOneAndUpdate(
        { id },
        { $set: userData },
        { returnDocument: 'after' }
      );
      return res ? cleanDoc<User>(res) : null;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to update user:', error);
  }
  const store = getStore();
  const idx = store.users.findIndex(u => u.id === id);
  if (idx !== -1) {
    store.users[idx] = { ...store.users[idx], ...userData };
    saveStore(store);
    return store.users[idx];
  }
  return null;
}

// ==========================================
// 4. SUPPLIERS OPERATIONS
// ==========================================

export async function getSuppliers(shopId: string = 'shop_default'): Promise<Supplier[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter = shopId === 'super_admin_shop' ? {} : { shopId };
      const docs = await database.collection('suppliers').find(filter).toArray();
      return cleanDocs<Supplier>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch suppliers:', error);
  }
  const suppliers = getStore().suppliers;
  if (shopId === 'super_admin_shop') return suppliers;
  return suppliers.filter(s => s.shopId === shopId);
}

export async function saveSupplier(supplier: Supplier): Promise<Supplier> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('suppliers').insertOne({ ...supplier });
      return supplier;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save supplier:', error);
  }
  const store = getStore();
  store.suppliers.push(supplier);
  saveStore(store);
  return supplier;
}

// ==========================================
// 5. CUSTOMERS OPERATIONS
// ==========================================

export async function getCustomers(shopId: string = 'shop_default'): Promise<Customer[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter = shopId === 'super_admin_shop' ? {} : { shopId };
      const docs = await database.collection('customers').find(filter).toArray();
      return cleanDocs<Customer>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch customers:', error);
  }
  const customers = getStore().customers;
  if (shopId === 'super_admin_shop') return customers;
  return customers.filter(c => c.shopId === shopId);
}

export async function saveCustomer(customer: Customer): Promise<Customer> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('customers').insertOne({ ...customer });
      return customer;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save customer:', error);
  }
  const store = getStore();
  store.customers.push(customer);
  saveStore(store);
  return customer;
}

// ==========================================
// 6. PRODUCTS OPERATIONS
// ==========================================

export async function getProducts(branchId: string, shopId: string = 'shop_default'): Promise<Product[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter: any = {};
      if (shopId !== 'super_admin_shop') {
        filter.shopId = shopId;
      }
      if (branchId !== 'all') {
        filter.branchId = branchId;
      }
      const docs = await database.collection('products').find(filter).toArray();
      return cleanDocs<Product>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch products:', error);
  }
  const products = getStore().products;
  let list = shopId === 'super_admin_shop' ? products : products.filter(p => p.shopId === shopId);
  if (branchId !== 'all') {
    list = list.filter(p => p.branchId === branchId);
  }
  return list;
}

export async function saveProduct(product: Product): Promise<Product> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('products').insertOne({ ...product });
      return product;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save product:', error);
  }
  const store = getStore();
  store.products.push(product);
  saveStore(store);
  return product;
}

export async function updateProduct(id: string, productData: Partial<Product>, shopId: string = 'shop_default'): Promise<Product | null> {
  try {
    const database = await getDb();
    if (database) {
      const filter: any = { id };
      if (shopId !== 'super_admin_shop') {
        filter.shopId = shopId;
      }
      const res = await database.collection('products').findOneAndUpdate(
        filter,
        { $set: { ...productData, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' }
      );
      return res ? cleanDoc<Product>(res) : null;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to update product:', error);
  }

  const store = getStore();
  const idx = store.products.findIndex(p => p.id === id && (shopId === 'super_admin_shop' || p.shopId === shopId));
  if (idx !== -1) {
    const existing = store.products[idx];
    const quantity = productData.quantity !== undefined ? productData.quantity : existing.quantity;
    const minQuantity = productData.minQuantity !== undefined ? productData.minQuantity : existing.minQuantity;
    const updatedStatus = quantity === 0 ? 'Out of Stock' : quantity <= minQuantity ? 'Low Stock' : 'In Stock';

    const updatedProduct: Product = {
      ...existing,
      ...productData,
      status: updatedStatus,
      updatedAt: new Date().toISOString(),
    };
    store.products[idx] = updatedProduct;
    saveStore(store);
    return updatedProduct;
  }
  return null;
}

export async function deleteProduct(id: string, shopId: string = 'shop_default'): Promise<boolean> {
  try {
    const database = await getDb();
    if (database) {
      const filter: any = { id };
      if (shopId !== 'super_admin_shop') {
        filter.shopId = shopId;
      }
      const res = await database.collection('products').deleteOne(filter);
      return res.deletedCount > 0;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to delete product:', error);
  }
  const store = getStore();
  const idx = store.products.findIndex(p => p.id === id && (shopId === 'super_admin_shop' || p.shopId === shopId));
  if (idx !== -1) {
    store.products.splice(idx, 1);
    saveStore(store);
    return true;
  }
  return false;
}

// ==========================================
// 7. SALES TRANSACTIONS (POS)
// ==========================================

export async function getSales(branchId: string, shopId: string = 'shop_default'): Promise<Sale[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter: any = {};
      if (shopId !== 'super_admin_shop') {
        filter.shopId = shopId;
      }
      if (branchId !== 'all') {
        filter.branchId = branchId;
      }
      const docs = await database.collection('sales').find(filter).sort({ timestamp: -1 }).toArray();
      return cleanDocs<Sale>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch sales:', error);
  }
  const sales = getStore().sales;
  let list = shopId === 'super_admin_shop' ? sales : sales.filter(s => s.shopId === shopId);
  if (branchId !== 'all') {
    list = list.filter(s => s.branchId === branchId);
  }
  return list;
}

export async function saveSale(sale: Sale): Promise<Sale> {
  try {
    const database = await getDb();
    if (database) {
      // Deduct quantities
      for (const item of sale.items) {
        const prod = await database.collection('products').findOne({ id: item.productId, shopId: sale.shopId });
        if (prod) {
          const newQty = Math.max(0, (prod.quantity || 0) - item.quantity);
          const newStatus = newQty === 0 ? 'Out of Stock' : newQty <= (prod.minQuantity || 0) ? 'Low Stock' : 'In Stock';
          await database.collection('products').updateOne(
            { id: item.productId, shopId: sale.shopId },
            { $set: { quantity: newQty, status: newStatus, updatedAt: new Date().toISOString() } }
          );
        }
      }

      // Add loyalty points
      if (sale.customerId) {
        const cust = await database.collection('customers').findOne({ id: sale.customerId, shopId: sale.shopId });
        if (cust) {
          const currentPoints = cust.loyaltyPoints || 0;
          const pointsEarned = Math.floor(sale.total / 10);
          await database.collection('customers').updateOne(
            { id: sale.customerId, shopId: sale.shopId },
            { $set: { loyaltyPoints: currentPoints + pointsEarned, purchaseHistoryCount: (cust.purchaseHistoryCount || 0) + 1 } }
          );
        }
      }

      await database.collection('sales').insertOne({ ...sale });
      return sale;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save sale:', error);
  }

  // Fallback memory state
  const store = getStore();
  for (const item of sale.items) {
    const prod = store.products.find(p => p.id === item.productId && p.shopId === sale.shopId);
    if (prod) {
      prod.quantity = Math.max(0, prod.quantity - item.quantity);
      prod.status = prod.quantity === 0 ? 'Out of Stock' : prod.quantity <= prod.minQuantity ? 'Low Stock' : 'In Stock';
      prod.updatedAt = new Date().toISOString();
    }
  }

  if (sale.customerId) {
    const cust = store.customers.find(c => c.id === sale.customerId && c.shopId === sale.shopId);
    if (cust) {
      cust.loyaltyPoints = (cust.loyaltyPoints || 0) + Math.floor(sale.total / 10);
      cust.purchaseHistoryCount = (cust.purchaseHistoryCount || 0) + 1;
    }
  }

  store.sales.unshift(sale);
  saveStore(store);
  return sale;
}

// ==========================================
// 8. PURCHASES & STOCK RECEIVING
// ==========================================

export async function getPurchases(branchId: string, shopId: string = 'shop_default'): Promise<PurchaseOrder[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter: any = {};
      if (shopId !== 'super_admin_shop') {
        filter.shopId = shopId;
      }
      if (branchId !== 'all') {
        filter.branchId = branchId;
      }
      const docs = await database.collection('purchases').find(filter).sort({ createdAt: -1 }).toArray();
      return cleanDocs<PurchaseOrder>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch purchases:', error);
  }
  const purchases = getStore().purchases;
  let list = shopId === 'super_admin_shop' ? purchases : purchases.filter(p => p.shopId === shopId);
  if (branchId !== 'all') {
    list = list.filter(p => p.branchId === branchId);
  }
  return list;
}

export async function savePurchase(purchase: PurchaseOrder): Promise<PurchaseOrder> {
  try {
    const database = await getDb();
    if (database) {
      if (purchase.status === 'Received') {
        for (const item of purchase.items) {
          const prod = await database.collection('products').findOne({ id: item.productId, shopId: purchase.shopId });
          if (prod) {
            const newQty = (prod.quantity || 0) + item.quantityReceived;
            const newStatus = newQty === 0 ? 'Out of Stock' : newQty <= (prod.minQuantity || 0) ? 'Low Stock' : 'In Stock';
            await database.collection('products').updateOne(
              { id: item.productId, shopId: purchase.shopId },
              { $set: { quantity: newQty, status: newStatus, updatedAt: new Date().toISOString() } }
            );
          }
        }
      }
      await database.collection('purchases').insertOne({ ...purchase });
      return purchase;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save purchase:', error);
  }

  const store = getStore();
  if (purchase.status === 'Received') {
    purchase.items.forEach(item => {
      const prod = store.products.find(p => p.id === item.productId && p.shopId === purchase.shopId);
      if (prod) {
        prod.quantity += item.quantityReceived;
        prod.status = prod.quantity === 0 ? 'Out of Stock' : prod.quantity <= prod.minQuantity ? 'Low Stock' : 'In Stock';
        prod.updatedAt = new Date().toISOString();
      }
    });
  }
  store.purchases.unshift(purchase);
  saveStore(store);
  return purchase;
}

// ==========================================
// 9. QUOTATIONS
// ==========================================

export async function getQuotations(branchId: string, shopId: string = 'shop_default'): Promise<Quotation[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter: any = {};
      if (shopId !== 'super_admin_shop') {
        filter.shopId = shopId;
      }
      if (branchId !== 'all') {
        filter.branchId = branchId;
      }
      const docs = await database.collection('quotations').find(filter).sort({ timestamp: -1 }).toArray();
      return cleanDocs<Quotation>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch quotations:', error);
  }
  const quotations = getStore().quotations;
  let list = shopId === 'super_admin_shop' ? quotations : quotations.filter(q => q.shopId === shopId);
  if (branchId !== 'all') {
    list = list.filter(q => q.branchId === branchId);
  }
  return list;
}

export async function saveQuotation(quotation: Quotation): Promise<Quotation> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('quotations').insertOne({ ...quotation });
      return quotation;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save quotation:', error);
  }
  const store = getStore();
  store.quotations.unshift(quotation);
  saveStore(store);
  return quotation;
}

// ==========================================
// 10. EXPENSES
// ==========================================

export async function getExpenses(branchId: string, shopId: string = 'shop_default'): Promise<Expense[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter: any = {};
      if (shopId !== 'super_admin_shop') {
        filter.shopId = shopId;
      }
      if (branchId !== 'all') {
        filter.branchId = branchId;
      }
      const docs = await database.collection('expenses').find(filter).sort({ date: -1 }).toArray();
      return cleanDocs<Expense>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch expenses:', error);
  }
  const store = getStore();
  let list = shopId === 'super_admin_shop' ? store.expenses : store.expenses.filter(e => e.shopId === shopId);
  if (branchId !== 'all') {
    list = list.filter(e => e.branchId === branchId);
  }
  return list;
}

export async function saveExpense(expense: Expense): Promise<Expense> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('expenses').insertOne({ ...expense });
      return expense;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save expense:', error);
  }
  const store = getStore();
  store.expenses.unshift(expense);
  saveStore(store);
  return expense;
}

// ==========================================
// 11. STOCK MOVEMENTS (BRANCH TRANSFERS)
// ==========================================

export async function getStockMovements(shopId: string = 'shop_default'): Promise<StockMovement[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter = shopId === 'super_admin_shop' ? {} : { shopId };
      const docs = await database.collection('stockMovements').find(filter).sort({ timestamp: -1 }).toArray();
      return cleanDocs<StockMovement>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch stock movements:', error);
  }
  const movements = getStore().stockMovements || [];
  if (shopId === 'super_admin_shop') return movements;
  return movements.filter(m => m.shopId === shopId);
}

export async function saveStockMovement(movement: StockMovement): Promise<StockMovement> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('stockMovements').insertOne({ ...movement });

      // If status is Completed, we perform inventory deduct & add between branches
      if (movement.status === 'Completed') {
        await executeStockMovementTransfer(database, movement);
      }
      return movement;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save stock movement:', error);
  }
  const store = getStore();
  if (movement.status === 'Completed') {
    executeLocalStockMovementTransfer(store, movement);
  }
  store.stockMovements.unshift(movement);
  saveStore(store);
  return movement;
}

export async function updateStockMovement(id: string, movementData: Partial<StockMovement>, shopId: string = 'shop_default'): Promise<StockMovement | null> {
  try {
    const database = await getDb();
    if (database) {
      const res = await database.collection('stockMovements').findOneAndUpdate(
        { id, shopId },
        { $set: movementData },
        { returnDocument: 'after' }
      );
      if (res && movementData.status === 'Completed') {
        const fullMovement = cleanDoc<StockMovement>(res);
        await executeStockMovementTransfer(database, fullMovement);
      }
      return res ? cleanDoc<StockMovement>(res) : null;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to update stock movement:', error);
  }
  const store = getStore();
  const idx = store.stockMovements.findIndex(m => m.id === id && m.shopId === shopId);
  if (idx !== -1) {
    store.stockMovements[idx] = { ...store.stockMovements[idx], ...movementData };
    if (movementData.status === 'Completed') {
      executeLocalStockMovementTransfer(store, store.stockMovements[idx]);
    }
    saveStore(store);
    return store.stockMovements[idx];
  }
  return null;
}

async function executeStockMovementTransfer(database: Db, m: StockMovement) {
  if (m.fromBranchId) {
    // Deduct
    const prodSource = await database.collection('products').findOne({ id: m.productId, shopId: m.shopId, branchId: m.fromBranchId });
    if (prodSource) {
      const sourceQty = Math.max(0, (prodSource.quantity || 0) - m.quantity);
      const sourceStatus = sourceQty === 0 ? 'Out of Stock' : sourceQty <= (prodSource.minQuantity || 0) ? 'Low Stock' : 'In Stock';
      await database.collection('products').updateOne(
        { id: m.productId, shopId: m.shopId, branchId: m.fromBranchId },
        { $set: { quantity: sourceQty, status: sourceStatus, updatedAt: new Date().toISOString() } }
      );
    }
  }
  if (m.toBranchId) {
    // Add or Create target branch product
    const prodTarget = await database.collection('products').findOne({ id: m.productId, shopId: m.shopId, branchId: m.toBranchId });
    if (prodTarget) {
      const targetQty = (prodTarget.quantity || 0) + m.quantity;
      const targetStatus = targetQty === 0 ? 'Out of Stock' : targetQty <= (prodTarget.minQuantity || 0) ? 'Low Stock' : 'In Stock';
      await database.collection('products').updateOne(
        { id: m.productId, shopId: m.shopId, branchId: m.toBranchId },
        { $set: { quantity: targetQty, status: targetStatus, updatedAt: new Date().toISOString() } }
      );
    } else {
      // Find source to copy product description details
      const sourceDetails = await database.collection('products').findOne({ id: m.productId, shopId: m.shopId });
      if (sourceDetails) {
        const { _id, ...copied } = sourceDetails;
        const newBranchProd: Product = {
          ...copied as Product,
          id: m.productId + '_' + m.toBranchId,
          branchId: m.toBranchId,
          quantity: m.quantity,
          status: m.quantity === 0 ? 'Out of Stock' : m.quantity <= (copied.minQuantity || 10) ? 'Low Stock' : 'In Stock',
          updatedAt: new Date().toISOString()
        };
        await database.collection('products').insertOne(newBranchProd);
      }
    }
  }
}

function executeLocalStockMovementTransfer(store: DBStore, m: StockMovement) {
  if (m.fromBranchId) {
    const prodSource = store.products.find(p => p.id === m.productId && p.shopId === m.shopId && p.branchId === m.fromBranchId);
    if (prodSource) {
      prodSource.quantity = Math.max(0, prodSource.quantity - m.quantity);
      prodSource.status = prodSource.quantity === 0 ? 'Out of Stock' : prodSource.quantity <= prodSource.minQuantity ? 'Low Stock' : 'In Stock';
      prodSource.updatedAt = new Date().toISOString();
    }
  }
  if (m.toBranchId) {
    const prodTarget = store.products.find(p => p.id === m.productId && p.shopId === m.shopId && p.branchId === m.toBranchId);
    if (prodTarget) {
      prodTarget.quantity += m.quantity;
      prodTarget.status = prodTarget.quantity === 0 ? 'Out of Stock' : prodTarget.quantity <= prodTarget.minQuantity ? 'Low Stock' : 'In Stock';
      prodTarget.updatedAt = new Date().toISOString();
    } else {
      const source = store.products.find(p => p.id === m.productId && p.shopId === m.shopId);
      if (source) {
        const newBranchProd: Product = {
          ...source,
          id: m.productId + '_' + m.toBranchId,
          branchId: m.toBranchId,
          quantity: m.quantity,
          status: m.quantity === 0 ? 'Out of Stock' : m.quantity <= source.minQuantity ? 'Low Stock' : 'In Stock',
          updatedAt: new Date().toISOString()
        };
        store.products.push(newBranchProd);
      }
    }
  }
}

// ==========================================
// 12. RETURNS
// ==========================================

export async function getReturns(shopId: string = 'shop_default'): Promise<Return[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter = shopId === 'super_admin_shop' ? {} : { shopId };
      const docs = await database.collection('returns').find(filter).sort({ timestamp: -1 }).toArray();
      return cleanDocs<Return>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch returns:', error);
  }
  const returns = getStore().returns || [];
  if (shopId === 'super_admin_shop') return returns;
  return returns.filter(r => r.shopId === shopId);
}

export async function saveReturn(returnObj: Return): Promise<Return> {
  try {
    const database = await getDb();
    if (database) {
      await database.collection('returns').insertOne({ ...returnObj });

      // Add back inventory items to products
      for (const item of returnObj.items) {
        const prod = await database.collection('products').findOne({ id: item.productId, shopId: returnObj.shopId, branchId: returnObj.branchId });
        if (prod) {
          const newQty = (prod.quantity || 0) + item.quantity;
          const newStatus = newQty === 0 ? 'Out of Stock' : newQty <= (prod.minQuantity || 0) ? 'Low Stock' : 'In Stock';
          await database.collection('products').updateOne(
            { id: item.productId, shopId: returnObj.shopId, branchId: returnObj.branchId },
            { $set: { quantity: newQty, status: newStatus, updatedAt: new Date().toISOString() } }
          );
        }
      }

      // Set status of sale to Returned or Refunded
      await database.collection('sales').updateOne(
        { id: returnObj.saleId, shopId: returnObj.shopId },
        { $set: { status: 'Returned' } }
      );

      return returnObj;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to save return:', error);
  }
  const store = getStore();
  // Return inventory items
  for (const item of returnObj.items) {
    const prod = store.products.find(p => p.id === item.productId && p.shopId === returnObj.shopId && p.branchId === returnObj.branchId);
    if (prod) {
      prod.quantity += item.quantity;
      prod.status = prod.quantity === 0 ? 'Out of Stock' : prod.quantity <= prod.minQuantity ? 'Low Stock' : 'In Stock';
      prod.updatedAt = new Date().toISOString();
    }
  }
  // Update sale status
  const sale = store.sales.find(s => s.id === returnObj.saleId && s.shopId === returnObj.shopId);
  if (sale) {
    sale.status = 'Returned';
  }
  store.returns.unshift(returnObj);
  saveStore(store);
  return returnObj;
}

// ==========================================
// 13. AUDIT LOGS
// ==========================================

export async function getAuditLogs(shopId: string = 'shop_default'): Promise<AuditLog[]> {
  try {
    const database = await getDb();
    if (database) {
      const filter = shopId === 'super_admin_shop' ? {} : { shopId };
      const docs = await database.collection('auditLogs').find(filter).sort({ timestamp: -1 }).toArray();
      return cleanDocs<AuditLog>(docs);
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to fetch audit logs:', error);
  }
  const auditLogs = getStore().auditLogs;
  if (shopId === 'super_admin_shop') return auditLogs;
  return auditLogs.filter(a => a.shopId === shopId);
}

export async function logAudit(
  userId: string, 
  action: string, 
  details: string, 
  branchId: string, 
  shopId: string = 'shop_default',
  ipAddress: string = '127.0.0.1',
  device: string = 'System Web App'
): Promise<void> {
  try {
    const database = await getDb();
    let userName = 'Unknown';
    let userRole = UserRole.CASHIER;

    if (database) {
      const userDoc = await database.collection('users').findOne({ id: userId });
      if (userDoc) {
        userName = userDoc.fullname || userDoc.username || 'Unknown';
        userRole = userDoc.role || UserRole.CASHIER;
      }
      const newLog: AuditLog = {
        id: 'log_' + Math.random().toString(36).substr(2, 9),
        shopId,
        userId,
        userName,
        userRole,
        action,
        details,
        timestamp: new Date().toISOString(),
        branchId,
        ipAddress,
        device
      };
      await database.collection('auditLogs').insertOne(newLog);
      return;
    }
  } catch (error) {
    console.error('[MongoDB Error] Failed to log audit:', error);
  }

  // Fallback state
  const store = getStore();
  const user = store.users.find(u => u.id === userId);
  const newLog: AuditLog = {
    id: 'log_' + Math.random().toString(36).substr(2, 9),
    shopId,
    userId,
    userName: user ? user.fullname || user.username : 'Unknown',
    userRole: user ? user.role : UserRole.CASHIER,
    action,
    details,
    timestamp: new Date().toISOString(),
    branchId,
    ipAddress,
    device
  };
  store.auditLogs.unshift(newLog);
  saveStore(store);
}

// ==========================================
// 14. SYNC ENGINE (OFFLINE SUPPORT)
// ==========================================

export async function syncOfflineQueue(offlineQueue: any[], branchId: string, shopId: string = 'shop_default') {
  try {
    const database = await getDb();
    let syncCount = 0;
    let conflictCount = 0;

    if (offlineQueue && Array.isArray(offlineQueue)) {
      for (const item of offlineQueue) {
        // Sync sales
        if (item.table === 'sales' && item.action === 'INSERT') {
          const sale: Sale = item.payload;
          sale.shopId = shopId; // Force correct tenant isolation
          
          if (database) {
            const exists = await database.collection('sales').findOne({
              shopId,
              $or: [{ id: sale.id }, { invoiceNumber: sale.invoiceNumber }]
            });
            if (!exists) {
              await saveSale(sale);
              syncCount++;
            }
          } else {
            const store = getStore();
            const exists = store.sales.some(s => s.shopId === shopId && (s.id === sale.id || s.invoiceNumber === sale.invoiceNumber));
            if (!exists) {
              const syncedSale = { ...sale, isOffline: false, syncedAt: new Date().toISOString() };
              store.sales.unshift(syncedSale);
              syncCount++;
            }
          }
        }

        // Sync product level adjustments
        if (item.table === 'products' && item.action === 'UPDATE') {
          const clientProd: Product = item.payload;
          clientProd.shopId = shopId;

          if (database) {
            const serverProd = await database.collection('products').findOne({ id: clientProd.id, shopId });
            if (serverProd) {
              const clientTime = new Date(clientProd.updatedAt).getTime();
              const serverTime = new Date(serverProd.updatedAt).getTime();

              if (clientTime > serverTime) {
                await updateProduct(clientProd.id, clientProd, shopId);
                syncCount++;
              } else {
                conflictCount++;
              }
            }
          } else {
            const store = getStore();
            const serverProdIdx = store.products.findIndex(p => p.id === clientProd.id && p.shopId === shopId);
            if (serverProdIdx !== -1) {
              const serverProd = store.products[serverProdIdx];
              const clientTime = new Date(clientProd.updatedAt).getTime();
              const serverTime = new Date(serverProd.updatedAt).getTime();

              if (clientTime > serverTime) {
                store.products[serverProdIdx] = { ...clientProd, updatedAt: new Date().toISOString() };
                syncCount++;
              } else {
                conflictCount++;
              }
            }
          }
        }
      }
    }

    if (syncCount > 0) {
      await logAudit('u1', 'SYNC_ENGINE', `Synced ${syncCount} offline records from branch ${branchId}. Conflicts: ${conflictCount}`, branchId, shopId);
    }

    const latestProducts = await getProducts(branchId, shopId);
    const latestSales = await getSales(branchId, shopId);
    const latestQuotations = await getQuotations(branchId, shopId);
    const latestSuppliers = await getSuppliers(shopId);
    const latestCustomers = await getCustomers(shopId);

    return {
      success: true,
      syncedRecords: syncCount,
      conflictsResolved: conflictCount,
      latestProducts,
      latestSuppliers,
      latestCustomers,
      latestSales,
      latestQuotations,
    };
  } catch (error) {
    console.error('[MongoDB Sync Error] Fallback default return:', error);
    const latestProducts = await getProducts(branchId, shopId);
    const latestSales = await getSales(branchId, shopId);
    const latestQuotations = await getQuotations(branchId, shopId);
    const latestSuppliers = await getSuppliers(shopId);
    const latestCustomers = await getCustomers(shopId);

    return {
      success: true,
      syncedRecords: 0,
      conflictsResolved: 0,
      latestProducts,
      latestSuppliers,
      latestCustomers,
      latestSales,
      latestQuotations,
    };
  }
}
