"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Always register the service worker (even in dev) so push notifications work.
    // The sw.js itself detects localhost and bypasses caching to keep HMR working.
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      console.log("[SW] Registered:", registration.scope);

      // ── PWA Update Detection ──
      // If there is already a waiting worker (e.g. from a previous page load), prompt immediately.
      if (registration.waiting) {
        promptUserToUpdate(registration.waiting);
      }

      // Listen for new workers that finish installing and enter the "waiting" state.
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // The new worker is installed and waiting to activate.
          // This happens when a new version of sw.js has been deployed.
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            promptUserToUpdate(newWorker);
          }
        });
      });
    }).catch((err) => {
      console.warn("[SW] Registration failed:", err);
    });

    // When the controlling worker changes (after SKIP_WAITING), reload the page.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, [])

  return null
}

function promptUserToUpdate(waitingWorker: ServiceWorker) {
  toast("A new update is available", {
    description: "Reload to get the latest version of the app.",
    duration: Infinity,
    action: {
      label: "Update Now",
      onClick: () => {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
        // The controllerchange event listener will handle the reload
      },
    },
  });
}
