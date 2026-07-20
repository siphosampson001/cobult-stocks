/**
 * Supplier controller for the multi-tenant SaaS refactor.
 * Keeps supplier reads and writes tenant-scoped and preserves the current UX.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { Supplier, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
  };
};

export async function listSuppliers(req: AuthenticatedRequest, res: Response) {
  try {
    const suppliers = await dbManager.getSuppliers(req.user?.shopId || 'shop_default');
    res.json(suppliers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createSupplier(req: AuthenticatedRequest, res: Response) {
  try {
    const sup: Supplier = req.body;
    const newId = 's_' + Math.random().toString(36).substr(2, 9);
    const newSup: Supplier = {
      ...sup,
      id: newId,
      shopId: req.user?.shopId,
      balance: sup.balance || 0,
      purchaseHistoryCount: 0,
    };

    const saved = await dbManager.saveSupplier(newSup);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
