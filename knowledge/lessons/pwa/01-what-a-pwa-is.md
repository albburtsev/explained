---
slug: pwa/what-a-pwa-is
title: What a PWA Is
description: Learn the three parts of a PWA, what it adds to a website, how Chrome and Safari install it on macOS, and set up the Daily Quote project for the course.
tags:
  - pwa
  - browser
  - secure-context
  - macos
---

A `Progressive Web App` (PWA) is a website that can also act like an installed app. It uses the same HTML, CSS, and JavaScript as any other site. It still has a URL, and it still runs in a browser engine. What changes is how it starts, where it lives on the computer, and what it can do without a network.

The word "progressive" matters. Each PWA feature is an extra layer on top of a working site. A browser that supports the feature uses it. A browser without it still shows the normal website.

## What a PWA adds to a website

A plain website lives in a browser tab. A PWA can also:

- Have its own icon in the Dock and appear in Spotlight search.
- Open in its own window, without the browser's address bar and tabs.
- Start and show content when the network is slow or missing.
- Show push notifications and a badge on its icon.

The app stays on the web. You publish a new version by deploying files to your server, just as you do with a website. There is no app store review, and one code base serves every platform.

## The three parts

A PWA rests on three parts:

| Part | What it does | Where this course covers it |
| --- | --- | --- |
| Secure context | Lets the browser trust the page enough to enable powerful APIs | This lesson |
| Web app manifest | Tells the operating system how to install and launch the app | Lessons 2–3 |
| Service worker | Sits between the page and the network and answers requests | Lessons 4–12 |

A `secure context` is a page that the browser received safely. In practice, this means a page served over HTTPS. Pages from the local machine also count: `http://localhost`, `http://127.0.0.1`, and any `*.localhost` host. Service workers, push notifications, and many other APIs work only in a secure context. A page can check its own status with `window.isSecureContext`.

A `web app manifest` is a small JSON file that the page links with `<link rel="manifest">`. It holds the app's name, icons, start URL, and display mode, such as a separate window. Browsers read it when they install the app.

A `service worker` is a JavaScript file that the browser runs apart from your pages. It can catch every request a page makes and decide how to answer it: from the network, from a cache, or with a fallback page. This is how a PWA works offline, controls updates, and receives push messages.

None of these parts is a separate technology to install. They are standard web platform features, and you add them to a site one at a time.

## PWAs on macOS

On macOS, you can install a PWA from Chrome and from Safari.

In Chrome and other Chromium browsers, such as Edge, a site with a suitable manifest shows an install button in the address bar. You can also choose **Cast, save, and share** → **Install page as app…** in the Chrome menu. This menu item works for any page. The manifest is what makes Chrome offer the install by itself, and it controls the app's name and icons.

In Safari 17 and later on macOS Sonoma 14 and later, you choose **File** → **Add to Dock**. This works for any website, with or without a manifest. Safari does not offer the install by itself; the user starts it. When a manifest is present, Safari uses it to set up the app. The installed app opens in its own window, gets a copy of Safari's cookies, and keeps the rest of its storage apart from Safari. It supports service workers, push notifications, and badges.

Firefox on macOS does not install web apps. There, a PWA works as a normal website.

Lesson 3 walks through installing the course project in both browsers.

## Create the learning project

In this course, you build one small app named **Daily Quote**. It loads a list of quotes and shows a random one. You write it in plain JavaScript, without a framework or a build step. Each lesson adds to it until it is an installable app that works offline and sends push notifications.

Create a folder named `daily-quote` with five files:

```text
daily-quote/
├── index.html
├── about.html
├── style.css
├── app.js
└── quotes.json
```

`index.html` is the main page:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily Quote</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <h1>Daily Quote</h1>
    <nav><a href="/">Home</a> · <a href="/about.html">About</a></nav>
  </header>
  <main>
    <blockquote id="quote">Loading…</blockquote>
    <p id="author"></p>
    <button id="next" type="button" disabled>Another quote</button>
  </main>
  <script src="/app.js"></script>
</body>
</html>
```

`about.html` is a second page. Later lessons use it to show how a service worker handles more than one page:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>About · Daily Quote</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <h1>Daily Quote</h1>
    <nav><a href="/">Home</a> · <a href="/about.html">About</a></nav>
  </header>
  <main>
    <p>Daily Quote shows a random quote about programming.</p>
    <p>It is the learning project of the PWA course.</p>
  </main>
</body>
</html>
```

`style.css` keeps the layout simple:

```css
body {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  max-width: 40rem;
  margin: 0 auto;
  padding: 1rem;
}

blockquote {
  font-size: 1.5rem;
  margin: 2rem 0 0.5rem;
}

#author {
  color: #555;
}
```

`quotes.json` holds the data:

```json
[
  {
    "text": "Simplicity is prerequisite for reliability.",
    "author": "Edsger W. Dijkstra"
  },
  {
    "text": "Premature optimization is the root of all evil.",
    "author": "Donald Knuth"
  },
  {
    "text": "The best way to predict the future is to invent it.",
    "author": "Alan Kay"
  }
]
```

`app.js` fetches the quotes and shows one. The button picks another quote and stays disabled until the data arrives:

```js
const quoteElement = document.querySelector('#quote');
const authorElement = document.querySelector('#author');
const nextButton = document.querySelector('#next');

let quotes = [];

function showRandomQuote() {
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  quoteElement.textContent = quote.text;
  authorElement.textContent = `— ${quote.author}`;
}

async function loadQuotes() {
  try {
    const response = await fetch('/quotes.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    quotes = await response.json();
    showRandomQuote();
    nextButton.disabled = false;
  } catch (error) {
    quoteElement.textContent = 'Could not load quotes.';
    console.error(error);
  }
}

nextButton.addEventListener('click', showRandomQuote);
loadQuotes();
```

The pages use paths that start with `/`, such as `/app.js`. They always point to the root of the site, so they work the same from every page.

## Run the project

You need Node.js v20+ to run a local web server. From the `daily-quote` folder, start it:

```sh
npx http-server -c-1
```

The first time, `npx` asks to download the `http-server` package; confirm it. The server then lists the addresses it listens on. The default port is `8080`. The `-c-1` flag turns off HTTP caching, so the browser always gets your latest files. This matters later: the only cache you want to think about is the one your service worker controls.

Open `http://localhost:8080` in Chrome. You should see a quote. Click **Another quote** to change it, and open **About** to check the second page.

Now confirm that the page is a secure context. Open Chrome DevTools with `Cmd-Option-I`, select the **Console** panel, and run:

```js
window.isSecureContext
```

The result is `true`, because the page comes from `localhost`. Keep two traps in mind:

- The server also prints an address of your local network, such as `http://192.168.1.20:8080`. That address is plain HTTP on a non-local host, so it is not a secure context, and service workers do not work there.
- Do not open `index.html` by double-clicking it. The page then loads from a `file://` URL. Chrome blocks `fetch()` for local files, and service workers work only over HTTP and HTTPS.

Press `Ctrl-C` in the terminal to stop the server when you finish.

Daily Quote is not a PWA yet. It runs in a secure context, but it has no manifest and no service worker. The next lesson adds the manifest.
