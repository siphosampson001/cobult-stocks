/**
 * Quotation controller for the multi-tenant SaaS refactor.
 * Keeps quotation lifecycle operations tenant-scoped and consistent with the app's.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { Quotation, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
    userId?: string;
  };
};

export async function listQuotations(req: AuthenticatedRequest, res: Response) {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'b1';
    const quotations = await dbManager.getQuotations(branchId, req.user?.shopId || 'shop_default');
    res.json(quotations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createQuotation(req: AuthenticatedRequest, res: Response) {
  try {
    const quotation: Quotation = req.body;
    quotation.shopId = req.user?.shopId;
    quotation.branchId = req.user?.branchId || quotation.branchId || 'b1';
    const saved = await dbManager.saveQuotation(quotation);
    res.status(201).json({ success: true, quotation: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
