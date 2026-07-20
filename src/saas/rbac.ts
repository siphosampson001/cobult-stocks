/**
 * Explicit role-permission matrix for the COBULT STOCKS SaaS refactor.
 * This keeps permissions readable and makes RBAC easier to extend for future
 * multi-tenant capabilities while preserving the current route behavior.
 */

import { UserRole } from '../types.ts';

export type PermissionKey =
  | 'SUPER_VIEW'
  | 'SHOP_CREATE'
  | 'SHOP_SUSPEND'
  | 'SHOP_DELETE'
  | 'SHOP_RESET_PASSWORD'
  | 'SHOP_ACTIVATE'
  | 'SHOP_VIEW'
  | 'BRANCH_MANAGE'
  | 'PRODUCT_MANAGE'
  | 'INVENTORY_MANAGE'
  | 'PURCHASE_MANAGE'
  | 'REPORT_VIEW'
  | 'SUPPLIER_MANAGE'
  | 'CUSTOMER_MANAGE'
  | 'STOCK_TRANSFER'
  | 'POS_SALES'
  | 'RETURN_MANAGE'
  | 'AUDIT_VIEW';

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  [UserRole.SUPER_ADMIN]: [
    'SUPER_VIEW',
    'SHOP_CREATE',
    'SHOP_SUSPEND',
    'SHOP_DELETE',
    'SHOP_RESET_PASSWORD',
    'SHOP_ACTIVATE',
    'SHOP_VIEW',
    'REPORT_VIEW',
    'AUDIT_VIEW',
  ],
  [UserRole.OWNER]: [
    'BRANCH_MANAGE',
    'PRODUCT_MANAGE',
    'INVENTORY_MANAGE',
    'PURCHASE_MANAGE',
    'REPORT_VIEW',
    'SUPPLIER_MANAGE',
    'CUSTOMER_MANAGE',
    'STOCK_TRANSFER',
    'POS_SALES',
    'RETURN_MANAGE',
    'AUDIT_VIEW',
  ],
  [UserRole.MANAGER]: [
    'PRODUCT_MANAGE',
    'INVENTORY_MANAGE',
    'PURCHASE_MANAGE',
    'REPORT_VIEW',
    'STOCK_TRANSFER',
    'POS_SALES',
    'RETURN_MANAGE',
    'AUDIT_VIEW',
  ],
  [UserRole.CASHIER]: [
    'POS_SALES',
    'RETURN_MANAGE',
  ],
};

export function canPerform(role: UserRole, permission: PermissionKey): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function requirePermission(role: UserRole, permission: PermissionKey): boolean {
  return canPerform(role, permission);
}
