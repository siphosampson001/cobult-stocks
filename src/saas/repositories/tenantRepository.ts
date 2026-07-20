/**
 * Tenant repository layer for the SaaS multi-tenant refactor.
 * This file keeps database lookup concerns in one place so the server can stay
 * thin and maintainable while preserving the current COBULT STOCKS behavior.
 */

import * as dbManager from '../../db_manager.ts';
import { User } from '../../types.ts';

export async function getShopById(shopId: string) {
  const shops = await dbManager.getShops();
  return shops.find((shop) => shop.id === shopId) ?? null;
}

export async function getUsersForLoginLookup() {
  return dbManager.getUsers('super_admin_shop');
}

export async function findUserByLoginKey(loginKey: string): Promise<User | undefined> {
  const users = await getUsersForLoginLookup();
  return users.find((user) => {
    const usernameMatch = typeof user.username === 'string' && user.username.toLowerCase() === loginKey;
    const emailMatch = typeof user.email === 'string' && user.email.toLowerCase() === loginKey;
    return usernameMatch || emailMatch;
  });
}
