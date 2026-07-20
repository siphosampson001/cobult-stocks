/**
 * Tenant service layer for multi-tenant SaaS authorization rules.
 * This keeps the security rules central and easy to extend for subscription,
 * active/inactive, and role checks across all shops.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dbManager from '../../db_manager.ts';
import { UserRole } from '../../types.ts';
import { getShopById, findUserByLoginKey } from '../repositories/tenantRepository.ts';

const SECRET_KEY = process.env.JWT_SECRET || 'cobult-stocks-saas-super-secret-key-99821';

export async function validateTenantAccess(decodedUser: any) {
  if (decodedUser?.role === UserRole.SUPER_ADMIN) {
    return { allowed: true };
  }

  const shop = await getShopById(decodedUser?.shopId);
  if (!shop) {
    return { allowed: false, message: 'Shop tenant not found. Access denied. Please contact the administrator.' };
  }

  const subStatus = shop.subscriptionStatus || 'Active';
  if (shop.status === 'Suspended' || subStatus === 'Suspended') {
    return { allowed: false, message: 'Your shop subscription has been suspended by the administrator. Please contact the administrator.' };
  }

  if (subStatus === 'Expired' || subStatus === 'Inactive') {
    return { allowed: false, message: 'Your subscription is inactive or has expired. Please contact the administrator to renew or activate your account.' };
  }

  const expiryTime = new Date(shop.expiryDate).getTime();
  if (Number.isFinite(expiryTime) && expiryTime < Date.now()) {
    return { allowed: false, message: 'Your subscription has expired. Please contact the administrator to renew your subscription.' };
  }

  return { allowed: true };
}

export async function issueJwtToken(user: any) {
  return jwt.sign(
    {
      userId: user.id,
      shopId: user.shopId,
      role: user.role,
      branchId: user.branchId,
    },
    SECRET_KEY,
    { expiresIn: '30d' }
  );
}

export async function loginUser(loginKey: string, password: string) {
  const user = await findUserByLoginKey(loginKey.toLowerCase());
  if (!user) {
    return { success: false, error: 'Invalid username' };
  }

  const isMatch = await bcrypt.compare(password || '', user.passwordHash || '');
  if (!isMatch) {
    return { success: false, error: 'Invalid password' };
  }

  if (user.status === 'Suspended') {
    return { success: false, error: 'Your user account is suspended.' };
  }

  const tenantCheck = await validateTenantAccess(user);
  if (!tenantCheck.allowed) {
    return { success: false, error: tenantCheck.message };
  }

  const token = await issueJwtToken(user);
  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      shopId: user.shopId,
      avatarUrl: user.avatarUrl,
    },
  };
}
