
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db as firestoreDb, auth } from '../firebase';
import { db as localDb, type SyncQueueItem, type OfflineRecord } from './db';
import { getTable } from './offlineRepository';

// Helper to reconstruct Firestore FieldValues from plain objects stored in IndexedDB
const reconstructFieldValues = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(reconstructFieldValues);

  const result: any = {};
  for (const key in data) {
    const value = data[key];
    if (value && typeof value === 'object') {
      const v = value as any;
      // Handle increment
      const isIncrement = v._methodName?.includes('increment') || 
                          v.constructor?.name?.includes('NumericIncrement');
      
      if (isIncrement) {
        const amount = v._operand !== undefined ? v._operand : (v.bc !== undefined ? v.bc : (v.amount !== undefined ? v.amount : 0));
        result[key] = increment(Number(amount) || 0);
      } 
      // Handle serverTimestamp
      else if (v._methodName?.includes('serverTimestamp')) {
        result[key] = serverTimestamp();
      }
      // Handle nested
      else if (!v._methodName) {
        result[key] = reconstructFieldValues(value);
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
};

class SyncEngine {
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('App is online. Starting sync...');
        this.syncPendingOperations();
      });
      
      onAuthStateChanged(auth, (user) => {
        if (user && navigator.onLine) {
          console.log('User signed in. Starting sync...');
          this.syncPendingOperations();
        }
      });

      // Initial check
      if (navigator.onLine && auth.currentUser) {
        this.syncPendingOperations();
      }

      window.addEventListener('manual-sync-trigger', () => {
        if (navigator.onLine && auth.currentUser) {
          console.log('Manual sync triggered...');
          this.syncPendingOperations();
        }
      });

      // Add periodic retry interval every 30 seconds
      setInterval(() => {
        if (navigator.onLine && auth.currentUser) {
          this.syncPendingOperations();
        }
      }, 30000);
    }
  }

  async syncPendingOperations() {
    if (this.isSyncing || !auth.currentUser || !navigator.onLine) return;
    this.isSyncing = true;
    window.dispatchEvent(new CustomEvent('sync-started'));

    try {
      // 1. Recover stale 'syncing' items (e.g. from a crashed tab) - 15s instead of 30s
      const fifteenSecondsAgo = Date.now() - 15000;
      await localDb.syncQueue
        .where('status')
        .equals('syncing')
        .and(item => (item.timestamp || 0) < fifteenSecondsAgo)
        .modify({ status: 'pending' });

      // 2. Fetch pending items
      const pendingItems = await localDb.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('timestamp');

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        window.dispatchEvent(new CustomEvent('sync-completed'));
        return;
      }

      for (const item of pendingItems) {
        if (!navigator.onLine) break;

        // Try to "own" this item for processing across tabs
        const updated = await localDb.syncQueue
          .where('id')
          .equals(item.id!)
          .and(i => i.status === 'pending')
          .modify({ status: 'syncing', timestamp: Date.now() });

        if (updated === 0) {
          // Document was already picked up by another tab
          continue;
        }

        try {
          await this.processSyncItem(item);
          // Update item status to synced
          await localDb.syncQueue.update(item.id!, { status: 'synced', timestamp: Date.now() });
          
          // Also update the actual record to synced
          const table = getTable(item.collectionName);
          const record = await table.get(item.recordId);
          if (record && item.operation !== 'delete') {
            await table.update(item.recordId, { 
              synced: true, 
              syncStatus: 'synced',
              lastError: undefined 
            });
          } else if (item.operation === 'delete') {
            await table.delete(item.recordId);
          }
        } catch (error: any) {
          console.error(`Failed to sync item ${item.id}:`, error);
          
          const isFatal = 
            error.code === 'permission-denied' || 
            error.code === 'not-found' ||
            error.message?.includes('not found') ||
            error.message?.includes('permission');

          const retryCount = (item.retryCount || 0) + 1;
          const status = (retryCount > 5 || isFatal) ? 'failed' : 'pending';
          
          await localDb.syncQueue.update(item.id!, { 
            status, 
            error: error.message,
            retryCount,
            timestamp: Date.now()
          });

          // Update record with error
          const table = getTable(item.collectionName);
          await table.update(item.recordId, { 
            syncStatus: status === 'failed' ? 'failed' : 'pending',
            lastError: error.message 
          });

          if (status === 'pending') break; 
        }
      }
    } finally {
      this.isSyncing = false;
      window.dispatchEvent(new CustomEvent('sync-completed'));
    }
  }

  private async processSyncItem(item: SyncQueueItem) {
    const docRef = doc(firestoreDb, item.collectionName, item.recordId);
    const data = reconstructFieldValues(item.data);

    switch (item.operation) {
      case 'create':
        await setDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        break;
      case 'update':
        await setDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        break;
      case 'delete':
        await deleteDoc(docRef);
        break;
    }
  }
}

export const syncEngine = new SyncEngine();
