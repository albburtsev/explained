---
slug: pwa/what-a-service-worker-is
title: What a Service Worker Is
description: Understand a service worker as an event-driven script that sits between your pages and the network, and learn the limits it runs under.
tags:
  - pwa
  - service-workers
  - javascript
  - browser
---

The manifest made Daily Quote installable. But the installed app still needs the network: open it offline, and it fails. To change that, the app needs code that runs outside the page and decides how each request is answered. That code is a service worker. This lesson builds the mental model. The next lessons register one and put it to work.

## A proxy you write in JavaScript

A `service worker` is a JavaScript file that the browser runs separately from your pages. It acts as a `programmable proxy` between the pages of an origin and the network.

Without a service worker, a request from the page goes straight to the network:

```text
page ──────────────────────▶ network
```

With a service worker, requests from the pages it controls pass through it first:

```text
page ──▶ service worker ──▶ network
                │
                └──▶ cache
```

For each request, your code chooses the answer. It can send the request to the network as usual. It can return a saved copy from a cache. It can also build a response from scratch, for example an offline page. Offline mode, caching strategies, and updates all come from this one ability.

One service worker serves many pages. In Daily Quote, the same worker will handle requests from both `index.html` and `about.html`, in every open tab. Which pages it controls depends on its `scope`, which you will set in the next lesson.

## It reacts to events

A service worker is `event-driven`. It has no main loop and no code that runs all the time. The browser starts it when there is an event to handle, and your code reacts to that event. These are the events this course uses:

- `install`: the browser is installing a new or changed worker. This is the place to prepare files for offline use.
- `activate`: the new worker becomes active and replaces any older version. This is the place to delete old caches.
- `fetch`: a controlled page made a request, such as a page, a script, an image, or a call to `fetch()`.
- `push`: a push message arrived from your server. This can happen even when no page of the app is open.

Here is a minimal skeleton. It only logs each event:

```js
// sw.js — a skeleton that only logs events
self.addEventListener('install', (event) => {
  console.log('install');
});

self.addEventListener('activate', (event) => {
  console.log('activate');
});

self.addEventListener('fetch', (event) => {
  console.log('fetch', event.request.url);
});

self.addEventListener('push', (event) => {
  console.log('push');
});
```

Inside a service worker, `self` is the worker's global object, just as `window` is in a page. You attach every listener to it. The file does nothing on its own yet. The browser runs it only after a page registers it, and that is the topic of the next lesson.

## The rules it lives by

A service worker is powerful, so the browser runs it under strict rules. Each rule shapes how you write the code.

**No DOM.** The worker runs on its own thread, not on the page's thread. There is no `document` and no `window`, so it cannot read or change the page. When the page must update, the worker and the page exchange messages instead.

**Secure contexts only.** The browser offers service workers only in a `secure context`: a page served over HTTPS, or from `localhost` for local development. A worker can rewrite every response of a site. Over plain HTTP, an attacker on the network could replace it with their own script. That is why `http://localhost:8080` works, but the same app opened by your Mac's local network IP address over plain HTTP does not.

**The browser can stop it at any time.** When there are no events to handle, the browser stops the worker after a short idle time. It starts the worker again for the next event. Each restart runs the script from the top, so values in global variables are lost:

```js
let requestCount = 0;

self.addEventListener('fetch', () => {
  requestCount += 1; // starts again from 0 after every restart
});
```

Do not keep state in global variables. Store anything you need later in the Cache Storage API or IndexedDB.

**Async APIs only.** A service worker must never block. Synchronous APIs, such as `localStorage` and synchronous `XMLHttpRequest`, are not available. Use asynchronous ones: `fetch()`, the Cache Storage API, and IndexedDB. They all return promises or fire events.

## Service worker and Web Worker

You may know the regular `Web Worker`. A page creates it with `new Worker('worker.js')` to move heavy work off the main thread. Both kinds of worker run on a separate thread and have no DOM. The rest is different:

| Property | Web Worker | Service worker |
| --- | --- | --- |
| Main purpose | Heavy computation off the main thread | Proxy between pages and the network |
| Created by | `new Worker()` in a page | Registration with the browser |
| Serves | The page that created it | All pages in its scope |
| Lifetime | Lives as long as its page | Started and stopped by the browser |
| Runs without an open page | No | Yes, for events such as `push` |
| Intercepts network requests | No | Yes, through the `fetch` event |
| Requires a secure context | No | Yes |

In short, a Web Worker helps one page compute. A service worker serves the whole app and can work when no page is open.

## Check that your browser is ready

Start Daily Quote from its folder with `npx http-server -c-1` and open `http://localhost:8080` in Chrome. Open the DevTools console with Option-Command-J and run:

```js
window.isSecureContext;
'serviceWorker' in navigator;
```

Both lines return `true`. The first confirms that `localhost` counts as a secure context. The second confirms that the page can register a service worker. In an insecure context, `navigator.serviceWorker` does not exist, so the second line returns `false`.

## Official resources

- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)
- [web.dev: Service workers](https://web.dev/learn/pwa/service-workers)
- [Service Workers specification](https://www.w3.org/TR/service-workers/)
