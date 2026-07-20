/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as dbManager from './src/db_manager.ts';
import { 
  Product, Sale, PurchaseOrder, User, Supplier, Customer, UserRole, AuditLog, Quotation, Shop, Expense, StockMovement, Return, Branch 
} from './src/types.ts';
import { sanitizeTenantBody, sanitizeTenantQuery } from './src/saas/tenant.ts';
import { loginUser, validateTenantAccess } from './src/saas/services/tenantService.ts';
import { createProduct, deleteProduct, listProducts, updateProduct } from './src/saas/services/catalogService.ts';
import { createPurchase, createReturn, createSale, listPurchases, listSales } from './src/saas/services/transactionService.ts';
import { syncOfflineData } from './src/saas/services/syncService.ts';
import { createShop, deleteShop, getAllShops, resetShopOwnerPassword, updateShop } from './src/saas/controllers/shopController.ts';
import { createBranch, getBranches } from './src/saas/controllers/branchController.ts';
import { createUser, listUsers } from './src/saas/controllers/userController.ts';
import { listSuppliers, createSupplier } from './src/saas/controllers/supplierController.ts';
import { listCustomers, createCustomer } from './src/saas/controllers/customerController.ts';
import { listSalesForTenant, createSalesTransaction } from './src/saas/controllers/salesController.ts';
import { listPurchaseOrders, createPurchaseOrder } from './src/saas/controllers/purchaseController.ts';
import { listExpenses, createExpense } from './src/saas/controllers/expenseController.ts';
import { getDashboardStats } from './src/saas/controllers/dashboardController.ts';
import { listStockMovements, createStockMovement, updateStockMovement } from './src/saas/controllers/stockMovementController.ts';
import { createReturnTransaction, listReturns } from './src/saas/controllers/returnController.ts';
import { listQuotations, createQuotation } from './src/saas/controllers/quotationController.ts';
import { listAuditLogs } from './src/saas/controllers/auditController.ts';

const SECRET_KEY = process.env.JWT_SECRET || 'cobult-stocks-saas-super-secret-key-99821';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing limits
  app.use(express.json({ limit: '10mb' }));

  // Helper to log audit logs asynchronously
  const logAudit = async (
    userId: string, 
    action: string, 
    details: string, 
    branchId: string, 
    shopId: string,
    req: express.Request
  ) => {
    try {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const device = req.headers['user-agent'] || 'System Web App';
      await dbManager.logAudit(userId, action, details, branchId, shopId, ip, device);
    } catch (err) {
      console.error('[Audit] Failed to record audit log:', err);
    }
  };

  // ==========================================
  // MIDDLEWARES FOR SAAS TENANT SECURITY & RBAC
  // ==========================================

  // Authentication Middleware: validates the JWT token or falls back gracefully
  const authenticate = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const token = authHeader.split(' ')[1];
      const decoded: any = jwt.verify(token, SECRET_KEY);

      const tenantValidation = await validateTenantAccess(decoded);
      if (!tenantValidation.allowed) {
        return res.status(403).json({ error: tenantValidation.message });
      }

      req.user = decoded;
      return next();
    } catch (err) {
      console.warn('[Auth Middleware] Invalid token:', err);
      return res.status(401).json({ error: 'Authentication required.' });
    }
  };

  // Role Based Access Control: restricts actions based on user roles
  const authorize = (...allowedRoles: UserRole[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access Denied: Insufficient Permissions.' });
      }
      next();
    };
  };

  // Tenant isolation middleware: ignore any shopId sent by the client and always
  // bind all reads/writes to the authenticated user's tenant context.
  const tenantFilter = (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const tenant = sanitizeTenantBody(req);
    sanitizeTenantQuery(req);

    req.tenantShopId = tenant.shopId;
    req.tenantBranchId = tenant.branchId;
    next();
  };

  // ==========================================
  // 1. API: AUTHENTICATION (SECURE BYCRYPT)
  // ==========================================

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      const loginKey = (username || email || '').toLowerCase();
      const result = await loginUser(loginKey, password);

      if (!result.success || !result.user || !result.token) {
        const status = result.error?.toLowerCase().includes('password') ? 401 : 403;
        return res.status(status).json({ success: false, error: result.error });
      }

      await logAudit(
        result.user.id,
        'LOGIN',
        `User ${result.user.fullname || result.user.username} logged in successfully`,
        result.user.branchId || 'b1',
        result.user.shopId || 'shop_default',
        req
      );

      res.json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } catch (err: any) {
      console.error('[API Auth] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 2. API: SUPER ADMIN DASHBOARD
  // ==========================================

  // Get SaaS Metrics and global stats
  app.get('/api/super/stats', authenticate, authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
    try {
      const shops = await dbManager.getShops();
      const users = await dbManager.getUsers('super_admin_shop');
      const branches = await dbManager.getBranches('super_admin_shop');
      const sales = await dbManager.getSales('all', 'super_admin_shop');

      const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

      res.json({
        totalShops: shops.length,
        activeShops: shops.filter(s => s.status === 'Active').length,
        totalRevenue,
        totalSalesCount: sales.length,
        totalUsers: users.length,
        totalBranches: branches.length,
        recentShops: shops.slice(-5)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get All Shops
  app.get('/api/super/shops', authenticate, authorize(UserRole.SUPER_ADMIN), getAllShops);

  // Create Shop Tenant & Auto-provision Owner
  app.post('/api/super/shops', authenticate, authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
    try {
      await createShop(req, res);
      if (res.statusCode === 201) {
        await logAudit(req.user.userId, 'CREATE_SHOP', `Super Admin created Shop ${req.body.shopName}`, 'N/A', 'super_admin_shop', req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Suspend/Activate/Update Subscription Status of Shop
  app.put('/api/super/shops/:id', authenticate, authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
    try {
      await updateShop(req, res);
      if (res.statusCode < 400) {
        await logAudit(req.user.userId, 'UPDATE_SHOP', `Super Admin updated Shop status (ID: ${req.params.id})`, 'N/A', 'super_admin_shop', req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete Shop
  app.delete('/api/super/shops/:id', authenticate, authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
    try {
      await deleteShop(req, res);
      if (res.statusCode < 400) {
        await logAudit(req.user.userId, 'DELETE_SHOP', `Super Admin deleted Shop (ID: ${req.params.id})`, 'N/A', 'super_admin_shop', req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset Owner Password
  app.put('/api/super/reset-owner-password', authenticate, authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
    try {
      await resetShopOwnerPassword(req, res);
      if (res.statusCode < 400) {
        await logAudit(req.user.userId, 'PASSWORD_RESET', `Super Admin reset owner password for Shop ID: ${req.body.shopId}`, 'N/A', 'super_admin_shop', req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 3. API: DASHBOARD STATS (TENANT ISOLATED)
  // ==========================================
  app.get('/api/dashboard/stats', authenticate, tenantFilter, getDashboardStats);

  // ==========================================
  // 4. API: PRODUCTS (INVENTORY - TENANT ISOLATED)
  // ==========================================
  app.get('/api/products', authenticate, tenantFilter, async (req: any, res) => {
    try {
      const branchId = (req.query.branchId as string) || req.user.branchId || 'b1';
      const products = await listProducts(branchId, req.user.shopId);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), async (req: any, res) => {
    try {
      const productData: Product = req.body;
      const saved = await createProduct(productData, req.user);
      await logAudit(req.user.userId, 'CREATE_PRODUCT', `Created product ${saved.name} (${saved.sku})`, saved.branchId, req.user.shopId, req);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), async (req: any, res) => {
    try {
      const { id } = req.params;
      const updated = await updateProduct(id, req.body, req.user.shopId);
      if (updated) {
        await logAudit(req.user.userId, 'UPDATE_PRODUCT', `Updated product ${updated.name}`, updated.branchId, req.user.shopId, req);
        res.json(updated);
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', authenticate, tenantFilter, authorize(UserRole.OWNER), async (req: any, res) => {
    try {
      const { id } = req.params;
      const products = await dbManager.getProducts('all', req.user.shopId);
      const target = products.find(p => p.id === id);
      
      if (target) {
        const success = await deleteProduct(id, req.user.shopId);
        if (success) {
          await logAudit(req.user.userId, 'DELETE_PRODUCT', `Deleted product ${target.name}`, target.branchId, req.user.shopId, req);
          res.json({ success: true, removedId: id });
        } else {
          res.status(500).json({ error: 'Failed to delete product' });
        }
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 5. API: SUPPLIERS & CUSTOMERS (TENANT ISOLATED)
  // ==========================================
  app.get('/api/suppliers', authenticate, tenantFilter, listSuppliers);

  app.post('/api/suppliers', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), createSupplier);

  app.get('/api/customers', authenticate, tenantFilter, listCustomers);

  app.post('/api/customers', authenticate, tenantFilter, createCustomer);

  // ==========================================
  // 6. API: SALES & POS (TENANT ISOLATED)
  // ==========================================
  app.get('/api/sales', authenticate, tenantFilter, listSalesForTenant);

  app.post('/api/sales', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER), async (req: any, res) => {
    try {
      await createSalesTransaction(req, res);
      if (res.statusCode < 400) {
        const saved = res.locals?.savedSale;
        if (saved) {
          await logAudit(saved.cashierId, 'NEW_SALE', `Completed Sale ${saved.invoiceNumber} for $${saved.total.toFixed(2)}`, saved.branchId, req.user.shopId, req);
        }
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 7. API: PURCHASES & STOCK RECEIVING (TENANT ISOLATED)
  // ==========================================
  app.get('/api/purchases', authenticate, tenantFilter, listPurchaseOrders);

  app.post('/api/purchases', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), async (req: any, res) => {
    try {
      await createPurchaseOrder(req, res);
      if (res.statusCode < 400) {
        const saved = res.locals?.savedPurchase;
        if (saved) {
          await logAudit(req.user.userId, 'CREATE_PURCHASE', `Created Purchase Order ${saved.orderNumber} for $${saved.totalAmount.toFixed(2)}`, saved.branchId, req.user.shopId, req);
        }
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 8. API: EXPENSES (NEW FUNCTIONALITY)
  // ==========================================
  app.get('/api/expenses', authenticate, tenantFilter, listExpenses);

  app.post('/api/expenses', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), async (req: any, res) => {
    try {
      await createExpense(req, res);
      if (res.statusCode === 201) {
        await logAudit(req.user.userId, 'CREATE_EXPENSE', `Recorded expense: ${req.body.title} - $${req.body.amount}`, req.user.branchId, req.user.shopId, req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 9. API: STOCK MOVEMENTS / TRANSFERS
  // ==========================================
  app.get('/api/stock-movements', authenticate, tenantFilter, listStockMovements);

  app.post('/api/stock-movements', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), async (req: any, res) => {
    try {
      await createStockMovement(req, res);
      if (res.statusCode === 201) {
        await logAudit(req.user.userId, 'STOCK_TRANSFER', `Initiated stock transfer: ${req.body.productName} qty ${req.body.quantity}`, req.body.fromBranchId || 'b1', req.user.shopId, req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/stock-movements/:id', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), async (req: any, res) => {
    try {
      await updateStockMovement(req, res);
      if (res.statusCode < 400) {
        await logAudit(req.user.userId, 'STOCK_TRANSFER_UPDATE', `Approved stock transfer ID ${req.params.id} - status ${req.body.status}`, req.body.fromBranchId || 'b1', req.user.shopId, req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 10. API: RETURNS (CASHIER / MANAGER)
  // ==========================================
  app.get('/api/returns', authenticate, tenantFilter, listReturns);

  app.post('/api/returns', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER), async (req: any, res) => {
    try {
      await createReturnTransaction(req, res);
      if (res.statusCode === 201) {
        await logAudit(req.user.userId, 'SALE_RETURN', `Recorded item returns for invoice ${req.body.invoiceNumber}`, req.body.branchId || 'b1', req.user.shopId, req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 11. API: BRANCHES MANAGEMENT
  // ==========================================
  app.get('/api/branches', authenticate, tenantFilter, getBranches);

  app.post('/api/branches', authenticate, tenantFilter, authorize(UserRole.OWNER), async (req: any, res) => {
    try {
      await createBranch(req, res);
      // The created branch is now available in res.locals from the controller
      const newBranch = res.locals.newBranch;
      if (res.statusCode === 201 && newBranch) {
        await logAudit(req.user.userId, 'CREATE_BRANCH', `Created Branch: ${newBranch.name}`, newBranch.id, req.user.shopId, req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 12. API: EMPLOYEES / USERS PROVISIONING
  // ==========================================
  app.get('/api/users', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), listUsers);

  app.post('/api/users', authenticate, tenantFilter, authorize(UserRole.OWNER, UserRole.MANAGER), async (req: any, res) => {
    try {
      await createUser(req, res);
      if (res.statusCode === 201) {
        await logAudit(req.user.userId, 'PROVISION_USER', `Created employee user: ${req.body.fullname} (${req.body.role || UserRole.CASHIER})`, req.body.branchId || 'b1', req.user.shopId, req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 13. API: OFFLINE-FIRST SYNCHRONIZATION ENGINE
  // ==========================================
  app.post('/api/sync', authenticate, tenantFilter, async (req: any, res) => {
    try {
      const { offlineQueue, branchId } = req.body;
      const syncResult = await syncOfflineData(offlineQueue, branchId, req.user.shopId);
      res.json(syncResult);
    } catch (err: any) {
      console.error('[API Sync] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 14. API: QUOTATIONS (TENANT ISOLATED)
  // ==========================================
  app.get('/api/quotations', authenticate, tenantFilter, listQuotations);

  app.post('/api/quotations', authenticate, tenantFilter, async (req: any, res) => {
    try {
      await createQuotation(req, res);
      if (res.statusCode === 201) {
        await logAudit(req.body.cashierId, 'CREATE_QUOTATION', `Created Quotation ${req.body.quotationNumber} for customer ${req.body.customerName || 'Walk-in'} - Total: $${req.body.total.toFixed(2)}`, req.body.branchId || 'b1', req.user.shopId, req);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 15. API: AUDIT LOGS (TENANT ISOLATED)
  // ==========================================
  app.get('/api/audit-logs', authenticate, tenantFilter, authorize(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER), listAuditLogs);

  // ==========================================
  // 16. API: SYSTEM SETTINGS
  // ==========================================
  app.get('/api/settings', authenticate, (req: any, res) => {
    res.json({
      storeName: 'Cobult Stocks Retail',
      taxPercentage: 15,
      currencySymbol: 'USD',
      vatNumber: 'VAT-789-201-99',
      receiptHeader: 'Welcome to Cobult Stocks!',
      receiptFooter: 'Thank you for your business. Please come again!',
      returnPolicy: 'Returns only allowed within 7 days with valid receipt.',
      autoBackup: true,
      syncIntervalSeconds: 30,
    });
  });

  app.get('/api/mongodb-status', async (req, res) => {
    try {
      const dbInstance = await dbManager.getDb();
      res.json({
        enabled: !!process.env.MONGODB_URI,
        connected: !!dbInstance
      });
    } catch (err) {
      res.json({ enabled: !!process.env.MONGODB_URI, connected: false });
    }
  });

  // ==========================================
  // VITE DEVELOPMENT MIDDLEWARE OR STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In a production deployment on a platform like Render, the frontend
    // is served by a separate Static Site service. This server should
    // only handle API routes.
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const { address, port } = server.address() as import('net').AddressInfo;
    const localAddress = address === '0.0.0.0' || address === '::' ? 'localhost' : address;
    
    console.log('\nCobult Stocks server is running!');
    console.log(`  - Local:   http://${localAddress}:${port}`);
    console.log(`  - Network: Use your local IP address (e.g., http://192.168.x.x:${port})`);
  });
}

startServer();
