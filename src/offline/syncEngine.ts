
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { db as localDb, type SyncQueueItem, type OfflineRecord } from './db';
import { getTable } from './offlineRepository';

class SyncEngine {
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('App is online. Starting sync...');
        this.syncPendingOperations();
      });
      
      // Initial check
      if (navigator.onLine) {
        this.syncPendingOperations();
      }
    }
  }

  async syncPendingOperations() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pendingItems = await localDb.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('timestamp');

      for (const item of pendingItems) {
        if (!navigator.onLine) break;

        try {
          await this.processSyncItem(item);
          // Update item status
          await localDb.syncQueue.update(item.id!, { status: 'synced' });
          
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
          const retryCount = (item.retryCount || 0) + 1;
          const status = retryCount > 5 ? 'failed' : 'pending';
          
          await localDb.syncQueue.update(item.id!, { 
            status, 
            error: error.message,
            retryCount 
          });

          // Update record with error
          const table = getTable(item.collectionName);
          await table.update(item.recordId, { 
            syncStatus: status === 'failed' ? 'failed' : 'pending',
            lastError: error.message 
          });

          // If it failed, stop processing this queue for now to prevent out-of-order issues
          if (status === 'pending') break; 
        }
      }
    } finally {
      this.isSyncing = false;
      // Trigger a refresh event if needed
      window.dispatchEvent(new CustomEvent('sync-completed'));
    }
  }

  private async processSyncItem(item: SyncQueueItem) {
    const docRef = doc(firestoreDb, item.collectionName, item.recordId);

    switch (item.operation) {
      case 'create':
        await setDoc(docRef, {
          ...item.data,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        break;
      case 'update':
        await updateDoc(docRef, {
          ...item.data,
          updatedAt: serverTimestamp(),
        });
        break;
      case 'delete':
        await deleteDoc(docRef);
        break;
    }
  }
}

export const syncEngine = new SyncEngine();
