---
slug: pwa/cache-storage-api
title: Cache Storage API
description: Store responses with the Cache Storage API, precache the Daily Quote app shell during install, answer requests from the cache, and delete old cache versions.
tags:
  - pwa
  - service-workers
  - cache-storage
  - offline
  - javascript
---

In the previous lesson, the service worker caught every request in its `fetch` handler. To answer a request without the network, it needs somewhere to keep responses. The `Cache Storage API` is that place. It is a store of request and response pairs that your code fills and reads itself.

In this lesson you save the app's core files during `install`, answer requests from the cache, and delete old caches when a new version activates.

## Two different caches

The browser already has an `HTTP cache`. It stores responses on its own and follows headers such as `Cache-Control`. You do not decide what it keeps or for how long.

Cache Storage is separate from it:

- Only your code adds and removes entries. The browser does not fill it by itself.
- It ignores HTTP caching headers. An entry never expires; it stays until you delete it.
- It belongs to one origin. Every page and the service worker on `http://localhost:8080` see the same caches.
- An origin can have several named caches. Each cache maps a request to a response.

The global `caches` object gives access to all of them. It exists in the service worker and on normal pages, so you can try it in the DevTools console first.

## The API in a few calls

Open `http://localhost:8080`, open the DevTools console, and run these lines one by one. The console accepts `await` at the top level.

`caches.open(name)` returns the cache with that name. It creates the cache if it does not exist yet:

```js
const cache = await caches.open('daily-quote-v1');
```

`cache.addAll(urls)` downloads each URL and stores the responses. If any download fails or returns a status outside 200–299, the whole call rejects and nothing from it is stored:

```js
await cache.addAll(['/', '/style.css']);
```

`cache.put(request, response)` stores a response that you already have. A response body can be read only once. If you also need the response elsewhere, for example to return it to the page, store a copy made with `response.clone()`:

```js
const response = await fetch('/quotes.json');
await cache.put('/quotes.json', response.clone());
const quotes = await response.json();
```

`cache.match(request)` looks for a stored response in one cache. `caches.match(request)` searches every cache of the origin, in the order the caches were created. Both resolve to `undefined` when nothing matches, so always check the result:

```js
const cached = await caches.match('/style.css');
console.log(cached ? cached.status : 'not cached');
```

The key is the full URL. `/` and `/index.html` are two different entries, and so are `/app.js` and `/app.js?v=2`.

`cache.delete(request)` removes one entry. `caches.keys()` lists the cache names, and `caches.delete(name)` removes a whole cache. Both delete methods resolve to `true` when something was deleted:

```js
await cache.delete('/quotes.json');
console.log(await caches.keys());
await caches.delete('daily-quote-v1');
```

The last line removes the test cache, so the service worker starts with a clean state.

## Precache the app shell

The `app shell` is the set of files the app needs to start: the HTML pages, styles, script, manifest, and icons. Saving these files before they are requested is called `precaching`. The `install` event is the right moment for it.

Replace the contents of `sw.js` with this version. It keeps the `install`, `activate`, and `fetch` handlers from earlier lessons and gives each of them real work. The `activate` handler still calls `self.clients.claim()`, and the `message` handler from lesson 6 still calls `skipWaiting()` when the update prompt asks for it:

```js
const CACHE_NAME = 'daily-quote-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/about.html',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(fromCacheOrNetwork(event.request));
});

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

async function deleteOldCaches() {
  const names = await caches.keys();
  const oldNames = names.filter(
    (name) => name.startsWith('daily-quote-') && name !== CACHE_NAME
  );
  await Promise.all(oldNames.map((name) => caches.delete(name)));
}

async function fromCacheOrNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
```

`event.waitUntil(precache())` keeps the worker in the installing state until the promise settles. If `addAll` rejects, for example because a file in `APP_SHELL` is missing, installation fails. The browser then keeps the old worker and tries again on a later visit. A new worker never starts with half of its files.

Check that every path in `APP_SHELL` exists. One typo is enough to stop the whole installation.

## Answer requests from the cache

The `fetch` handler skips requests that are not `GET` or that go to another origin. It does not call `respondWith` for them, so the browser handles them as usual.

For other requests, `fromCacheOrNetwork` looks in the cache first. On a hit, the page gets the stored response, and the network is not used. On a miss, the worker downloads the file, saves a copy with `cache.put`, and returns the original response. It saves only successful responses, so an error page never lands in the cache.

`quotes.json` is not in the app shell. It goes into the cache the first time `app.js` requests it. After that, the app always shows the same saved quotes, even when the file on the server changes. This is fine for a first example. In the next lesson, you choose a better strategy for each kind of file.

## Check the result in DevTools

Reload the page. The new worker installs and waits. Activate it with the Reload button of the update prompt from lesson 6, or open **Application > Service workers** in Chrome DevTools and click **skipWaiting**.

Then open **Application > Storage > Cache storage** and select `daily-quote-v1`. The table lists every stored request. Select a row to see its headers and a preview of the body. If the list looks out of date, click **Refresh**.

Reload the page once more and open the **Network** panel. Responses served by the worker show `(ServiceWorker)` in the **Size** column.

Now edit `style.css` and reload. The old styles stay, because the worker answers from the cache. While you edit files, either turn on **Bypass for network** in **Application > Service workers**, or release a new cache version.

## Release a new version

The browser installs a new worker only when the bytes of `sw.js` change. A version number in the cache name gives you a natural reason to change them.

Change the first line of `sw.js`:

```js
const CACHE_NAME = 'daily-quote-v2';
```

Reload the page and activate the new worker as before. Its `install` handler downloads a fresh app shell into `daily-quote-v2`. Its `activate` handler runs when it takes over from the old worker. No worker reads `daily-quote-v1` any more, so the handler deletes it. Refresh **Cache storage**: only `daily-quote-v2` remains.

The filter on the `daily-quote-` prefix matters. Other code on the same origin may own caches with other names, and `deleteOldCaches` leaves them alone.

## Storage quota

Cache Storage shares a quota with other site storage, such as IndexedDB. Each browser limits how much one origin can store. When the disk runs low, the browser may delete all of an origin's data. Run this in the console to see the current usage and the limit, in bytes:

```js
const { usage, quota } = await navigator.storage.estimate();
console.log(usage, quota);
```

Both numbers are estimates. An app shell of a few files uses only a small part of the quota, but do not treat the cache as permanent storage. The app should still work when the cache is empty.

## Official resources

- [Cache on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [CacheStorage on MDN](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage)
- [The Cache API: A quick guide on web.dev](https://web.dev/articles/cache-api-quick-guide)
- [Storage quotas and eviction criteria on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [View cache data with Chrome DevTools](https://developer.chrome.com/docs/devtools/storage/cache)
