---
slug: pwa/service-worker-registration-and-scope
title: Registration and Scope
description: Register the service worker from app.js after the page loads, learn which pages its scope covers, and see why the first visit is not controlled yet.
tags:
  - pwa
  - service-workers
  - javascript
---

In the previous lesson you created `sw.js` in the root of `daily-quote/`. The browser does nothing with that file yet. A page must ask the browser to install it. This step is called `registration`. In this lesson you register the worker, find out which pages it controls, and see why the first visit behaves differently.

## Register the worker from `app.js`

Add this code to the end of `app.js`:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered. Scope:', registration.scope);
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  });
}
```

The first line is `feature detection`. `navigator.serviceWorker` exists only in browsers that support service workers, and only in a secure context. When it is missing, the app still works as a normal website. This is the "progressive" part of a PWA.

`navigator.serviceWorker.register()` takes the URL of the worker script. The browser downloads the script and starts installing it in the background. The call returns a promise, so the code waits for it with `await`.

Registration can fail. The script may return a `404`, contain a syntax error, or come from a different origin. The page may also not be a secure context. In each case the promise rejects, and the `catch` block logs the reason.

## Register after the page loads

The `load` event fires after the page and its images, styles, and scripts have loaded. On the first visit, a new worker downloads its script and often fills a cache during installation. That work competes with the page for network and CPU. Waiting for `load` lets the page appear first.

The delay costs nothing on later visits. The browser remembers the registration. When you open the app again, the worker starts before the page request is sent, so the `register()` call only confirms what already exists.

## Read the registration

The promise resolves with a `ServiceWorkerRegistration` object. It links one worker script to one scope on your origin. A few properties are useful now:

- `registration.scope` is the absolute URL of the scope, for example `http://localhost:8080/`.
- `registration.active` is the worker that is currently running, or `null` while it is still installing.
- `registration.installing` and `registration.waiting` hold a worker that is on its way to becoming active. The next lesson explains these states.

Calling `register()` again with the same script and scope does not create a second registration. If nothing has changed, it returns the existing one. That is why you can call it on every page load.

## Scope: which pages the worker controls

The `scope` of a registration is a URL prefix. A worker controls only the pages whose URL starts with that prefix. These pages are called its clients.

By default, the scope is the directory that contains the script. For `/sw.js`, that directory is `/`, so the worker can control every page on `http://localhost:8080`:

| Script URL | Default scope | Controls `/index.html`? | Controls `/about.html`? |
| --- | --- | --- | --- |
| `/sw.js` | `/` | Yes | Yes |
| `/js/sw.js` | `/js/` | No | No |

Scope decides which pages the worker controls. It does not limit what the worker can fetch. A controlled page can load `style.css`, `quotes.json`, or a file from another site, and the worker sees all of those requests. Lesson 8 shows how to intercept them.

## Change the scope with the `scope` option

The second argument of `register()` accepts a `scope` option. Use it to make the scope narrower than the default:

```js
navigator.serviceWorker.register('/sw.js', { scope: '/quotes/' });
```

This worker controls `/quotes/` and every page below it, but not `/index.html` or `/about.html`. Daily Quote does not need this, because the whole app should work offline.

Matching is a plain string prefix, so end a directory scope with `/`. A scope of `/quotes` would also match `/quotes.json` and `/quotes-archive.html`. When several registrations match a page, the one with the longest scope controls it.

You cannot make the scope wider than the script's directory by default. This call fails with a `SecurityError`:

```js
navigator.serviceWorker.register('/js/sw.js', { scope: '/' });
```

The server can allow it with the `Service-Worker-Allowed` response header on the script. The header sets the widest scope the script may use:

```http
Service-Worker-Allowed: /
```

You do not need this header in this course. It exists for cases where you cannot place the script where you want it.

## Why `sw.js` lives at the root

Keeping `sw.js` in the project root is the simplest way to cover the whole app:

- The default scope becomes `/`, so the worker controls `index.html`, `about.html`, and every page added later.
- You do not need the `scope` option or the `Service-Worker-Allowed` header. A simple static server such as `http-server` does not need any extra configuration.

Put the worker script in the root even when other scripts live in a folder such as `js/`. The script must also come from your own origin. You cannot register a worker from a CDN.

## Check which worker controls the page

`navigator.serviceWorker.controller` is the worker that controls the current page. It is `null` when no worker controls the page. Add one more line to the end of `app.js`, outside the `load` listener:

```js
console.log('Controlled by:', navigator.serviceWorker?.controller?.scriptURL ?? null);
```

The `?.` operators keep this line safe in a browser without service worker support.

Now try it:

1. Start the server from `daily-quote/` with `npx http-server -c-1`.
2. Open a new Incognito window in Chrome with `Cmd+Shift+N`, so no earlier registration exists. Go to `http://localhost:8080`.
3. Open the Console with `Cmd+Option+J`. You see `Controlled by: null` and then `Service worker registered. Scope: http://localhost:8080/`.
4. Reload the page with `Cmd+R`. Now you see `Controlled by: http://localhost:8080/sw.js`.
5. Open `http://localhost:8080/about.html`. It is controlled too, because it is inside the scope `/`.
6. Reload with `Cmd+Shift+R`. A hard reload skips the service worker, so the page shows `Controlled by: null` again.

## Why the first visit is not controlled

The browser chooses a controller once, when it starts loading a page. On the first visit there is no registration yet, so the page starts without a worker. It stays uncontrolled for its whole life, even after the worker becomes active a moment later.

This rule keeps a page consistent. A page that loaded from the network does not suddenly start getting responses from a worker halfway through. The next navigation inside the scope, such as a reload or a link to `about.html`, gets the active worker as its controller.

A worker can take control of already open pages with `clients.claim()`. That method belongs to the worker's lifecycle, which is the topic of the next lesson.

## Official resources

- [ServiceWorkerContainer: register() method on MDN](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- [ServiceWorkerContainer: controller property on MDN](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controller)
- [Service-Worker-Allowed header on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Service-Worker-Allowed)
- [Service worker registration on web.dev](https://web.dev/articles/service-workers-registration)
