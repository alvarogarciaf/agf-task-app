"use client";

import {
  useEffect,
  useState,
  createContext,
  ReactNode,
  useContext,
} from "react";
import { combineLatest, merge, Subscription } from "rxjs";
import { getDatabase, getDatabaseSync } from "@/lib/db/database";
import { setupReplication } from "@/lib/db/sync";
import type { RxDatabase } from "rxdb";
import type { RxFirestoreReplicationState } from "rxdb/plugins/replication-firestore";

export const DbContext = createContext<RxDatabase | null>(null);

export type SyncStatus = {
  browserOnline: boolean;
  replicationActive: boolean;
  replicationError: string | null;
};

const defaultSyncStatus: SyncStatus = {
  browserOnline: true,
  replicationActive: true,
  replicationError: null,
};

export const SyncStatusContext = createContext<SyncStatus>(defaultSyncStatus);

export function useDatabase() {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DbProvider");
  }
  return context;
}

export function useSyncStatus() {
  return useContext(SyncStatusContext);
}

export function DbProvider({
  userUid,
  children,
}: {
  userUid: string;
  children: ReactNode;
}) {
  const [db, setDb] = useState<RxDatabase | null>(() => getDatabaseSync(userUid));
  const [throwError, setThrowError] = useState<Error | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => ({
    browserOnline:
      typeof navigator !== "undefined" ? navigator.onLine : true,
    replicationActive: true,
    replicationError: null,
  }));

  useEffect(() => {
    let mounted = true;
    let replications: RxFirestoreReplicationState<unknown>[] = [];
    const rxSubs = new Subscription();

    const onBrowserOnline = () => {
      if (!mounted) return;
      setSyncStatus((s) => ({ ...s, browserOnline: true, replicationError: null }));
      // Immediately force manual resync for all collections when network is restored
      replications.forEach((r) => {
        try {
          r.reSync();
        } catch (e) {
          console.warn("[DbProvider] replication reSync failed:", e);
        }
      });
    };
    const onBrowserOffline = () => {
      if (!mounted) return;
      setSyncStatus((s) => ({ ...s, browserOnline: false }));
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", onBrowserOnline);
      window.addEventListener("offline", onBrowserOffline);
    }

    setSyncStatus({
      browserOnline:
        typeof navigator !== "undefined" ? navigator.onLine : true,
      replicationActive: true,
      replicationError: null,
    });
    
    const syncDb = getDatabaseSync(userUid);
    if (!syncDb) {
      setDb(null);
    }

    getDatabase(userUid).then((database) => {
      if (!mounted) {
        return;
      }
      // Render the UI with local data immediately
      setDb(database);

      // Start Firestore replication in the background after UI has the DB
      queueMicrotask(() => {
        if (!mounted) return;
        replications = setupReplication(database, userUid);
        if (replications.length > 0) {
          rxSubs.add(
            combineLatest(replications.map((r) => r.active$)).subscribe(
              (actives) => {
                if (!mounted) return;
                const allActive = actives.length > 0 && actives.every(Boolean);
                setSyncStatus((s) => ({
                  ...s,
                  replicationActive: allActive,
                  // Clear replicationError once all sync queues are active
                  replicationError: allActive ? null : s.replicationError,
                }));
              },
            ),
          );
          rxSubs.add(
            merge(...replications.map((r) => r.error$)).subscribe((err) => {
              if (!mounted) return;
              const msg =
                err && typeof err === "object" && "message" in err
                  ? String((err as { message: unknown }).message)
                  : String(err);
              setSyncStatus((s) => ({ ...s, replicationError: msg }));
            }),
          );
        }
      });
    }).catch((err) => {
      if (!mounted) return;
      console.error("[DbProvider] Failed to load local database:", err);
      setThrowError(err instanceof Error ? err : new Error(String(err)));
    });

    return () => {
      mounted = false;
      rxSubs.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onBrowserOnline);
        window.removeEventListener("offline", onBrowserOffline);
      }
      void Promise.all(replications.map((r) => r.cancel()));
    };
  }, [userUid]);

  if (throwError) {
    throw throwError;
  }

  if (!db) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Initializing local database…
      </div>
    );
  }

  return (
    <SyncStatusContext.Provider value={syncStatus}>
      <DbContext.Provider value={db}>{children}</DbContext.Provider>
    </SyncStatusContext.Provider>
  );
}
