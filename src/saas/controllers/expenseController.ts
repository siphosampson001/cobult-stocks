/**
 * Expense controller for the multi-tenant SaaS refactor.
 * Keeps expense capture within the authenticated tenant scope.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { Expense, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
    userId?: string;
  };
};

export async function listExpenses(req: AuthenticatedRequest, res: Response) {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'b1';
    const expenses = await dbManager.getExpenses(branchId, req.user?.shopId || 'shop_default');
    res.json(expenses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createExpense(req: AuthenticatedRequest, res: Response) {
  try {
    const expenseData: Expense = req.body;
    const newExpense: Expense = {
      ...expenseData,
      id: 'exp_' + Math.random().toString(36).substr(2, 9),
      shopId: req.user?.shopId,
      branchId: req.user?.branchId || expenseData.branchId || 'b1',
      createdAt: new Date().toISOString(),
    };
    const saved = await dbManager.saveExpense(newExpense);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
