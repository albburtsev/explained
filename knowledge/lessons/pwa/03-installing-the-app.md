---
slug: pwa/installing-the-app
title: Installing the App
description: Check Chrome's install criteria, install Daily Quote from Chrome and Safari on macOS, add a custom install button, detect standalone mode, and uninstall the app.
tags:
  - pwa
  - installation
  - web-app-manifest
  - javascript
  - browser
---

An installed PWA opens in its own window, without tabs or an address bar. It gets its own icon, so you can launch it like any other Mac app. In this lesson, you install Daily Quote in Chrome and Safari, add your own install button, and make the app aware of how it was opened. You do not need a service worker yet.

Start the project from the `daily-quote/` folder and keep it running:

```bash
npx http-server -c-1
```

Open `http://localhost:8080` in Chrome.

## Check Chrome's install criteria

Chrome and other Chromium browsers decide whether a site is installable. A site that passes the `install criteria` gets an install button in the address bar, and its pages can receive the `beforeinstallprompt` event. The criteria are:

- The page is served over HTTPS or from `localhost`.
- The page links a manifest that has `name` or `short_name`.
- The manifest lists a 192-pixel icon and a 512-pixel icon.
- The manifest has a `start_url`.
- `display` is `fullscreen`, `standalone`, `minimal-ui`, or `window-controls-overlay`.
- `prefer_related_applications` is missing or `false`.
- The app is not already installed.

The manifest from the previous lesson meets all of them. Older guides also say that a service worker with a `fetch` handler is required. Chrome dropped that rule for desktop in version 112, so Daily Quote is installable now.

Chrome also uses an `engagement heuristic`. It may wait until the user has clicked the page at least once and has spent about 30 seconds on it. If nothing appears right after the page loads, click the page and wait a little.

## Install from the address bar

When the page is installable, Chrome shows an install button at the right end of the address bar. Click it, then confirm with **Install**. Chrome opens Daily Quote in a new window, without tabs or an address bar.

If you do not see the button, open the Chrome menu (**⋮**) and choose **Cast, save, and share** → **Install page as app…**. This menu item works for any page, so it does not prove that your manifest is correct. The address bar button does.

The installed app is a normal Mac app. Quit it, then find it with Spotlight by its `name` and open it again. It starts at `start_url`, not at the page where you installed it.

## Add a custom install button

The address bar button is easy to miss. An app can offer its own button instead. Chromium browsers fire `beforeinstallprompt` on `window` when the page becomes installable. The event lets you show Chrome's install dialog later, from your own button.

This event is not part of any standard, and only Chromium browsers support it. Treat the button as an extra: hide it by default and show it only when the event arrives.

Add the button to `index.html`, inside `<body>`:

```html
<button id="install-button" type="button" hidden>Install app</button>
```

Then add this code to the end of `app.js`:

```js
const installButton = document.querySelector('#install-button');
let installPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    return;
  }
  const { outcome } = await installPrompt.prompt();
  console.log(`Install prompt: ${outcome}`);
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
  console.log('Daily Quote was installed');
});
```

Here is what each part does:

- `event.preventDefault()` stops Chrome from showing its own install suggestion, so your button can take its place.
- `installPrompt` keeps the event. You can call its `prompt()` method only once, and only in response to a user action such as a click.
- `prompt()` shows the install dialog. Its promise resolves to an object whose `outcome` is `accepted` or `dismissed`.
- `appinstalled` fires after any successful install, including one from the address bar.

The event does not fire while the app is installed. To test the button, uninstall Daily Quote first (see the last section), reload the page in a Chrome tab, click the page, and wait for the button to appear.

## Add the app to the Dock in Safari

Safari on macOS Sonoma and later can turn any website into a web app. It does not use Chrome's install criteria and does not fire `beforeinstallprompt`, so your custom button stays hidden there.

1. Open `http://localhost:8080` in Safari.
2. Choose **File** → **Add to Dock**.
3. Keep or change the name, then click **Add**.

The app appears in the Dock and opens in its own window. Safari reads your manifest for details such as the name, start URL, and display mode. It copies the site's cookies into the new app once. After that, the app and Safari keep their website data separate.

## Detect standalone mode

The page cannot see the install itself, but it can learn how it was opened. The `display-mode` media feature matches the mode the page is running in. In a normal tab, it is `browser`. In an app window opened with `"display": "standalone"`, it is `standalone`.

An installed app should not offer to install itself. Add this rule to `style.css` to hide the button in the app window:

```css
@media (display-mode: standalone) {
  #install-button {
    display: none;
  }
}
```

In JavaScript, `window.matchMedia()` runs the same query. Add this code to `app.js`:

```js
const standaloneQuery = window.matchMedia('(display-mode: standalone)');

function logDisplayMode() {
  const mode = standaloneQuery.matches ? 'standalone' : 'browser';
  console.log(`Display mode: ${mode}`);
}

logDisplayMode();
standaloneQuery.addEventListener('change', logDisplayMode);
```

The `change` listener runs when the mode changes while the page is open. Chrome, for example, can move an open tab into the app window after the install. Use the JavaScript check when your code needs the mode, such as for analytics. Use the CSS check when only the layout changes.

Query the value that your manifest sets. If you use `minimal-ui` instead of `standalone`, match `(display-mode: minimal-ui)`. Test the result in each browser you support, because support for this feature in Safari web apps has varied between versions.

## Uninstall the app

Uninstalling removes the app, but your project files stay as they are. Uninstall when you want to test the install flow again.

In Chrome:

1. Open Daily Quote in its app window.
2. Open the app menu (**⋮**) in the window's title bar.
3. Choose **Uninstall Daily Quote…**, then click **Remove**. Select **Also delete data from Chrome** if you want a clean start.

You can also open `chrome://apps` in a tab, right-click the app, and remove it there.

In Safari, removing the icon from the Dock does not delete the app. Safari saves web apps in the `Applications` folder inside your home folder. In Finder, choose **Go** → **Home**, open `Applications`, and drag Daily Quote to the Trash.

## Official resources

- [Making PWAs installable on MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [What does it take to be installable? on web.dev](https://web.dev/articles/install-criteria)
- [Revisiting Chrome's installability criteria](https://developer.chrome.com/blog/update-install-criteria)
- [`beforeinstallprompt` event on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)
- [`display-mode` media feature on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode)
- [Use Safari web apps on Mac](https://support.apple.com/en-us/104996)
