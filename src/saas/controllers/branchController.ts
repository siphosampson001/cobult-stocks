/**
 * Branch controller for the multi-tenant SaaS refactor.
 * Keeps tenant-aware branch creation and listing in one place.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { Branch, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
  };
};

export async function getBranches(req: AuthenticatedRequest, res: Response) {
  try {
    const branches = await dbManager.getBranches(req.user?.shopId || 'shop_default');
    res.json(branches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createBranch(req: AuthenticatedRequest, res: Response) {
  try {
    const branchData: Branch = req.body;
    const newBranch: Branch = {
      ...branchData,
      id: 'b_' + Math.random().toString(36).substr(2, 9),
      shopId: req.user?.shopId,
      createdAt: new Date().toISOString(),
    };

    const saved = await dbManager.saveBranch(newBranch);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
