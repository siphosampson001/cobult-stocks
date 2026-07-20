/**
 * Return controller for the multi-tenant SaaS refactor.
 * Keeps return workflows in the same service boundary as sales and purchases.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { createReturn } from '../services/transactionService.ts';
import { Return, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
    userId?: string;
  };
};

export async function listReturns(req: AuthenticatedRequest, res: Response) {
  try {
    const returns = await dbManager.getReturns(req.user?.shopId || 'shop_default');
    res.json(returns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createReturnTransaction(req: AuthenticatedRequest, res: Response) {
  try {
    const returnObj: Return = req.body;
    const saved = await createReturn(returnObj, req.user);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
