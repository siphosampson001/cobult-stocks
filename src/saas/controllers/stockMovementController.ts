/**
 * Stock movement controller for the multi-tenant SaaS refactor.
 * Keeps transfer and adjustment workflows inside the tenant-aware route boundary.
 */

import { Request, Response } from 'express';
import * as dbManager from '../../db_manager.ts';
import { StockMovement, UserRole } from '../../types.ts';

type AuthenticatedRequest = Request & {
  user?: {
    shopId?: string;
    branchId?: string;
    role?: UserRole;
    userId?: string;
  };
};

export async function listStockMovements(req: AuthenticatedRequest, res: Response) {
  try {
    const movements = await dbManager.getStockMovements(req.user?.shopId || 'shop_default');
    res.json(movements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createStockMovement(req: AuthenticatedRequest, res: Response) {
  try {
    const moveData: StockMovement = req.body;
    const newMovement: StockMovement = {
      ...moveData,
      id: 'mov_' + Math.random().toString(36).substr(2, 9),
      shopId: req.user?.shopId,
      timestamp: new Date().toISOString(),
    };

    const saved = await dbManager.saveStockMovement(newMovement);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateStockMovement(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updated = await dbManager.updateStockMovement(id, req.body, req.user?.shopId || 'shop_default');
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Stock movement not found.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
