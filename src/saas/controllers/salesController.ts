/**
 * Sales controller for the multi-tenant SaaS refactor.
 * Keeps POS and sales workflows behind the shared service layer.
 */

import { Request, Response } from 'express';
import { createSale, listSales } from '../services/transactionService.ts';
import { Sale, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
    userId?: string;
  };
};

export async function listSalesForTenant(req: AuthenticatedRequest, res: Response) {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'b1';
    const sales = await listSales(branchId, req.user?.shopId || 'shop_default');
    res.json(sales);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createSalesTransaction(req: AuthenticatedRequest, res: Response) {
  try {
    const saleData: Sale = req.body;
    const saved = await createSale(saleData, req.user);
    res.locals.savedSale = saved;
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
