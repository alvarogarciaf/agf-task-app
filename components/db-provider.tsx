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

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<RxDatabase | null>(null);

  useEffect(() => {
    let mounted = true;
    getDatabase().then((database) => {
      if (mounted) {
        setupReplication(database);
        setDb(database);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

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
