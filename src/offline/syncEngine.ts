
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db as firestoreDb, auth } from '../firebase';
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
    }
  }

  async syncPendingOperations() {
    if (this.isSyncing || !auth.currentUser || !navigator.onLine) return;
    this.isSyncing = true;
    window.dispatchEvent(new CustomEvent('sync-started'));

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
            retryCount 
          });

          // Update record with error
          const table = getTable(item.collectionName);
          await table.update(item.recordId, { 
            syncStatus: status === 'failed' ? 'failed' : 'pending',
            lastError: error.message 
          });

          // If it's still pending, stop processing to prevent out-of-order issues.
          // If it's failed, we can try next items if they are independent.
          // For safety, we still break for now, but fatal errors won't block the queue next time.
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

    switch (item.operation) {
      case 'create':
        await setDoc(docRef, {
          ...item.data,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        break;
      case 'update':
        await setDoc(docRef, {
          ...item.data,
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
