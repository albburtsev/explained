---
slug: pwa
title: PWA
catalogOrder: 110
description: Build a small installable web app that works offline, using a manifest, a service worker, caching strategies, and push notifications.
tags:
  - pwa
  - service-workers
  - javascript
  - browser
  - offline
lessons:
  - pwa/what-a-pwa-is
  - pwa/web-app-manifest
  - pwa/installing-the-app
  - pwa/what-a-service-worker-is
  - pwa/service-worker-registration-and-scope
  - pwa/service-worker-lifecycle-and-updates
  - pwa/debugging-in-devtools
  - pwa/intercepting-requests
  - pwa/cache-storage-api
  - pwa/caching-strategies
  - pwa/offline-mode
  - pwa/push-notifications
---

A `Progressive Web App` (PWA) is a website that can behave like an installed app. It opens in its own window, starts without a network, and can show notifications. It is still built with HTML, CSS, and JavaScript, and it still runs in the browser.

Two pieces turn a site into a PWA. A `web app manifest` tells the operating system how to install and launch the app. A `service worker` is a script that sits between the page and the network. It decides how every request is answered, so it controls caching, offline behavior, and updates. Most of this course is about the service worker, because it does most of the work.

You will build one small app in plain JavaScript, without a framework, and serve it from `localhost`. Start with what a PWA is, write its manifest, and install it in Chrome and Safari on macOS. Then add a service worker: register it, follow its lifecycle, and debug it in Chrome DevTools. Next, intercept requests, cache files, choose a caching strategy, and make the app work offline. Finish by sending push notifications.

## What you will learn

- What makes a website a PWA and what it gains on macOS.
- How to describe an app with a web app manifest and install it in Chrome and Safari.
- How a service worker is registered, controls pages within its scope, and moves through its lifecycle.
- How to inspect and debug a PWA in Chrome DevTools.
- How to intercept requests, store responses with the Cache Storage API, and choose a caching strategy.
- How to make the app work offline and show push notifications.

## Official resources

- [Progressive web apps on MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Service Worker API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Learn PWA on web.dev](https://web.dev/learn/pwa)
- [Web Application Manifest specification](https://www.w3.org/TR/appmanifest/)
