"use client";

import { useEffect, useState, createContext, ReactNode, useContext } from 'react';
import { getDatabase } from '@/lib/db/database';
import { setupReplication } from '@/lib/db/sync';
import type { RxDatabase } from 'rxdb';

export const DbContext = createContext<RxDatabase | null>(null);

export function useDatabase() {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DbProvider');
  }
  return context;
}

export function DbProvider({ userUid, children }: { userUid: string; children: ReactNode }) {
  const [db, setDb] = useState<RxDatabase | null>(null);

  useEffect(() => {
    let mounted = true;
    let replications: any[] = [];

    setDb(null); // Reset when user changes
    
    getDatabase(userUid).then((database) => {
      if (mounted) {
        replications = setupReplication(database, userUid);
        setDb(database);
      }
    });

    return () => {
      mounted = false;
      // Stop all active replications when user changes or unmounts
      replications.forEach((rep) => rep.cancel());
    };
  }, [userUid]);

  if (!db) {
    // Return a minimal loading state while the local DB initializes
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Initializing local database...</div>;
  }

  return (
    <DbContext.Provider value={db}>
      {children}
    </DbContext.Provider>
  );
}
