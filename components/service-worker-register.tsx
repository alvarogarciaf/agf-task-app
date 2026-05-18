"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err)
      })
    } else {
      // In development, automatically unregister any existing service workers
      // to prevent caching/stale assets from breaking Next.js HMR/dev server.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().then((unregistered) => {
            if (unregistered) {
              console.log("Automatically unregistered stale Service Worker in development mode.");
              // Reload to ensure all service worker controllers are cleared
              window.location.reload();
            }
          });
        }
      });
    }
  }, [])

  return null
}
