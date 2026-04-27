
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db as localDb } from '../offline/db';
import { motion, AnimatePresence } from 'motion/react';

const SyncStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkPending = async () => {
      const count = await localDb.syncQueue.where('status').equals('pending').count();
      setPendingCount(count);
    };

    const handleSyncStarted = () => setIsSyncing(true);
    const handleSyncCompleted = () => {
      setIsSyncing(false);
      checkPending();
    };

    window.addEventListener('sync-started', handleSyncStarted);
    window.addEventListener('sync-completed', handleSyncCompleted);
    const interval = setInterval(checkPending, 5000);
    checkPending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-started', handleSyncStarted);
      window.removeEventListener('sync-completed', handleSyncCompleted);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <WifiOff size={16} />
            غير متصل بالإنترنت
          </motion.div>
        )}
        
        {pendingCount > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            {isSyncing ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <AlertCircle size={16} />
            )}
            جاري مزامنة {pendingCount} عمليات
          </motion.div>
        )}

        {isOnline && pendingCount === 0 && isSyncing && (
           <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <CheckCircle2 size={16} />
            تمت المزامنة بنجاح
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SyncStatusIndicator;
