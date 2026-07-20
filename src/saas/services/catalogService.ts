/**
 * Catalog service layer for the multi-tenant SaaS refactor.
 * This service centralizes inventory creation, reads, and updates while
 * enforcing the authenticated user's shopId and branch context.
 */

import * as dbManager from '../../db_manager.ts';
import { Product } from '../../types.ts';

export async function listProducts(branchId: string, shopId: string) {
  return dbManager.getProducts(branchId, shopId);
}

export async function createProduct(productData: Product, user: any) {
  const newId = 'p_' + Math.random().toString(36).substr(2, 9);
  const branchId = user.branchId || productData.branchId || 'b1';

  const newProduct: Product = {
    ...productData,
    id: newId,
    shopId: user.shopId,
    branchId,
    status: productData.quantity === 0
      ? 'Out of Stock'
      : productData.quantity <= productData.minQuantity
        ? 'Low Stock'
        : 'In Stock',
    updatedAt: new Date().toISOString(),
  };

  return dbManager.saveProduct(newProduct);
}

export async function updateProduct(id: string, productData: Partial<Product>, shopId: string) {
  return dbManager.updateProduct(id, productData, shopId);
}

export async function deleteProduct(id: string, shopId: string) {
  return dbManager.deleteProduct(id, shopId);
}
