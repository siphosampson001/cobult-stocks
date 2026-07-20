/**
 * Transaction service layer for the multi-tenant SaaS refactor.
 * This keeps POS, purchases, and return workflows in one place with tenant-aware
 * operations and compatibility with the existing local storage fallback.
 */

import * as dbManager from '../../db_manager.ts';
import { PurchaseOrder, Sale, Return } from '../../types.ts';

export async function listSales(branchId: string, shopId: string) {
  return dbManager.getSales(branchId, shopId);
}

export async function createSale(saleData: Sale, user: any) {
  const newSale: Sale = {
    ...saleData,
    id: saleData.id || 's_' + Math.random().toString(36).substr(2, 9),
    shopId: user.shopId,
    branchId: user.branchId || saleData.branchId || 'b1',
    invoiceNumber: saleData.invoiceNumber || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: saleData.timestamp || new Date().toISOString(),
    syncedAt: new Date().toISOString(),
  };

  return dbManager.saveSale(newSale);
}

export async function listPurchases(branchId: string, shopId: string) {
  return dbManager.getPurchases(branchId, shopId);
}

export async function createPurchase(orderData: PurchaseOrder, user: any) {
  const newId = 'po_' + Math.random().toString(36).substr(2, 9);
  const newOrder: PurchaseOrder = {
    ...orderData,
    id: newId,
    shopId: user.shopId,
    branchId: user.branchId || orderData.branchId || 'b1',
    orderNumber: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
  };

  if (newOrder.status === 'Received') {
    newOrder.receivedAt = new Date().toISOString();
  }

  return dbManager.savePurchase(newOrder);
}

export async function createReturn(returnData: Return, user: any) {
  const newReturn: Return = {
    ...returnData,
    id: 'ret_' + Math.random().toString(36).substr(2, 9),
    shopId: user.shopId,
    branchId: user.branchId || returnData.branchId || 'b1',
    timestamp: new Date().toISOString(),
  };

  return dbManager.saveReturn(newReturn);
}
