---
slug: pwa/intercepting-requests
title: Intercepting Requests
description: Handle the fetch event in a service worker, read the request, answer it with respondWith(), and leave cross-origin and non-GET requests to the browser.
tags:
  - pwa
  - service-workers
  - javascript
  - fetch
---

A service worker sits between the page and the network. So far, Daily Quote's `sw.js` only installs and activates. In this lesson, it starts to see every request that the page makes and decides how to answer some of them. There is no cache yet: the service worker only reads, passes on, or builds responses. The next lesson adds the Cache Storage API.

## The `fetch` event

When a page controlled by the service worker requests something, the browser fires a `fetch` event in the service worker. This includes the page itself, its CSS and scripts, its images, and every `fetch()` call from `app.js`. Navigating to another page inside the scope, such as `about.html`, fires the event too.

Add a listener at the end of `sw.js`, below the `install` and `activate` handlers:

```js
self.addEventListener('fetch', (event) => {
  console.log(event.request.method, event.request.url);
});
```

Reload the page. If the change does not appear, check that **Update on reload** is on in the **Application** panel, as in the previous lesson. The DevTools **Console** now shows one line for each request. The handler only logs, so every request still goes to the network as usual.

## Read the request

`event.request` is a `Request` object. Four of its properties tell you most of what you need:

- `url` is the full address, such as `http://localhost:8080/quotes.json`. Use `new URL(request.url)` to read its parts, such as `origin` and `pathname`.
- `method` is the HTTP method, such as `GET` or `POST`.
- `mode` tells you how the request was made. The value `navigate` means the browser is loading a whole page. Other values are `cors`, `no-cors`, and `same-origin`.
- `destination` tells you what the response is for: `document`, `style`, `script`, `image`, and so on. A `fetch()` call gives an empty string.

For Daily Quote, a first load gives values like these:

| Request | `mode` | `destination` |
| --- | --- | --- |
| `/` (the page) | `navigate` | `document` |
| `/style.css` | `no-cors` | `style` |
| `/quotes.json` (from `fetch()`) | `cors` | empty string |

## Answer with `respondWith()`

A `fetch` handler has three choices for each request.

**Do nothing.** If the handler returns without calling `event.respondWith()`, the browser handles the request as if there were no service worker. This is the right choice for most requests you do not want to change.

**Pass the request through.** `fetch(event.request)` sends the same request to the network and returns a promise of a `Response`. Give that promise to `respondWith()`:

```js
event.respondWith(fetch(event.request));
```

The result looks the same as doing nothing, but now the service worker owns the response. It can inspect it or change it before the page gets it. If the network fails, `fetch()` rejects, and the page gets a network error. Later lessons handle that case.

**Build a synthetic response.** A `Response` object can come from your own code instead of the network:

```js
event.respondWith(
  new Response('Hello from the service worker!', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
);
```

`respondWith()` accepts a `Response` or a promise that resolves to one. You must call it synchronously, during the event itself. If you call it after an `await` or inside a `then()` callback, it throws an error, because the browser has already moved on. Put any asynchronous work inside the promise that you pass to it.

## Leave cross-origin and non-GET requests alone

The page may also request files from other origins, such as a font service or an analytics script. It may also send `POST` requests that change data on a server. Usually the service worker should not touch either kind:

- Cross-origin responses are often `opaque`: their status, headers, and body are hidden from your code. You cannot check or change them safely.
- A non-GET request has side effects or a body. Repeating it or answering it with a stored response can cause bugs. The Cache Storage API in the next lesson also stores only `GET` responses.

So start the handler with a filter and simply return for everything else:

```js
const url = new URL(event.request.url);

if (url.origin !== self.location.origin || event.request.method !== 'GET') {
  return;
}
```

`self.location` is the address of `sw.js`, so `self.location.origin` is the app's own origin, `http://localhost:8080`.

## Navigation requests and subresources

A request with `mode` equal to `navigate` loads a whole HTML page. It happens when the user opens the app, types a URL inside the scope, follows a link to `about.html`, or reloads. Every other request is a `subresource`: a file or data that a page needs, such as CSS, a script, an image, or `quotes.json`.

```js
if (event.request.mode === 'navigate') {
  // A whole page: index.html, about.html, or any URL typed in the scope.
}
```

The two kinds often need different rules. For example, later in this course a failed navigation gets an offline page, while a failed image can simply stay missing.

## Try it: rewrite one response and invent a page

Replace the logging handler in `sw.js` with this version:

```js
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Let the browser handle cross-origin and non-GET requests.
  if (url.origin !== self.location.origin || request.method !== 'GET') {
    return;
  }

  console.log(request.mode, request.destination || '(none)', url.pathname);

  // A page that exists only in the service worker.
  if (request.mode === 'navigate' && url.pathname === '/hello-sw') {
    event.respondWith(
      new Response('Hello from the service worker!', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
    return;
  }

  // Pass quotes.json through, but add a header on the way.
  if (url.pathname === '/quotes.json') {
    event.respondWith(addHeader(request));
  }
});

async function addHeader(request) {
  const response = await fetch(request);
  const headers = new Headers(response.headers);
  headers.set('X-Served-By', 'daily-quote-sw');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

The handler now does all three things. It builds the `/hello-sw` page from nothing. It passes `quotes.json` through and changes its headers. It leaves every other request to the browser. The response headers of a fetched `Response` are read-only, so `addHeader()` copies them into a new `Headers` object and builds a new `Response` around the same body.

## Check the result

With the app running at `http://localhost:8080`:

1. Reload the page and open the **Console**. Each same-origin request logs its `mode`, `destination`, and path. Click the link to `about.html` and look for a `navigate document` line.
2. Open the **Network** panel, reload, and select `quotes.json`. Its response headers include `X-Served-By: daily-quote-sw`. A second `quotes.json` row with a gear icon is the request that the service worker sent to the network.
3. Open `http://localhost:8080/hello-sw`. The page shows `Hello from the service worker!`, although `http-server` has no such file.
4. In **Application** → **Service workers**, turn on **Bypass for network** and reload `/hello-sw`. Now the request goes to the server, which returns a 404 error. Turn the option off again.

## Official resources

- [MDN: `FetchEvent`](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent)
- [MDN: `FetchEvent.respondWith()`](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/respondWith)
- [MDN: `Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
- [MDN: `Response()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response)
- [Service Workers specification](https://w3c.github.io/ServiceWorker/)
