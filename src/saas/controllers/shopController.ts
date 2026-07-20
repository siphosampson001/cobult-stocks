/**
 * Shop controller for the multi-tenant SaaS refactor.
 * Handles super-admin tenant provisioning while preserving the current app UX.
 */

import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { Shop, User, UserRole, Branch } from '../../types.ts';
import { sendShopProvisionedEmail, sendPasswordResetEmail } from '../services/emailService.ts';

export async function getAllShops(req: Request, res: Response) {
  try {
    const shops = await dbManager.getShops();
    res.json(shops);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createShop(req: Request, res: Response) {
  try {
    const { shopName, ownerName, email, phone, subscriptionPlan, password } = req.body;

    if (!password || !String(password).trim()) {
      return res.status(400).json({ error: 'A valid owner password is required.' });
    }

    const shopId = 'shop_' + Math.random().toString(36).substr(2, 9);
    const ownerId = 'u_' + Math.random().toString(36).substr(2, 9);

    const expiry = new Date();
    if (subscriptionPlan === 'Monthly') expiry.setMonth(expiry.getMonth() + 1);
    else if (subscriptionPlan === 'Quarterly') expiry.setMonth(expiry.getMonth() + 3);
    else if (subscriptionPlan === 'Yearly') expiry.setFullYear(expiry.getFullYear() + 1);
    else expiry.setDate(expiry.getDate() + 14);

    const passwordHash = await bcrypt.hash(password, 10);

    const newShop: Shop = {
      id: shopId,
      shopName,
      ownerName,
      email,
      phone,
      subscriptionPlan: subscriptionPlan || 'Trial',
      subscriptionStatus: 'Active',
      expiryDate: expiry.toISOString().slice(0, 10),
      status: 'Active',
      createdAt: new Date().toISOString(),
    };

    const newOwner: User = {
      id: ownerId,
      shopId,
      branchId: 'b1',
      username: email.split('@')[0],
      fullname: ownerName,
      email,
      passwordHash,
      role: UserRole.OWNER,
      status: 'Active',
      createdAt: new Date().toISOString(),
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
    };

    const newBranch: Branch = {
      id: 'b1',
      shopId,
      name: `${shopName} Main Branch`,
      address: 'Main St, CBD',
      phone,
      createdAt: new Date().toISOString(),
    };

    await dbManager.saveShop(newShop);
    await dbManager.saveUser(newOwner);
    await dbManager.saveBranch(newBranch);

    // Send welcome email with owner credentials
    sendShopProvisionedEmail(newShop, newOwner, password).catch((err) => {
      console.error('[createShop] Failed to send provisioning email:', err);
    });

    res.status(201).json({
      success: true,
      shop: newShop,
      owner: {
        username: newOwner.username,
        email: newOwner.email,
        temporaryPassword: password,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateShop(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updatedShop = await dbManager.updateShop(id, req.body);
    if (updatedShop) {
      res.json(updatedShop);
    } else {
      res.status(404).json({ error: 'Shop not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteShop(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const success = await dbManager.deleteShop(id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Shop not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function resetShopOwnerPassword(req: Request, res: Response) {
  try {
    const { shopId, newPassword } = req.body;
    const users = await dbManager.getUsers(shopId);
    const owner = users.find((u) => u.role === UserRole.OWNER);

    if (!owner) {
      return res.status(404).json({ error: 'Shop owner not found.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await dbManager.updateUser(owner.id, { passwordHash });

    if (updated) {
      // Send password reset email
      sendPasswordResetEmail(updated, newPassword).catch((err) => {
        console.error('[resetShopOwnerPassword] Failed to send password reset email:', err);
      });
    }

    res.json({ success: true, message: 'Password reset successful.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
