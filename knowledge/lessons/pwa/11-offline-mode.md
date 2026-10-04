---
slug: pwa/offline-mode
title: Offline Mode
description: Make Daily Quote usable without a network with an offline page, a fallback for quotes.json, and an online status hint, then test it in DevTools and in the installed app.
tags:
  - pwa
  - service-workers
  - offline
  - caching
  - javascript
---

After the last lesson, Daily Quote already opens without a network, as long as every file it needs is in the cache. Two gaps remain. A page that was never cached shows the browser's own error page. And when `quotes.json` is in neither the network nor the cache, the app shows "Could not load quotes."

In this lesson you close both gaps, show the user when they seem to be offline, and test the result from start to finish.

## Add an offline page

An `offline page` is a small page that the service worker returns when the user opens a page that it cannot load. It replaces the browser's error page with a page of your own app.

Create `offline.html` in the project root:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline · Daily Quote</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <h1>Daily Quote</h1>
  </header>
  <main>
    <p>You are offline, and this page is not saved on your device.</p>
    <p><a href="/">Open the home page</a>. It works without a network.</p>
  </main>
</body>
</html>
```

Keep this page simple. It must work with no network at all, so it uses only files that are already in the cache. Here that is `style.css`.

The worker returns this page in place of another one, so the address bar keeps the URL that the user opened, such as `/news.html`. That is why the style sheet path starts with `/`. A relative path would be resolved against the wrong folder.

The link leads to the home page because it is precached. The user gets a working page instead of a dead end.

## Precache it in a new cache version

The offline page must be in the cache before the network fails. So add it to the app shell in `sw.js`, and give the cache a new name:

```js
const CACHE_NAME = 'daily-quote-v3';
const OFFLINE_URL = '/offline.html';

const APP_SHELL = [
  '/',
  '/index.html',
  '/about.html',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  OFFLINE_URL,
];
```

The new name does two jobs. First, it changes the bytes of `sw.js`, so the browser installs a new worker. Second, that worker fills a fresh cache with fresh copies of every file. The old worker keeps serving open pages from the old cache in the meantime. When the new worker activates, the `deleteOldCaches` function from lesson 9 removes the old cache. You do not need to change the `install` or `activate` handlers.

## Return the offline page for failed navigations

Lesson 8 showed that a request with `request.mode === 'navigate'` loads a whole HTML page. Only these requests should get the offline page. A failed image or script must not get an HTML page in return.

With the `fetch` handler from lesson 10, a navigation goes to `cacheFirst`. On a cache miss, `cacheFirst` calls `fetch()`. Without a network, `fetch()` rejects, the promise passed to `respondWith()` rejects too, and the browser shows its error page. So catch that error and answer with the offline page.

Replace the `fetch` handler with this version:

```js
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network only: other methods and other origins go to the browser.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Data: answer fast, refresh in the background, never fail.
  if (url.pathname === '/quotes.json') {
    event.respondWith(
      staleWhileRevalidate(event).catch(() => fallbackQuotes())
    );
    return;
  }

  // Pages: cache first, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      cacheFirst(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Other static files: cache first.
  event.respondWith(cacheFirst(request));
});
```

The `catch` runs only when the network itself fails. When the server is reachable but the page does not exist, `fetch()` returns a `404` response. The user then sees the server's "not found" page, which is the correct answer.

`caches.match(OFFLINE_URL)` cannot miss. The page is part of the app shell, and if precaching fails, the new worker does not install at all.

## Add a fallback for quotes.json

`staleWhileRevalidate` answers from the cache when it can. When nothing is cached and the network fails, its promise rejects. This can happen when the browser cleared the cache, or when the first download of `quotes.json` failed.

In that case, the worker can build a response itself. Add this code below the strategy functions in `sw.js`:

```js
const FALLBACK_QUOTES = [
  {
    text: 'No network right now. Your quotes will be back soon.',
    author: 'Daily Quote',
  },
];

function fallbackQuotes() {
  return new Response(JSON.stringify(FALLBACK_QUOTES), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

The `Response` constructor creates a response from a string. It has the same shape as `quotes.json`, so `app.js` needs no changes: it parses the list and shows the only quote in it.

The fallback is never stored in the cache. `staleWhileRevalidate` saves only responses that came from the network. As soon as the network returns, the next request gets the real list again.

## Show the connection status

A user who sees old quotes should know why. The browser offers a hint: `navigator.onLine` is `false` when the browser knows it has no network connection. When the value changes, the `online` and `offline` events fire on `window`.

Add a status line to the header of `index.html`, after the `<nav>` element:

```html
<p id="connection" role="status"></p>
```

`role="status"` asks screen readers to announce changes to its text.

Add this code to the end of `app.js`:

```js
const connectionElement = document.querySelector('#connection');

function showConnection() {
  connectionElement.textContent = navigator.onLine
    ? 'Online'
    : 'Offline — showing saved data';
}

window.addEventListener('online', showConnection);
window.addEventListener('offline', showConnection);
showConnection();
```

The page calls `showConnection` once at start, then again after each change.

Treat this value only as a hint. Browsers decide it with simple rules. In general, a connection to a local network counts as online, even when that network has no internet access. So `false` is a fairly reliable sign of trouble, but `true` does not mean that your server is reachable. Never disable features based on `navigator.onLine`. The real test is whether a request succeeds, and the service worker already handles that case.

## Test it in DevTools

Start the server from `daily-quote/` with `npx http-server -c-1` and open `http://localhost:8080` in Chrome. Then follow these steps:

1. Reload the page so the browser finds the new worker. Activate it with the **Reload** button of the update prompt from lesson 6, or click **skipWaiting** in **Application > Service workers**.
2. Open **Application > Cache storage**. Only `daily-quote-v3` remains, and it has an entry for `/offline.html`. Click **Refresh** if the list looks old.
3. In **Application > Service workers**, select the **Offline** checkbox. The status line changes to "Offline — showing saved data" without a reload, because the `offline` event fired.
4. Reload the page. The page and a quote still appear, both from the cache.
5. Open `http://localhost:8080/news.html`. This page was never cached, so you see the offline page. Click its link to return to the home page.
6. Still offline, open **Cache storage**, select the `/quotes.json` row, and delete it. Reload the home page. It shows the fallback quote.
7. Clear the **Offline** checkbox and reload. The real quotes are back, and `/quotes.json` is in the cache again.

The **Offline** checkbox is the same switch as the **Offline** option in the throttling menu of the **Network** panel. Repeat steps 3–7 from there: open the **Network** panel, choose **Offline** in the throttling menu, and later choose **No throttling**. The Network panel also shows which requests failed and which came from the service worker.

This emulation applies only to the tab where DevTools is open. Close DevTools, and the tab uses the real network again.

## Test the installed app with the network off

DevTools tests a tab. The real goal is the installed app from lesson 3, started when the network is down.

On your Mac, turning off Wi-Fi alone is not enough. `http-server` runs on the same computer, and requests to `localhost` still reach it. For your app, "the network is down" means "the server cannot be reached". So stop both:

1. Open the installed Daily Quote app once while the server runs, so it uses the new worker. Activate the worker through the update prompt if it appears.
2. Quit the app. In the terminal, stop the server with `Ctrl-C`.
3. Turn off Wi-Fi in Control Center. If your Mac also uses an Ethernet cable, unplug it.
4. Open Daily Quote from the Dock or Spotlight.

The app window opens with the home page and a quote. The status line says "Offline — showing saved data". Click **About**: that page is cached too.

Now turn Wi-Fi back on but leave the server stopped. Reload the app with `Cmd-R`. The status line says "Online", but the server is still unreachable, and the app keeps working from the cache. This is the limit of `navigator.onLine` in practice.

The Chrome app shares its service worker and caches with Chrome, so it already has everything that the browser tab saved. A Safari web app in the Dock keeps its website data apart from Safari. It must download its own copy of the app shell while the server runs, so step 1 matters even more there. Restart the server with `npx http-server -c-1` when you finish.

## Official resources

- [Create an offline fallback page on web.dev](https://web.dev/articles/offline-fallback-page)
- [Request: mode property on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Request/mode)
- [Navigator: onLine property on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)
- [Response() constructor on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response)
- [Debug Progressive Web Apps on Chrome for Developers](https://developer.chrome.com/docs/devtools/progressive-web-apps)
