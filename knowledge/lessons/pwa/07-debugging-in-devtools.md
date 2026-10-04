---
slug: pwa/debugging-in-devtools
title: Debugging in DevTools
description: Inspect the manifest and the service worker in the Chrome DevTools Application panel, control updates, debug the worker's code, and reset the app to a clean state.
tags:
  - pwa
  - service-workers
  - chrome-devtools
  - debugging
---

A service worker is hard to see. It runs in the background, it can outlive the page, and an old version can stay in control after you change the code. Chrome DevTools shows you what the browser actually installed and lets you control it. In this lesson you inspect the Daily Quote app with the tools you will use in every lesson that follows.

## Open the Application panel

Start the app from the `daily-quote/` folder:

```sh
npx http-server -c-1
```

Open `http://localhost:8080` in Chrome and press `Cmd+Option+I` to open DevTools. Choose the **Application** panel. If you do not see it, click the `>>` button in the panel tab bar.

The left sidebar of the `Application panel` groups everything the browser stores for this origin. A PWA needs three items most of all: **Manifest**, **Service workers**, and **Storage**.

## Check the manifest

Select **Manifest**. DevTools reads the file linked from your page and shows its fields in sections:

- **Identity** shows the app name, the short name, and the description.
- **Presentation** shows the start URL, the display mode, and the theme and background colors.
- **Icons** shows every icon that Chrome loaded. The **Show only the minimum safe area for maskable icons** checkbox crops each icon to the area that is always visible.

If something is wrong, an **Installability** section appears and explains the error. Try it now. In `manifest.webmanifest`, change `icons/icon-192.png` to a path that does not exist, then reload the page. The icon is missing in **Icons**, and the error tells you what failed. Put the correct path back and reload again.

Check this pane first when Chrome does not offer to install the app. It shows what Chrome found in the manifest, which is not always what you think you wrote.

## Read the service worker status

Select **Service workers**. Each registration for this origin appears as one entry:

- **Source** links to `sw.js` and shows when the browser received this version.
- **Status** shows the version number and the state, such as `activated and is running`.
- **Clients** lists the open pages that this worker controls.

Next to the status there is a **stop** link, or a **start** link when the worker is stopped. Click **stop**. The browser ends the worker, and the page keeps working. The browser starts the worker again when it needs it, for example for the next request it must handle. So never keep important data in global variables inside `sw.js`: they disappear when the worker stops.

## Control the lifecycle while you develop

The pane gives you direct control over the lifecycle from the previous lesson.

Change the `VERSION` constant in `sw.js` to a new value and reload the page. Chrome installs the new version. Your worker calls `self.skipWaiting()` only after the user clicks Reload in the update banner. Until then, the new worker shows the status `waiting to activate`, while the old one still controls the page. Instead of the banner, you can click the **skipWaiting** link next to the waiting worker to activate it at once.

Use the other controls for these jobs:

- **Update** asks the browser to check the server for a new `sw.js` right now.
- **Unregister** removes the registration. The page stays open, and the next load registers the worker again from `app.js`.
- **Update on reload** installs the worker again on every page load, even when `sw.js` did not change, and skips the waiting phase. Turn it on while you write the worker. Turn it off when you want to test real update behavior.
- **Bypass for network** sends every request straight to the network and ignores the worker's `fetch` handler. The page still counts as controlled. Use it when cached files hide your latest changes.
- **Offline** cuts the network for this page and its worker.

Check **Offline** and reload the page. You see Chrome's offline error, because the worker does not answer requests yet. Over the next lessons you will change that. Uncheck **Offline** when you finish.

## See the worker's console and set breakpoints

A service worker has its own global scope, separate from the page. Its `console.log()` messages still appear in the **Console** panel, with `sw.js` as the source on the right.

To run code inside the worker, open the context menu at the top of the Console. It shows `top` by default. Choose the entry for `sw.js`. Expressions now run in the worker's scope:

```js
self.registration.scope
```

The result is `'http://localhost:8080/'`, the default scope of a worker at `/sw.js`.

To pause the worker, open `sw.js` in the **Sources** panel with `Cmd+P` and click a line number to set a `breakpoint`. You can also put a `debugger` statement in the code:

```js
self.addEventListener('install', (event) => {
  debugger;
  console.log(`${VERSION}: install`);
  event.waitUntil(prepare());
});
```

Save the file and reload the page. The change creates a new version, so the browser installs it. With DevTools open, the worker pauses on that line during `install`. You can then read variables and step through the handler. Remove the statement when you finish.

Some workers run with no page open, for example when a push message arrives. For those cases, Chrome has two internal pages:

- `chrome://inspect/#service-workers` lists running workers. Its **inspect** link opens a separate DevTools window for one worker.
- `chrome://serviceworker-internals` lists every registration in the browser, with its state and logs. The **See all registrations** link at the bottom of the **Service workers** pane leads to the same information.

## Spot service worker responses in the Network panel

Open the **Network** panel and reload the page. Each row is one request.

When the worker answers a request itself, the **Size** column shows `(ServiceWorker)` instead of a byte count. Requests that the worker sends on its own, for example to fill a cache, show a gear icon before the name. Select a request and open the **Timing** tab to see how long the worker took to start and to answer.

Right now every row shows a normal size, because `sw.js` has no `fetch` handler yet. You will see `(ServiceWorker)` in the next lessons.

## Start again with Clear site data

Sometimes you want to see the app as a first-time visitor sees it. Select **Storage** in the sidebar and click **Clear site data**. The checkboxes below the button list what DevTools removes. By default they include service worker registrations and **Cache storage**, the caches that a worker creates.

Reload the page after you clear the data. The browser registers and installs the worker from scratch.

The sidebar also has a **Cache storage** item that shows each cache and the responses inside it. You will use it in the lesson about the Cache Storage API.

For the full list of tools, see [Debug Progressive Web Apps](https://developer.chrome.com/docs/devtools/progressive-web-apps) in the Chrome DevTools documentation.
