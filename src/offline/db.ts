
import Dexie, { type Table } from 'dexie';

export type SyncStatus = 'pending' | 'synced' | 'failed' | 'conflict';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface OfflineRecord<T = any> {
  id: string; // Firebase ID or local temp ID
  data: T;
  collectionName: string;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  syncStatus: SyncStatus;
  operation?: SyncOperation;
  version: number;
  lastError?: string;
}

export interface SyncQueueItem {
  id?: number;
  recordId: string;
  collectionName: string;
  operation: SyncOperation;
  data: any;
  timestamp: number;
  status: SyncStatus;
  error?: string;
  retryCount: number;
}

export class ERPDatabase extends Dexie {
  products!: Table<OfflineRecord>;
  suppliers!: Table<OfflineRecord>;
  customers!: Table<OfflineRecord>;
  purchases!: Table<OfflineRecord>;
  sales!: Table<OfflineRecord>;
  transactions!: Table<OfflineRecord>;
  warehouses!: Table<OfflineRecord>;
  categories!: Table<OfflineRecord>;
  transfers!: Table<OfflineRecord>;
  returns!: Table<OfflineRecord>;
  users!: Table<OfflineRecord>;
  settings!: Table<OfflineRecord>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('ERPDatabase');
    this.version(1).stores({
      products: 'id, collectionName, synced, syncStatus',
      suppliers: 'id, collectionName, synced, syncStatus',
      customers: 'id, collectionName, synced, syncStatus',
      purchases: 'id, collectionName, synced, syncStatus',
      sales: 'id, collectionName, synced, syncStatus',
      transactions: 'id, collectionName, synced, syncStatus',
      warehouses: 'id, collectionName, synced, syncStatus',
      categories: 'id, collectionName, synced, syncStatus',
      transfers: 'id, collectionName, synced, syncStatus',
      returns: 'id, collectionName, synced, syncStatus',
      users: 'id, collectionName, synced, syncStatus',
      settings: 'id, collectionName, synced, syncStatus',
      syncQueue: '++id, recordId, collectionName, status, timestamp'
    });
  }
}

export const db = new ERPDatabase();
