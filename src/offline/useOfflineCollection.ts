
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  type DocumentData,
  Timestamp
} from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { db as localDb, type OfflineRecord } from './db';
import { getTable } from './offlineRepository';

export function useOfflineCollection<T = any>(
  collectionName: string, 
  orderByField?: string, 
  orderDirection: 'asc' | 'desc' = 'asc'
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'failed' | 'conflict'>('synced');
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    const table = getTable(collectionName);
    const localRecords = await table.toArray();
    
    // Convert OfflineRecord back to T
    const data = localRecords
      .filter(r => r.operation !== 'delete')
      .map(r => r.data as T);
    
    // Apply sorting if needed
    if (orderByField) {
      data.sort((a: any, b: any) => {
        const valA = a[orderByField];
        const valB = b[orderByField];
        if (orderDirection === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });
    }

    setItems(data);
    
    const pending = localRecords.filter(r => !r.synced).length;
    setPendingCount(pending);
    setSyncStatus(pending > 0 ? 'pending' : 'synced');
  }, [collectionName, orderByField, orderDirection]);

  useEffect(() => {
    // Initial load from IndexedDB
    refresh().then(() => setLoading(false));

    // Handle online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle sync updates
    const handleSync = () => refresh();
    window.addEventListener('sync-completed', handleSync);

    let unsubscribe: () => void = () => {};

    if (isOnline) {
      const q = orderByField 
        ? query(collection(firestoreDb, collectionName), orderBy(orderByField, orderDirection))
        : collection(firestoreDb, collectionName);

      unsubscribe = onSnapshot(q, async (snapshot) => {
        const table = getTable(collectionName);
        
        for (const change of snapshot.docChanges()) {
          const docData = change.doc.data();
          const id = change.doc.id;

          if (change.type === 'removed') {
            await table.delete(id);
          } else {
            // Check for conflict here if we wanted to be rigorous
            // For now, update local storage with server data
            const existing = await table.get(id);
            
            // If we have a pending local change, we might want to skip or handle conflict
            if (existing && !existing.synced) {
               // Simple logic: if server data is newer than local updatedAt, server wins
               const serverUpdate = (docData.updatedAt as Timestamp)?.toMillis?.() || 0;
               if (serverUpdate > existing.updatedAt) {
                 await table.put({
                   id,
                   data: { ...docData, id },
                   collectionName,
                   createdAt: (docData.createdAt as Timestamp)?.toMillis?.() || Date.now(),
                   updatedAt: serverUpdate,
                   synced: true,
                   syncStatus: 'synced',
                   version: existing.version + 1
                 });
               } else {
                 // Local is newer or no timestamp, keep local as pending
               }
            } else {
              // Regular update from server
              await table.put({
                id,
                data: { ...docData, id },
                collectionName,
                createdAt: (docData.createdAt as Timestamp)?.toMillis?.() || Date.now(),
                updatedAt: (docData.updatedAt as Timestamp)?.toMillis?.() || Date.now(),
                synced: true,
                syncStatus: 'synced',
                version: 1
              });
            }
          }
        }
        refresh();
      }, (error) => {
        console.error(`onSnapshot error for ${collectionName}:`, error);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-completed', handleSync);
      unsubscribe();
    };
  }, [collectionName, isOnline, orderByField, orderDirection, refresh]);

  return { items, loading, isOnline, syncStatus, pendingCount, refresh };
}
