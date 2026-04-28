
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

// Helper to remove Firestore FieldValues from local data
const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  
  const sanitized = { ...data };
  for (const key in sanitized) {
    const value = sanitized[key];
    if (value && typeof value === 'object') {
      // Check for FieldValue.increment - robust detection
      const isIncrement = value._methodName?.includes('increment') || 
                          value.constructor?.name?.includes('NumericIncrement');
      
      if (isIncrement) {
        const amount = value._operand !== undefined ? value._operand : (value.bc !== undefined ? value.bc : (value.amount !== undefined ? value.amount : 0));
        sanitized[key] = amount;
      }
      // Check for serverTimestamp (Timestamp object)
      else if (value.seconds !== undefined && value.nanoseconds !== undefined) {
        // If it has seconds/nanoseconds, it's a Firestore Timestamp or Similar
        // We convert to milliseconds to be safe for React rendering
        if (typeof value.toMillis === 'function') {
          sanitized[key] = value.toMillis();
        } else {
          sanitized[key] = (value.seconds * 1000) + Math.floor(value.nanoseconds / 1000000);
        }
      }
      // Handle other objects that might have _methodName
      else if (value._methodName) {
        sanitized[key] = null;
      }
      else {
        sanitized[key] = sanitizeData(value);
      }
    }
  }
  return sanitized;
};

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
      .map(r => sanitizeData(r.data) as T);
    
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
    let mounted = true;

    // Initial load from IndexedDB
    refresh()
      .catch(err => console.error(`Error refreshing ${collectionName}:`, err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Handle online/offline status
    const handleOnline = () => {
      if (mounted) setIsOnline(true);
    };
    const handleOffline = () => {
      if (mounted) setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle sync and local updates
    const handleUpdate = (e?: any) => {
      if (e?.detail?.collectionName === collectionName || !e?.detail?.collectionName) {
        refresh();
      }
    };
    window.addEventListener('sync-completed', handleUpdate);
    window.addEventListener('local-data-changed', handleUpdate);

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
                   data: sanitizeData({ ...docData, id }),
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
                data: sanitizeData({ ...docData, id }),
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
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-completed', handleUpdate);
      window.removeEventListener('local-data-changed', handleUpdate);
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [collectionName, isOnline, user, orderByField, orderDirection, refresh]);

  return { items, loading, isOnline, syncStatus, pendingCount, refresh };
}
