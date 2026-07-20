/**
 * Offline-first synchronization service for the SaaS refactor.
 * This service keeps the offline queue sync behavior in a single tenant-aware entry point.
 */

import * as dbManager from '../../db_manager.ts';

export async function syncOfflineData(offlineQueue: any[], branchId: string, shopId: string) {
  return dbManager.syncOfflineQueue(offlineQueue, branchId, shopId);
}
