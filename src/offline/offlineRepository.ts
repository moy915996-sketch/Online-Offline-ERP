
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
      // Handle increment - be robust to different SDK internal structures
      const isIncrement = value._methodName?.includes('increment') || 
                          value.constructor?.name?.includes('NumericIncrement');
      
      if (isIncrement) {
        const amount = value._operand !== undefined ? value._operand : (value.bc !== undefined ? value.bc : (value.amount !== undefined ? value.amount : 0));
        processed[key] = (Number(existingData[key]) || 0) + (typeof amount === 'number' ? amount : 0);
      } 
      // Handle serverTimestamp or others
      else if (value._methodName?.includes('serverTimestamp')) {
        processed[key] = Date.now();
      }
      // Handle nested objects
      else if (!value._methodName) {
        processed[key] = processLocalData(value, existingData[key] || {});
      }
    }
  }
  return processed;
};

export async function offlineCreate(collectionName: string, data: any) {
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

  // 1. Save locally first (Immediate)
  await getTable(collectionName).put(record);
  
  // 2. Add to sync queue for background processing
  await addToQueue(collectionName, id, 'create', data);

  // 3. Notify UI
  window.dispatchEvent(new CustomEvent('local-data-changed', { 
    detail: { collectionName } 
  }));
  
  // 4. Background sync attempt if online
  if (navigator.onLine) {
    syncEngine.syncPendingOperations().catch(err => console.warn('Background sync started but failed', err));
  }
  
  return id;
}

export async function getOfflineRecord(collectionName: string, id: string) {
  return await getTable(collectionName).get(id);
}

export async function offlineUpdate(collectionName: string, id: string, data: any) {
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

  // 1. Save locally first
  await getTable(collectionName).put(record);
  
  // 2. Add to sync queue
  await addToQueue(collectionName, id, 'update', data);

  // 3. Notify UI
  window.dispatchEvent(new CustomEvent('local-data-changed', { 
    detail: { collectionName } 
  }));
  
  // 4. Background sync if online
  if (navigator.onLine) {
    syncEngine.syncPendingOperations().catch(err => console.warn('Background sync started but failed', err));
  }
}

export async function offlineDelete(collectionName: string, id: string) {
  const existing = await getTable(collectionName).get(id);
  
  if (existing) {
    const record: OfflineRecord = {
      ...existing,
      synced: false,
      syncStatus: 'pending',
      operation: 'delete',
      updatedAt: Date.now()
    };
    
    // 1. Mark as deleted locally (but keep record for sync engine)
    await getTable(collectionName).put(record);
    
    // 2. Add to sync queue
    await addToQueue(collectionName, id, 'delete', null);
    
    // 3. Notify UI
    window.dispatchEvent(new CustomEvent('local-data-changed', { 
      detail: { collectionName } 
    }));
    
    // 4. Background sync
    if (navigator.onLine) {
      syncEngine.syncPendingOperations().catch(err => console.warn('Background sync started but failed', err));
    }
  }
}

async function handleOfflineDelete(collectionName: string, id: string) {
  // Logic merged into offlineDelete
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
