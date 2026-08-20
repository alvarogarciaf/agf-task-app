const CACHE_NAME = "tasker-agf-v1787190943993";
const IMAGE_CACHE_NAME = "tasker-images-v1";
const PRECACHE_URLS = ["/", "/manifest.json", "/logo.svg", "/placeholder.jpg"];

// Detect localhost to bypass caching for development HMR
const isLocalhost = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  if (isLocalhost) {
    // Skip caching AND skip waiting in development so HMR works
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch((err) => {
      console.warn("SW precache failed (non-fatal):", err);
    })
  );
  // NOTE: Do NOT call self.skipWaiting() here in production.
  // This allows the new SW to enter the "waiting" state so the app
  // can show the "Update available" toast before activating.
  // The SKIP_WAITING message handler below handles the controlled activation.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Listen for SKIP_WAITING message from client for PWA update flow
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ──────────────────────────────────────────────
// Web Push Notification Handlers
// ──────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "New Notification", body: event.data.text() };
  }

  const title = payload.title || "Task App";
  const options = {
    body: payload.body || "",
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// ──────────────────────────────────────────────
// Fetch handler (disabled on localhost)
// ──────────────────────────────────────────────

// URLs that should NEVER be cached (Firebase Firestore API, auth, analytics)
const NETWORK_ONLY_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firebaseinstallations\.googleapis\.com/,
  /fcm\.googleapis\.com/,
  /analytics/,
  /vitals/,
  /sw\.js/,
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(url));
}

// Check if request is for an image (Firebase Storage, proxy, local, or remote)
function isImageRequest(request, url) {
  if (request.destination === "image") return true;
  if (/firebasestorage\.googleapis\.com/.test(url)) return true;
  if (/firebasestorage\.app/.test(url)) return true;
  if (/\/api\/proxy-image/.test(url)) return true;
  return /\.(png|jpg|jpeg|webp|gif|svg|avif|ico)(\?.*)?$/i.test(url) || /%2F.*?\.(png|jpg|jpeg|webp|gif|svg|avif)(\?.*)?$/i.test(url);
}

// Cacheable asset extensions (JS, CSS, fonts)
function isCacheableAsset(url) {
  return /\.(js|css|woff2?|ttf|otf)(\?.*)?$/.test(url);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // In development, let everything pass through to the network
  if (isLocalhost) return;

  if (request.method !== "GET") return;

  // Never cache Firebase Firestore / auth / analytics API calls
  if (isNetworkOnly(request.url)) return;

  // 1. For Images: Cache-First with persistent Image Cache storage
  if (isImageRequest(request, request.url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.ok || networkResponse.type === "opaque")) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Return placeholder if offline and not cached
              return caches.match("/placeholder.jpg");
            });
        })
      )
    );
    return;
  }

  // 2. For navigation requests: stale-while-revalidate with fallback
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => caches.match("/", { ignoreSearch: true }));

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. For JS/CSS/font assets: cache-first with background revalidation
  if (isCacheableAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        // Serve from cache instantly, update in background
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Everything else: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
