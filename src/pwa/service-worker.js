// @ts-nocheck: a classic worker script whose build constants exist only in the generated sw.js.
// Service worker template. The build prepends BASE, OFFLINE_PAGES, PRECACHE, and ILLUSTRATIONS
// (see src/integrations/pwa.ts).
//
// Every build file except illustrations is precached, so the whole site reads offline. Pages and
// data are fetched network-first so an online reader always sees the latest deploy; the cache is
// the fallback. Other files are served from the cache. A cache key carries the file's revision,
// so a new deploy downloads only the files that changed. Illustrations are cached only when a
// page that shows them is opened.

const CACHE = 'explained-precache';
const ILLUSTRATION_CACHE = 'explained-illustrations';
const NETWORK_TIMEOUT = 3000;
const INSTALL_BATCH = 8;

/** Absolute URL of each precached file mapped to its revisioned cache key. */
const cacheKeys = new Map(
  PRECACHE.map(({ url, revision }) => {
    const absolute = new URL(url, self.location.origin);
    const key = new URL(absolute);
    key.searchParams.set('__revision', revision);
    return [absolute.href, key.href];
  }),
);

/** Absolute URLs of the current illustrations; their names carry a content hash. */
const illustrations = new Set(ILLUSTRATIONS.map((url) => new URL(url, self.location.origin).href));

/** Responses that change with content and must not be served stale while the network is reachable. */
const isNetworkFirst = (pathname) => /(\/|\.html|\.json|\.webmanifest)$/.test(pathname);

// A redirected response cannot answer a navigation, so cache a plain copy.
const cleanResponse = async (response) =>
  response.redirected
    ? new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers })
    : response;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = new Set((await cache.keys()).map((request) => request.url));
      const missing = [...cacheKeys].filter(([, key]) => !cached.has(key));

      for (let start = 0; start < missing.length; start += INSTALL_BATCH) {
        await Promise.all(
          missing.slice(start, start + INSTALL_BATCH).map(async ([url, key]) => {
            const response = await fetch(url, { cache: 'reload' });
            if (!response.ok) throw new Error(`Precache request failed: ${response.status} ${url}`);
            await cache.put(key, await cleanResponse(response));
          }),
        );
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = new Set(cacheKeys.values());
      const cache = await caches.open(CACHE);
      const stale = (await cache.keys()).filter((request) => !current.has(request.url));
      await Promise.all(stale.map((request) => cache.delete(request)));

      // Drop illustrations that the current deploy no longer contains.
      const illustrationCache = await caches.open(ILLUSTRATION_CACHE);
      const removed = (await illustrationCache.keys()).filter((request) => !illustrations.has(request.url));
      await Promise.all(removed.map((request) => illustrationCache.delete(request)));

      await self.clients.claim();
    })(),
  );
});

const fromCache = async (key) => (key ? (await caches.open(CACHE)).match(key) : undefined);

const offlinePage = (url) => {
  const [, page] = OFFLINE_PAGES.find(([prefix]) => url.pathname.startsWith(prefix)) ?? [];
  return page ? fromCache(cacheKeys.get(new URL(page, url.origin).href)) : undefined;
};

const fetchWithTimeout = (request) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT);
    fetch(request).then(resolve, reject).finally(() => clearTimeout(timer));
  });

const networkFirst = async (request, key, url) => {
  try {
    const response = await fetchWithTimeout(request);
    if (response.ok || !key) return response;
    return (await fromCache(key)) ?? response;
  } catch {
    return (await fromCache(key)) ?? (await offlinePage(url)) ?? Response.error();
  }
};

const cacheFirst = async (request, key) => (await fromCache(key)) ?? fetch(request);

const cacheOnFirstView = async (request, url) => {
  const cache = await caches.open(ILLUSTRATION_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(url, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  const href = `${url.origin}${url.pathname}`;
  const key = cacheKeys.get(href);
  if (illustrations.has(href)) {
    event.respondWith(cacheOnFirstView(request, href));
  } else if (key) {
    event.respondWith(isNetworkFirst(url.pathname) ? networkFirst(request, key, url) : cacheFirst(request, key));
  } else if (request.mode === 'navigate') {
    // A page that appeared after the last install: show it online, or the offline page.
    event.respondWith(networkFirst(request, undefined, url));
  }
});
