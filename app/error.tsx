"use client"
import { useEffect, useState } from "react"
import { AlertOctagon, RotateCcw, Trash2, ShieldAlert } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    // Log the error securely for diagnostics
    console.error("[GlobalError] Intercepted client exception:", error)

    // Auto-recover from Next.js ChunkLoadError (caused by stale service worker cache after deployments)
    if (error.name === "ChunkLoadError" || error.message?.includes("ChunkLoadError")) {
      console.warn("[GlobalError] ChunkLoadError detected. Clearing caches and reloading...")
      const clearAndReload = () => window.location.reload()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cacheApi = (window as any).caches as CacheStorage | undefined
      if (cacheApi) {
        cacheApi.keys().then((names) => Promise.all(names.map((n) => cacheApi.delete(n)))).finally(clearAndReload)
      } else {
        clearAndReload()
      }
    }
  }, [error])

  const handleResetAppData = async () => {
    setIsResetting(true)
    try {
      if (typeof window !== "undefined") {
        // Clear Service Worker Caches
        if ("caches" in window) {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map((name) => caches.delete(name)))
          console.log("[GlobalError] Cleared service worker caches")
        }

        // Find and delete RxDB and tasker IndexedDB instances
        const dbs = await window.indexedDB.databases()
        dbs.forEach((db) => {
          if (db.name?.startsWith("rxdb") || db.name?.includes("taskeragf")) {
            console.log(`[GlobalError] Deleting database: ${db.name}`)
            window.indexedDB.deleteDatabase(db.name)
          }
        })
        
        // Clear application settings and preferences
        localStorage.clear()
        
        // Unregister service workers
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          for (const registration of registrations) {
            await registration.unregister()
          }
        }

        // Force refresh to start with clean state
        window.location.reload()
      }
    } catch (err) {
      console.error("[GlobalError] Failed to reset app data:", err)
      setIsResetting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0f1a] px-6 text-foreground selection:bg-primary/20">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl backdrop-blur-md">
        {/* Header Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive mb-5">
          <ShieldAlert className="h-7 w-7" />
        </div>

        {/* Title */}
        <h1 className="text-center text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Application Load Failure
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
          An unexpected local database or client-side runtime exception has occurred. You can attempt to retry or perform a self-healing reset.
        </p>

        {/* Diagnostic Panel */}
        <div className="mt-5 rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="flex items-start gap-2.5 font-mono text-xs">
            <AlertOctagon className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 overflow-x-auto text-left text-muted-foreground whitespace-pre-wrap select-text">
              <span className="font-semibold text-foreground">Diagnostics: </span>
              {error.message || "Unknown client-side exception"}
              {error.digest && (
                <div className="mt-1 text-[10px] opacity-75">Digest: {error.digest}</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          
          <button
            type="button"
            onClick={handleResetAppData}
            disabled={isResetting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm font-semibold text-destructive transition-all hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
          >
            <Trash2 className="h-4 w-4" />
            {isResetting ? "Resetting State..." : "Reset App Data"}
          </button>
        </div>

        {/* Help Footer */}
        <div className="mt-5 text-center text-[11px] text-muted-foreground/75 leading-relaxed">
          Resetting App Data clears local database storage and preferences, pulling clean data fresh from Firestore upon logging back in.
        </div>
      </div>
    </div>
  )
}
