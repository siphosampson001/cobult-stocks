/**
 * Dashboard controller for the multi-tenant SaaS refactor.
 * Centralizes the tenant-scoped dashboard summary used by the app.
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

export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'b1';
    const shopId = req.user?.shopId || 'shop_default';

    const allSales = await dbManager.getSales(branchId, shopId);
    const sales = allSales.filter((s) => s.status === 'Completed');
    const products = await dbManager.getProducts(branchId, shopId);
    const purchases = await dbManager.getPurchases(branchId, shopId);
    const expensesList = await dbManager.getExpenses(branchId, shopId);

    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    let costOfGoodsSold = 0;

    sales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          costOfGoodsSold += prod.purchasePrice * item.quantity;
        }
      });
    });

    const totalExpenses = expensesList.reduce((sum, e) => sum + e.amount, 0) + costOfGoodsSold;
    const revenue = totalSales;
    const profit = Math.max(0, revenue - totalExpenses);

    const lowStock = products.filter((p) => p.quantity > 0 && p.quantity <= p.minQuantity);
    const outOfStock = products.filter((p) => p.quantity === 0);
    const recentSales = sales.slice(0, 10).map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      cashier: s.cashierName,
      total: s.total,
      paymentMethod: s.paymentMethod,
      timestamp: s.timestamp,
    }));

    const productSalesMap: Record<string, { name: string; qty: number; sales: number }> = {};
    sales.forEach((s) => {
      s.items.forEach((item) => {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = { name: item.name, qty: 0, sales: 0 };
        }
        productSalesMap[item.productId].qty += item.quantity;
        productSalesMap[item.productId].sales += item.subtotal;
      });
    });

    const topSelling = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const salesTrends = sales.map((s) => ({
      time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: s.total,
    }));

    res.json({
      revenue,
      expenses: totalExpenses,
      profit,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      pendingOrdersCount: purchases.filter((p) => p.status === 'Pending').length,
      recentSales,
      topSelling,
      salesTrends: salesTrends.length ? salesTrends : [
        { time: '08:00 AM', amount: 0 },
        { time: '12:00 PM', amount: 150 },
        { time: '04:00 PM', amount: 320 },
      ],
    });
  } catch (err: any) {
    console.error('[API Dashboard] Error:', err);
    res.status(500).json({ error: err.message });
  }
}
