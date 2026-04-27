
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  increment,
  type DocumentData
} from 'firebase/firestore';
import { db as firestoreDb, OperationType, handleFirestoreError } from '../firebase';
import { db as localDb, type SyncStatus, type SyncOperation, type OfflineRecord } from './db';
import { syncEngine } from './syncEngine';

// Helper to generate IDs when offline
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Map collection name to Dexie table
export const getTable = (collectionName: string) => {
  const table = (localDb as any)[collectionName];
  if (!table) throw new Error(`Table for collection ${collectionName} not found`);
  return table;
};

// Helper to handle increment and other FieldValues in local data
const processLocalData = (data: any, existingData: any = {}): any => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(item => processLocalData(item));

  const processed = { ...data };
  for (const key in processed) {
    const value = processed[key];
    
    // Check if it's a Firestore FieldValue or complex object
    if (value && typeof value === 'object') {
      // Handle increment
      if (value._methodName?.includes('increment')) {
        const amount = value._operand || value.bc || 0;
        processed[key] = (existingData[key] || 0) + (typeof amount === 'number' ? amount : 0);
      } 
      // Handle serverTimestamp or others
      else if (value._methodName) {
        processed[key] = existingData[key] || Date.now();
      }
      // Handle nested objects
      else {
        processed[key] = processLocalData(value, existingData[key] || {});
      }
    }
  }
  return processed;
};

export async function offlineCreate(collectionName: string, data: any) {
  const isOnline = navigator.onLine;
  const id = data.id || generateId();
  const timestamp = Date.now();
  
  const processedData = processLocalData(data);

  const record: OfflineRecord = {
    id,
    data: { ...processedData, id },
    collectionName,
    createdAt: timestamp,
    updatedAt: timestamp,
    synced: false,
    syncStatus: 'pending',
    operation: 'create',
    version: 1
  };

  if (isOnline) {
    try {
      const docRef = doc(firestoreDb, collectionName, id);
      // Add a timeout to the Firestore call
      await Promise.race([
        setDoc(docRef, {
          ...data,
          id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      record.synced = true;
      record.syncStatus = 'synced';
    } catch (error) {
      console.warn('Failed to save to Firestore while online, queuing for offline sync', error);
      await addToQueue(collectionName, id, 'create', data);
    }
  } else {
    await addToQueue(collectionName, id, 'create', data);
  }

  await getTable(collectionName).put(record);
  
  window.dispatchEvent(new CustomEvent('local-data-changed', { 
    detail: { collectionName } 
  }));
  
  if (navigator.onLine) {
    syncEngine.syncPendingOperations();
  }
  
  return id;
}

export async function getOfflineRecord(collectionName: string, id: string) {
  return await getTable(collectionName).get(id);
}

export async function offlineUpdate(collectionName: string, id: string, data: any) {
  const isOnline = navigator.onLine;
  const timestamp = Date.now();
  
  const existing = await getTable(collectionName).get(id);
  const processedData = processLocalData(data, existing?.data || {});
  const updatedData = { ...(existing?.data || {}), ...processedData };
  
  const record: OfflineRecord = {
    id,
    data: updatedData,
    collectionName,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    synced: false,
    syncStatus: 'pending',
    operation: 'update',
    version: (existing?.version || 0) + 1
  };

  if (isOnline) {
    try {
      const docRef = doc(firestoreDb, collectionName, id);
      await Promise.race([
        setDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      record.synced = true;
      record.syncStatus = 'synced';
    } catch (error) {
      console.warn('Failed to update Firestore while online, queuing for offline sync', error);
      await addToQueue(collectionName, id, 'update', data);
    }
  } else {
    await addToQueue(collectionName, id, 'update', data);
  }

  await getTable(collectionName).put(record);
  
  window.dispatchEvent(new CustomEvent('local-data-changed', { 
    detail: { collectionName } 
  }));
  
  if (navigator.onLine) {
    syncEngine.syncPendingOperations();
  }
}

export async function offlineDelete(collectionName: string, id: string) {
  const isOnline = navigator.onLine;
  
  if (isOnline) {
    try {
      const docRef = doc(firestoreDb, collectionName, id);
      await Promise.race([
        deleteDoc(docRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      await getTable(collectionName).delete(id);
      window.dispatchEvent(new CustomEvent('local-data-changed', { 
        detail: { collectionName } 
      }));
    } catch (error) {
      console.warn('Failed to delete from Firestore while online, queuing for offline sync', error);
      await handleOfflineDelete(collectionName, id);
    }
  } else {
    await handleOfflineDelete(collectionName, id);
  }
  
  if (navigator.onLine) {
    syncEngine.syncPendingOperations();
  }
}

async function handleOfflineDelete(collectionName: string, id: string) {
  const existing = await getTable(collectionName).get(id);
  if (existing) {
    const record: OfflineRecord = {
      ...existing,
      synced: false,
      syncStatus: 'pending',
      operation: 'delete',
      updatedAt: Date.now()
    };
    await getTable(collectionName).put(record);
    await addToQueue(collectionName, id, 'delete', null);
    window.dispatchEvent(new CustomEvent('local-data-changed', { 
      detail: { collectionName } 
    }));
  }
}

async function addToQueue(collectionName: string, recordId: string, operation: SyncOperation, data: any) {
  await localDb.syncQueue.add({
    recordId,
    collectionName,
    operation,
    data,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0
  });
}
