
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  type DocumentData,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { db as firestoreDb, auth } from '../firebase';
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
  const [user, setUser] = useState<User | null>(auth.currentUser);
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
        const valA = (a as any)[orderByField];
        const valB = (b as any)[orderByField];
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
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, []);

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

    let unsubscribeSnapshot: (() => void) | null = null;

    if (isOnline && user) {
      const q = orderByField 
        ? query(collection(firestoreDb, collectionName), orderBy(orderByField, orderDirection))
        : collection(firestoreDb, collectionName);

      unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
        const table = getTable(collectionName);
        
        for (const change of snapshot.docChanges()) {
          const docData = change.doc.data();
          const id = change.doc.id;

          if (change.type === 'removed') {
            await table.delete(id);
          } else {
            const existing = await table.get(id);
            
            if (existing && !existing.synced) {
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
                   version: (existing.version || 0) + 1
                 });
               }
            } else {
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
        // Only log if it's not a permission error or if we are supposed to have permission
        if (error.code !== 'permission-denied' || auth.currentUser) {
           console.error(`onSnapshot error for ${collectionName}:`, error);
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-completed', handleSync);
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [collectionName, isOnline, user, orderByField, orderDirection, refresh]);

  return { items, loading, isOnline, syncStatus, pendingCount, refresh };
}
