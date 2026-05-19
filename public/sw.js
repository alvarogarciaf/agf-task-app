const CACHE_NAME = "tasker-agf-v6";
const PRECACHE_URLS = ["/", "/manifest.json", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch((err) => {
      console.warn("SW precache failed (non-fatal):", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// URLs that should NEVER be cached (Firebase/Firestore API, auth, analytics)
const NETWORK_ONLY_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /www\.googleapis\.com/,
  /firebase/,
  /analytics/,
  /vitals/,
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(url));
}

// Cacheable asset extensions (JS, CSS, fonts, images)
function isCacheableAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|svg|png|ico|webp|avif|jpg|jpeg)(\?.*)?$/.test(url);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  // Never cache Firebase/analytics API calls
  if (isNetworkOnly(request.url)) return;

  // For navigation requests: stale-while-revalidate with fallback
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

  // For JS/CSS/font/image assets: cache-first with background revalidation
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

  // Everything else: stale-while-revalidate
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
