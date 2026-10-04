---
slug: pwa/service-worker-lifecycle-and-updates
title: Lifecycle and Updates
description: Follow a service worker from install to activation, learn why a new version waits, and show a reload prompt when an update is ready.
tags:
  - pwa
  - service-workers
  - javascript
  - updates
---

Daily Quote now registers `/sw.js`, and the worker controls every page in its scope. Sooner or later you will change that file. The browser does not swap the old worker for the new one right away. Each version goes through a fixed sequence of states, and a new version often stops and waits. This lesson explains that sequence and shows how to tell the user that an update is ready.

## The states of a worker

The `lifecycle` is the sequence of states that every version of a service worker goes through. You can read the current state from the `state` property of a `ServiceWorker` object:

1. `installing`: the browser has downloaded the script and fired the `install` event.
2. `installed`: installation succeeded, and the worker is now the `waiting` worker. It stays here while an older version still controls pages.
3. `activating`: the worker is taking over and has received the `activate` event.
4. `activated`: the worker is the `active` worker. It now handles events such as `fetch` and `push`.
5. `redundant`: the worker is out of use. Either its installation failed, or a newer version replaced it.

A registration keeps up to three workers at once, one in each slot: `registration.installing`, `registration.waiting`, and `registration.active`. On the first visit, a worker moves through all the states without a stop. On later updates, it usually stops at `installed`.

## The `install` and `activate` events

The browser fires `install` once for each new version of the worker. It is the place to prepare everything the new version needs. The browser fires `activate` once, when that version takes over. It is the place to clean up after the old version.

Update `sw.js` so that every version logs its name:

```js
// sw.js
const VERSION = 'v1';

self.addEventListener('install', (event) => {
  console.log(`${VERSION}: install`);
  event.waitUntil(prepare());
});

self.addEventListener('activate', (event) => {
  console.log(`${VERSION}: activate`);
});

async function prepare() {
  // Lesson 9 saves the app files to the cache here.
}
```

`event.waitUntil()` takes a promise and keeps the current step open until the promise settles. The browser may stop an idle worker at any time, so it is the only reliable way to finish async work inside these events:

- In `install`, the worker stays in `installing` until the promise resolves. If the promise rejects, the installation fails. The new worker becomes `redundant`, and the old worker keeps working as before.
- In `activate`, the browser holds `fetch` and other events until the promise resolves. So the new worker handles no requests before its cleanup is done.

Lesson 9 uses both events to fill a cache and to delete old caches. Here they only log.

## Why a new version waits

Make an update and watch it. Open `http://localhost:8080` in Chrome with the console open. You see `v1: install` and `v1: activate`. Now change the first line of `sw.js` to `const VERSION = 'v2';` and reload the page.

The console shows `v2: install`, but no `v2: activate`. Version 2 is installed and waiting. Version 1 still controls the page.

A reload is not enough to replace the worker. During a reload, the old page stays on screen until the response for the new page arrives. So there is always at least one controlled page, and the old worker stays in charge. The new worker waits until no tab or installed app window in its scope uses the old one. Close every Daily Quote tab, open the app again, and you see `v2: activate`.

This rule protects the app. Only one version controls the pages at any time. A page that the old worker loaded never gets responses from a new worker that may work differently. For example, the new worker may delete the cache that the old page still uses.

## Skip the wait: `skipWaiting()` and `clients.claim()`

Two methods break this rule on purpose:

```js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

`self.skipWaiting()` tells a waiting or installing worker to activate as soon as its installation ends. It does not wait for the old tabs to close. The old worker becomes `redundant`.

`clients.claim()` lets the active worker take control of open pages in its scope that it does not control yet. Without it, the page that registers the worker on the first visit stays uncontrolled until its next load.

Both methods have a cost. After `skipWaiting()`, pages that the old version loaded get responses from the new version. If the versions are not compatible, for example the old page asks for a file that the new worker no longer has, the page can break. `clients.claim()` has the same risk on a smaller scale: a page that loaded from the network starts to depend on the worker in the middle of its life.

So use `skipWaiting()` without a condition only when every version works with pages from any other version. Otherwise, let the user decide when to switch. The prompt at the end of this lesson does exactly that.

## How the browser finds an update

The browser checks for a new version of the worker in these cases:

- The user navigates to a page in the worker's scope.
- An event such as `push` starts the worker, and there was no check in the last 24 hours.
- The page calls `register()` with a different script URL. Avoid this; keep the URL stable.
- Your code calls `registration.update()`.

On each check, the browser downloads `sw.js` and compares it byte by byte with the installed version. It also compares the scripts that the worker loads with `importScripts()`. If nothing differs, nothing happens. A change to `quotes.json` or `style.css` alone does not create a new version. That is why the `VERSION` constant is useful: change it, and the worker file changes.

A tab can stay open for days without a single navigation. To check in such a tab too, call `registration.update()` on a timer:

```js
setInterval(() => registration.update(), 60 * 60 * 1000);
```

By default, these checks skip the HTTP cache for `sw.js`. The `updateViaCache` option of `register()` controls this behavior:

- `'imports'`, the default: `sw.js` always comes from the network, and scripts loaded with `importScripts()` may come from the HTTP cache.
- `'none'`: the HTTP cache is not used for either.
- `'all'`: the HTTP cache is used for both.

```js
navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
```

The default is right for Daily Quote, which imports no scripts. With `http-server -c-1`, nothing is cached anyway.

## Show a "new version available" prompt

The page can watch the lifecycle through three events:

- `updatefound` fires on the registration when a new worker starts to install. The new worker is in `registration.installing`.
- `statechange` fires on a `ServiceWorker` object each time its `state` changes.
- `controllerchange` fires on `navigator.serviceWorker` when a different worker starts to control the page.

With them, you can build the usual flow. When a new version reaches `installed`, the page shows a message. When the user clicks Reload, the page asks the waiting worker to call `skipWaiting()`. When the new worker takes control, the page reloads.

Start with the worker. Replace `sw.js` with this version. It calls `skipWaiting()` only when a page sends the `skip-waiting` message:

```js
// sw.js
const VERSION = 'v3';

self.addEventListener('install', (event) => {
  console.log(`${VERSION}: install`);
  event.waitUntil(prepare());
});

self.addEventListener('activate', (event) => {
  console.log(`${VERSION}: activate`);
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') {
    self.skipWaiting();
  }
});

async function prepare() {
  // Lesson 9 saves the app files to the cache here.
}
```

Add a hidden banner to `index.html`, just before the `<script>` tag that loads `app.js`:

```html
<div id="update-banner" hidden>
  A new version is available.
  <button id="update-button" type="button">Reload</button>
</div>
```

In `app.js`, replace the registration code with this:

```js
// app.js
const updateBanner = document.querySelector('#update-banner');
const updateButton = document.querySelector('#update-button');

function showUpdatePrompt(worker) {
  updateBanner.hidden = false;
  updateButton.onclick = () => worker.postMessage('skip-waiting');
}

function watchInstallingWorker(worker) {
  worker.addEventListener('statechange', () => {
    // "installed" while an old worker controls the page means "waiting".
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      showUpdatePrompt(worker);
    }
  });
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js');

  // The check may have started before this code ran.
  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdatePrompt(registration.waiting);
  }
  if (registration.installing) {
    watchInstallingWorker(registration.installing);
  }
  registration.addEventListener('updatefound', () => {
    watchInstallingWorker(registration.installing);
  });

  // On the first visit, clients.claim() also changes the controller.
  // Reload only when a new version replaces an old one.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
}

if ('serviceWorker' in navigator) {
  registerServiceWorker();
}
```

The code covers three cases. A new version may be waiting already, from a check that ran during an earlier visit. It may be installing at the moment the page starts, because the navigation itself started the check. Or it may appear later, through `updatefound`. The `navigator.serviceWorker.controller` check tells an update from the first install. On the first visit, there is no old worker, so there is nothing to wait for.

The `reloading` flag prevents a second reload. The `hadController` check matters because of `clients.claim()`. On the first visit, it also fires `controllerchange`, and a reload there would be useless.

Try it. Reload the page. Your new `sw.js` is itself an update, so `v3` installs and waits, and the banner appears. Click Reload: the console shows `v3: activate`, and the page reloads under the new worker. Change `VERSION` to `'v4'` and reload to see the flow again. Other open tabs of the app get `controllerchange` too and reload with it.

## Official resources

- [web.dev: The service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [MDN: ServiceWorker.state](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state)
- [MDN: ServiceWorkerGlobalScope.skipWaiting()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)
- [MDN: Clients.claim()](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim)
- [MDN: ServiceWorkerRegistration.updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache)
- [Chrome for Developers: Fresher service workers, by default](https://developer.chrome.com/blog/fresher-sw)
