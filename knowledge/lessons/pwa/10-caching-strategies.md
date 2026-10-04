---
slug: pwa/caching-strategies
title: Caching Strategies
description: Write cache first, network first, and stale-while-revalidate as small functions, and route each Daily Quote request to the strategy that fits it.
tags:
  - pwa
  - service-workers
  - caching
  - offline
  - javascript
---

In the last lesson, `sw.js` saved the app shell into a cache. Now the `fetch` handler must decide how to answer each request: from the cache, from the network, or from both. A `caching strategy` is a fixed rule for that decision. There are only a few common strategies, and each one is a short function.

Every strategy balances three goals: speed, freshness, and offline support. No single strategy wins on all three. So a good service worker uses different strategies for different kinds of files.

## Start from the current worker

From lesson 9, the top of `sw.js` has a cache name and an app shell list, similar to this:

```js
const CACHE_NAME = 'daily-quote-v2';
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
```

Keep the `install` and `activate` handlers and their helper functions. In this lesson, you add the strategy functions and replace the `fetch` handler.

Two rules from the Cache Storage API apply to every strategy. First, the cache stores only `GET` requests. Second, a response body can be read only once. To send a response to the page and also store it, call `response.clone()` and store the copy.

## Cache first

`Cache first` (cache falling back to network) looks in the cache and returns the match. Only on a miss does it go to the network. It then stores the new response for next time.

```js
async function cacheFirst(request) {
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

This is the same logic as `fromCacheOrNetwork` from lesson 9, so you can rename that function to `cacheFirst`. It is the fastest strategy, and it works offline once a file is cached. The cost is freshness. A cached file never changes until you change the cache. For the app shell, that is fine: when you edit `style.css`, you also bump the cache name to the next version, `daily-quote-v3`. The new worker then installs and precaches fresh copies, as in lessons 6 and 9.

## Network first

`Network first` (network falling back to cache) asks the network first. When the request succeeds, it updates the cache. When the network fails, it returns the last saved copy.

```js
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
```

`fetch()` rejects only when the network itself fails. An HTTP error, such as `404`, still comes back as a response, so this function returns it to the page.

Online, the user always gets the newest data. The cost is speed: every request waits for the network. On a slow connection, the page can wait a long time before the cache is used.

## Stale-while-revalidate

`Stale-while-revalidate` answers from the cache at once. At the same time, it asks the network for a new copy and stores it for the next request. When nothing is cached yet, it waits for the network.

```js
function staleWhileRevalidate(event) {
  const { request } = event;

  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });

  // Keep the worker alive until the background update finishes.
  event.waitUntil(network.catch(() => {}));

  return caches.match(request).then((cached) => cached || network);
}
```

This function takes the whole event, not just the request. The page may get its cached response long before the network answers. After that, the browser may stop an idle service worker, and the update would be lost. `event.waitUntil()` tells the browser to keep the worker running until the promise settles. The `catch` turns a failed update into a quiet no-op, because the page already has its answer.

The result is fast and works offline. The cost is that the user sees data that is one visit old. A change on the server appears on the next load, not on the current one.

## Network only and cache only

Two more strategies are simple enough to need almost no code.

`Network only` always uses the network and never touches the cache. You get it for free when the `fetch` handler does not call `event.respondWith()`: the browser then handles the request as usual. Use it for requests that must not be cached, such as `POST` requests or analytics.

`Cache only` answers only from the cache:

```js
async function cacheOnly(request) {
  const cached = await caches.match(request);
  return cached || Response.error();
}
```

`Response.error()` makes the request fail like a network error. Cache only is safe only for files that you know were precached. In practice, cache first covers the same files and can also recover from a miss.

## Route requests by type

Now connect the strategies to the requests of Daily Quote. Replace the `fetch` handler from lesson 9 with this one:

```js
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network only: other methods and other origins go to the browser.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Data: answer fast, refresh in the background.
  if (url.pathname === '/quotes.json') {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // App shell and other static files: cache first.
  event.respondWith(cacheFirst(request));
});
```

The order matters. The first check lets everything the worker should not handle pass straight to the network. The second check picks out the data file. Everything else is the app shell or another static file, such as a page, a style sheet, a script, or an icon.

## Choose a strategy for quotes.json

`quotes.json` is the only file that changes without a new app version. You can add a quote on the server at any time. So cache first is wrong for it: users would never see new quotes until the next cache version. Both network first and stale-while-revalidate keep it fresh and work offline.

The choice depends on how much an old copy costs. Daily Quote shows one random quote from the list. A list that is one visit old is still a good list. Speed matters more here: with stale-while-revalidate, the quote appears at once, even on a slow connection. So Daily Quote uses stale-while-revalidate.

Pick network first when old data is a real problem. Examples are an account balance, an order status, or a news page where the user expects the latest version. Then the user waits a little longer online, but never sees stale data while the network works.

## Compare the trade-offs

| Strategy | Speed | Freshness | Offline | Good for |
| --- | --- | --- | --- | --- |
| Cache first | Fastest after the first load | Old until the cache changes | Yes, once cached | Versioned app shell, icons, fonts |
| Network first | Waits for the network | Newest while online | Yes, last saved copy | Data that must be current |
| Stale-while-revalidate | Fast once cached | One visit behind | Yes, once cached | Data where a slightly old copy is fine |
| Network only | Waits for the network | Always new | No | `POST` requests, analytics, payments |
| Cache only | Fastest | Only what was precached | Yes | Files that are certainly precached |

## Try it

1. Add the strategy functions and the new `fetch` handler to `sw.js`.
2. Run `npx http-server -c-1` in `daily-quote/` and open `http://localhost:8080` in Chrome.
3. Activate the updated worker as you did in lesson 7. For example, turn on **Update on reload** in DevTools under **Application > Service workers**, reload the page, and turn the option off again.
4. Open **Application > Storage > Cache storage** and select `daily-quote-v2`. Check that it now has an entry for `/quotes.json`.
5. Add a new quote to `quotes.json` and reload once. The page still uses the old list, but the cached `/quotes.json` now has your new quote. If the cache view looks out of date, click **Refresh**. The next reload uses the new list.
6. In the **Network** panel, set throttling to **Offline** and reload. The page and a quote still appear, because both come from the cache.

Turn throttling back to **No throttling** when you finish.

## Libraries package these strategies

You will rarely write these functions by hand in a large project. Libraries such as [Workbox](https://developer.chrome.com/docs/workbox) ship the same strategies as ready-made classes, with extras such as a network timeout for network first and limits on cache size. They follow the same ideas, so the trade-offs in this lesson still decide which one to use.

The next lesson adds an offline fallback page for requests that are neither cached nor reachable.

## Official resources

- [Serving, in Learn PWA on web.dev](https://web.dev/learn/pwa/serving)
- [Strategies for service worker caching on Chrome for Developers](https://developer.chrome.com/docs/workbox/caching-strategies-overview)
- [FetchEvent on MDN](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent)
- [ExtendableEvent: waitUntil() method on MDN](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil)
