/**
 * Shared tenant utilities for the COBULT STOCKS SaaS refactor.
 * These helpers centralize request scoping so the app remains one shared database
 * with all data isolated by shopId and role-aware branch access.
 */

import { UserRole } from '../types.ts';

export type TenantContext = {
  shopId: string;
  branchId: string;
};

export function getTenantContext(req: any): TenantContext {
  return {
    shopId: req?.user?.shopId || 'shop_default',
    branchId: req?.user?.branchId || 'b1',
  };
}

export function sanitizeTenantBody(req: any): TenantContext {
  const tenant = getTenantContext(req);

  if (req?.body && typeof req.body === 'object') {
    if ('shopId' in req.body) delete req.body.shopId;
    if ('branchId' in req.body && req.user?.role !== UserRole.SUPER_ADMIN) {
      req.body.branchId = tenant.branchId;
    }
  }

  return tenant;
}

export function sanitizeTenantQuery(req: any): TenantContext {
  const tenant = getTenantContext(req);

  if (req?.query && typeof req.query === 'object' && 'shopId' in req.query) {
    delete req.query.shopId;
  }

  if (req?.query && typeof req.query === 'object' && req.user?.role === UserRole.CASHIER) {
    if (req.query.branchId && req.query.branchId !== tenant.branchId && req.query.branchId !== 'all') {
      req.query.branchId = tenant.branchId;
    }
    if (!req.query.branchId) {
      req.query.branchId = tenant.branchId;
    }
  }

  return tenant;
}

export function buildTenantFilter(shopId: string = 'shop_default', branchId?: string): Record<string, any> {
  const filter: Record<string, any> = {};

  if (shopId && shopId !== 'super_admin_shop') {
    filter.shopId = shopId;
  }

  if (branchId && branchId !== 'all') {
    filter.branchId = branchId;
  }

  return filter;
}
