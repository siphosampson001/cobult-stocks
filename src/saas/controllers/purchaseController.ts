/**
 * Purchase controller for the multi-tenant SaaS refactor.
 * Keeps supplier purchasing workflows aligned with the shared transaction service.
 */

import { Request, Response } from 'express';
import { createPurchase, listPurchases } from '../services/transactionService.ts';
import { PurchaseOrder, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
    userId?: string;
  };
};

export async function listPurchaseOrders(req: AuthenticatedRequest, res: Response) {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'b1';
    const purchases = await listPurchases(branchId, req.user?.shopId || 'shop_default');
    res.json(purchases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createPurchaseOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const orderData: PurchaseOrder = req.body;
    const saved = await createPurchase(orderData, req.user);
    res.locals.savedPurchase = saved;
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
