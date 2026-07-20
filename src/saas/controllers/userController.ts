/**
 * User controller for the multi-tenant SaaS refactor.
 * Provisions owner/manager/cashier users within the authenticated tenant scope.
 */

import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { User, UserRole } from '../../types.ts';
import { sendUserProvisionedEmail } from '../services/emailService.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
  };
};

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const users = await dbManager.getUsers(req.user?.shopId || 'shop_default');
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { username, fullname, email, role, branchId, password } = req.body;

    if (!password || !String(password).trim()) {
      return res.status(400).json({ error: 'A valid password is required for the new user.' });
    }

    const users = await dbManager.getUsers(req.user?.shopId || 'shop_default');
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      shopId: req.user?.shopId,
      branchId: branchId || 'b1',
      username,
      fullname,
      email,
      passwordHash,
      role: role || UserRole.CASHIER,
      status: 'Active',
      createdAt: new Date().toISOString(),
    };

    const saved = await dbManager.saveUser(newUser);

    // Fetch the shop details to get the shop name
    const shops = await dbManager.getShops();
    const shop = shops.find((s) => s.id === (req.user?.shopId || 'shop_default'));
    const shopName = shop ? shop.shopName : 'Cobult Stocks';

    // Send credentials email
    sendUserProvisionedEmail(shopName, saved, password).catch((err) => {
      console.error('[createUser] Failed to send credentials email:', err);
    });

    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
