/**
 * Customer controller for the multi-tenant SaaS refactor.
 * Keeps customer lifecycle operations isolated by the authenticated tenant.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { Customer, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
  };
};

export async function listCustomers(req: AuthenticatedRequest, res: Response) {
  try {
    const customers = await dbManager.getCustomers(req.user?.shopId || 'shop_default');
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createCustomer(req: AuthenticatedRequest, res: Response) {
  try {
    const cust: Customer = req.body;
    const newId = 'c_' + Math.random().toString(36).substr(2, 9);
    const newCust: Customer = {
      ...cust,
      id: newId,
      shopId: req.user?.shopId,
      customerNumber: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      loyaltyPoints: cust.loyaltyPoints || 0,
      purchaseHistoryCount: 0,
    };

    const saved = await dbManager.saveCustomer(newCust);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
