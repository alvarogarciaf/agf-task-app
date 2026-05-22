"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let activeRegistration: ServiceWorkerRegistration | null = null;
    let updateInterval: NodeJS.Timeout | null = null;

    const checkForUpdate = () => {
      if (activeRegistration && navigator.onLine) {
        activeRegistration.update().catch((e) => console.warn("[SW] Background update check failed:", e));
      }
    };

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    // Helper function to track the state change of an installing service worker
    const trackInstalling = (worker: ServiceWorker) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          const hasController = !!navigator.serviceWorker.controller;
          const isUpdating = localStorage.getItem("pwa_updating") === "true";
          const wasSwActive = localStorage.getItem("sw_active") === "true";
          if (hasController || isUpdating || wasSwActive) {
            promptUserToUpdate(worker);
          }
        }
      });
    };

    // Always register the service worker (even in dev) so push notifications work.
    // The sw.js itself detects localhost and bypasses caching to keep HMR working.
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      console.log("[SW] Registered:", registration.scope);
      activeRegistration = registration;

      // If a service worker is already active or controlling the page, mark sw_active
      if (navigator.serviceWorker.controller || registration.active) {
        localStorage.setItem("sw_active", "true");
      }
 
      // Force an update check immediately upon registration
      registration.update().catch((e) => console.warn("[SW] Initial update check failed:", e));

      // ── iOS & Mobile Update Optimization ──
      // Force check for update when the page is visible or focused again (e.g. app reopened)
      window.addEventListener("focus", checkForUpdate);
      document.addEventListener("visibilitychange", visibilityHandler);

      // Periodic check every 5 minutes while active
      updateInterval = setInterval(checkForUpdate, 5 * 60 * 1000);

      // ── PWA Update Detection ──
      // 1. If there is already a waiting worker, prompt immediately
      if (registration.waiting) {
        promptUserToUpdate(registration.waiting);
      }

      // 2. If there is an installing worker immediately, track it
      if (registration.installing) {
        trackInstalling(registration.installing);
      }

      // 3. Listen for new workers that start installing
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          trackInstalling(newWorker);
        }
      });
    }).catch((err) => {
      console.warn("[SW] Registration failed:", err);
    });

    // When the controlling worker changes (after SKIP_WAITING), reload the page.
    let refreshing = false;
    const controllerChangeHandler = () => {
      if (refreshing) return;

      const wasControlled = !!navigator.serviceWorker.controller;
      const isUpdating = localStorage.getItem("pwa_updating") === "true";

      if (!wasControlled && !isUpdating) {
        return; // First-time SW registration, skip reload
      }

      localStorage.setItem("sw_active", "true"); // Ensure sw_active is set
      localStorage.removeItem("pwa_updating");
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", controllerChangeHandler);

    return () => {
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", visibilityHandler);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChangeHandler);
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
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
        localStorage.setItem("pwa_updating", "true");

        let refreshed = false;
        const triggerReload = (reason: string) => {
          if (refreshed) return;
          refreshed = true;
          console.log(`[SW] Reloading page due to: ${reason}`);
          localStorage.setItem("sw_active", "true"); // Ensure sw_active is set
          localStorage.removeItem("pwa_updating");
          window.location.reload();
        };

        // 1. Direct statechange fallback listener on the waiting worker
        const handleStateChange = () => {
          if (waitingWorker.state === "activated") {
            triggerReload("Worker activated (statechange)");
          }
        };
        waitingWorker.addEventListener("statechange", handleStateChange);

        // 2. Safety timeout fallback (1.5 seconds) in case events are dropped by Chromium
        setTimeout(() => {
          triggerReload("Safety timeout (1.5s)");
        }, 1500);

        // 3. Trigger skip waiting on the waiting worker
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      },
    },
  });
}
