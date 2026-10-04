---
slug: pwa/web-app-manifest
title: Web App Manifest
description: Describe the Daily Quote app in manifest.webmanifest, add its icons, and link the manifest from every page.
tags:
  - pwa
  - web-app-manifest
  - browser
---

A `web app manifest` is a JSON file that describes your app to the browser and the operating system. It gives the app a name, icons, colors, a start page, and a window style. The browser reads it when it decides how to install and launch the app. The manifest changes nothing in the page itself; the page looks the same in a normal tab.

In this lesson, you add a manifest to the `daily-quote/` project. Installing the app comes in the next lesson.

## Make the icons

The app needs two square PNG icons: one of 192×192 pixels and one of 512×512 pixels. Chrome expects both sizes before it offers to install an app.

Take any square image, for example `logo.png`, and put it in the project folder. Then create the icons with `sips`, the image tool built into macOS:

```sh
mkdir icons
sips -s format png -z 192 192 logo.png --out icons/icon-192.png
sips -s format png -z 512 512 logo.png --out icons/icon-512.png
```

`-z` takes the height and then the width. `-s format png` saves the result as PNG, so a JPEG source works too. Start from an image that is at least 512 pixels wide, so the large icon stays sharp.

## Write the manifest

Create `manifest.webmanifest` in the project root, next to `index.html`:

```json
{
  "name": "Daily Quote",
  "short_name": "Quote",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#1e3a5f",
  "background_color": "#ffffff"
}
```

The file is plain JSON, so it allows no comments and no trailing commas. The `.webmanifest` extension is the one the specification suggests. A file named `manifest.json` also works.

## What each member does

- `name` is the full app name. The system shows it in the install prompt, in the app window title, and in lists of apps.
- `short_name` is a shorter name for places with little room, such as a label under an icon.
- `icons` lists the icon files. `src` is the path, `sizes` is the size in pixels, and `type` is the file format. The system picks the size that fits each place.
- `start_url` is the page that opens when the user launches the app. `/` is the site root, so the app opens `index.html`.
- `scope` sets which URLs belong to the app. Here it is `/`, the whole site, so `index.html` and `about.html` both belong to it. When the user follows a link outside the scope, the app window shows browser controls, so the user can see that they left the app.
- `display` sets the window style. `standalone` opens the app in its own window without the address bar. The other values are `fullscreen`, `minimal-ui`, and `browser`, which is the default and opens a normal tab. If the browser cannot use the value you chose, it falls back along the list `fullscreen` → `standalone` → `minimal-ui` → `browser`.
- `theme_color` is the color of the app's interface, such as the title bar of its window. A `<meta name="theme-color">` tag on a page overrides it for that page.
- `background_color` fills the app window while the page loads, before the CSS is ready. After that, the page's own CSS takes over. Use the same color as the page background, so the user sees no flash. `style.css` sets no background, so the page is white and the example uses `#ffffff`.

Relative URLs in the manifest, such as `icons/icon-192.png`, are resolved against the manifest's own URL, not the page's URL. The manifest sits in the project root, so the icon paths point into `icons/`.

The `start_url` must be inside the `scope`. If it is not, the browser ignores your `scope`. Without a valid `scope`, the browser uses the folder of `start_url`.

## Link the manifest from the page

A browser finds the manifest through a `<link>` element in the page's `<head>`. Add it to `index.html`, next to the stylesheet link:

```html
<link rel="manifest" href="/manifest.webmanifest">
```

Add the same line to `about.html`. Each page links to the manifest on its own. Without the link, the browser does not know that the page belongs to the app, and it cannot offer to install the app from that page.

## Check the result

Start the server from the `daily-quote/` folder:

```sh
npx http-server -c-1
```

Open `http://localhost:8080` in Chrome. Open DevTools with `Cmd+Option+I` and go to **Application** → **Manifest**. The panel shows the name, the start URL, the colors, and both icons. If a field is wrong or an icon fails to load, the panel shows a warning.

The panel may also suggest adding an `id` member. It is optional. Without it, the browser uses `start_url` as the app's identity.

Safari also reads the manifest. When you add a site to the Dock, it uses the name, the start URL, the display mode, and the theme color.

## Further reading

- [Web app manifests on MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
- [Add a web app manifest on web.dev](https://web.dev/articles/add-manifest)
