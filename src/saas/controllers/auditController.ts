/**
 * Audit controller for the multi-tenant SaaS refactor.
 * Centralizes access to tenant-limited audit logs.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
  };
};

export async function listAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const logs = await dbManager.getAuditLogs(req.user?.shopId || 'shop_default');
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
