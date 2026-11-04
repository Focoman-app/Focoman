// Focoman Studios Service Worker
const CACHE_NAME = 'focoman-v2';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icon.svg',
];

// Install: Precache shell assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Continue even if an individual asset fails to precache
        console.warn('[SW] Precache asset fetch warning:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up previous cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Pass-through non-GET requests (mutations, server actions)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Navigation requests: Network-First with /offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match('/offline');
        if (cachedOffline) {
          return cachedOffline;
        }
        // Fallback to cached root shell if available
        const cachedRoot = await cache.match('/');
        return (
          cachedRoot ||
          new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Focoman Studios - Offline</title></head><body style="font-family:sans-serif;background:#09090b;color:#fafafa;padding:2rem;text-align:center;"><h1>You are offline</h1><p>Please check your internet connection to continue.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        );
      })
    );
    return;
  }

  // 3. Static assets (images, icons, next static chunks): Cache-First / Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Fetch from network and cache
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Default: Network-First for API and dynamic data
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

