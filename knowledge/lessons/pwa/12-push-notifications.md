---
slug: pwa/push-notifications
title: Push Notifications
description: Subscribe Daily Quote to web push, show notifications from the service worker, and send test messages from Chrome DevTools and the web-push CLI.
tags:
  - pwa
  - push-notifications
  - service-workers
  - javascript
---

A push notification lets your app reach the user when no tab is open. A server sends a message, and the service worker wakes up and shows it. In this lesson, Daily Quote asks for permission, subscribes to push, and shows a notification for every message. Then you send test messages, first from Chrome DevTools and then from the command line.

## How web push works

`Web push` involves three parties:

1. **Your app server** decides that the user should get a message. It encrypts the message and sends it to an address called the endpoint.
2. **The browser's push service** receives the message. The browser vendor runs it: Chrome uses a Google service and Safari uses an Apple service. It keeps the message until the browser can take it.
3. **Your service worker** receives a `push` event and shows a notification.

The page itself takes part only once. It asks the browser for a `push subscription`: an object with the endpoint and the keys that encrypt messages for this browser. The page then gives the subscription to your server. In a real app, the page sends it to your server with `fetch()`. Building that server is outside this lesson, so you will copy the subscription by hand. That is fine for learning.

To prove that messages come from your server, you use a key pair called `VAPID keys`. The public key goes into the page. The private key stays on the server and signs every message. The push service accepts messages for a subscription only when they are signed with the matching private key.

## Allow notifications on macOS

Both Chrome and Safari on macOS support web push. macOS controls notifications for each app, including each browser. Open **System Settings** → **Notifications**, select **Google Chrome** or **Safari**, and turn on **Allow notifications**. If this setting is off, the web code works without errors, but no notification appears.

Chrome must be running to receive a push. It can have no open windows, but if you quit it, messages wait until it starts again. Safari on macOS hands push delivery to the system, so messages arrive even when Safari is not running.

## Generate VAPID keys

Run this command in the `daily-quote/` folder:

```sh
npx web-push generate-vapid-keys
```

`npx` downloads the `web-push` package and runs its command line tool. The output looks like this, with your own values:

```text
=======================================

Public Key:
BEiGt1IPxuF1RW8AuCUsK6SKCk2okh939HzffwJlg2rRt4OiG9O2MwKxUb0jWeogm_jUrxNqhRZ02EpqMcSCEBY

Private Key:
jrYU8Dhn_AYne38FpC_mVlGo4pKS8mCIxn2dHXF6q2I

=======================================
```

Save both keys in a note. You need the public key in the page and both keys to send a message. Never put the private key in a file that the browser loads.

## Ask for permission and subscribe

Browsers expect a permission prompt to follow a user action on the page. Safari and Firefox require a click or a key press first, and Chrome may show a quieter prompt to sites that ask too early. So never ask on page load. Ask when the user clicks a button that explains what they get.

Add the button to `index.html`, next to the quote:

```html
<button id="notify" type="button">Enable notifications</button>
```

Add this code to the end of `app.js`. Replace the placeholder with your public key:

```js
const VAPID_PUBLIC_KEY = 'PASTE_YOUR_PUBLIC_KEY_HERE';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function enableNotifications() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission:', permission);
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  console.log(JSON.stringify(subscription));
}

const notifyButton = document.querySelector('#notify');
if ('PushManager' in window) {
  notifyButton.addEventListener('click', enableNotifications);
} else {
  notifyButton.hidden = true;
}
```

Here is what the code does:

- `Notification.requestPermission()` shows the prompt and resolves to `granted`, `denied`, or `default`. It is the first call in the click handler, so it still counts as part of the user gesture. After the user chooses `denied`, the page cannot ask again. The user must change it in the site settings.
- `navigator.serviceWorker.ready` waits for the active registration from lesson 5. A push subscription always belongs to a service worker registration.
- `pushManager.subscribe()` contacts the push service and returns the subscription. If one already exists for the same key, it returns that one.
- `userVisibleOnly: true` is a promise that every push shows a notification. Chrome and Safari reject a subscription without it.
- `applicationServerKey` is your VAPID public key. The helper turns its URL-safe Base64 text into bytes, a form that every browser accepts.

## Read the subscription

The subscription turns into JSON like this:

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/d61c5u920dw:APA91bEmnw8utjDYCqSRplFMVCzQMg9e5XxpYajvh37mv2QIlISdasBFLbFca9ZZ4Uqcya0ck-SP84YJUEnWsVr3mwYfaDB7vGtsDQuEpfDdcIqOX_wrCRkBW2NDWRZ9qUz9hSgtI3sY",
  "expirationTime": null,
  "keys": {
    "p256dh": "BL7ELU24fJTAlH5Kyl8N6BDCac8u8li_U5PIwG963MOvdYs9s7LSzj8x_7v7RFdLZ9Eap50PiiyF5K0TDAis7t0",
    "auth": "juarI8x__VnHvsOgfeAPHg"
  }
}
```

- `endpoint` is the push service URL for this browser and this app. A server sends messages to it. In Chrome it points to a Google host. In Safari it points to an Apple host.
- `keys.p256dh` is the browser's public key. The server uses it to encrypt the message.
- `keys.auth` is a shared secret that is also used for encryption.

Treat the subscription as private. Anyone who has it and your private VAPID key can send notifications to this browser.

## Show a notification in the service worker

Add a `push` handler to `sw.js`:

```js
self.addEventListener('push', (event) => {
  const body = event.data ? event.data.text() : 'A new quote is waiting.';

  event.waitUntil(
    self.registration.showNotification('Daily Quote', {
      body,
      icon: '/icons/icon-192.png',
    })
  );
});
```

`event.data` holds the message that the server sent, or `null` when the message is empty. `showNotification()` returns a promise. `event.waitUntil()` keeps the service worker alive until that promise settles, as in the lifecycle events of lesson 6. Without it, the browser may stop the worker before the notification appears.

Show a notification for every push, because `userVisibleOnly` promised it. If you skip it, Chrome shows its own generic notification, and Safari can cancel the subscription.

## Open the app on click

A click on a notification fires `notificationclick` in the service worker. Nothing opens unless you handle it. Add this handler to `sw.js`:

```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      if (windows.length > 0) {
        return windows[0].focus();
      }
      return self.clients.openWindow('/');
    })()
  );
});
```

`self.clients` gives the service worker access to the pages in its scope. `matchAll()` lists the open windows of the app. The handler brings the first one to the front with `focus()` or opens a new window with `openWindow()`. Browsers allow both calls here because the user has just clicked the notification.

## Load the new version

You changed `index.html`, `app.js`, and `sw.js`. In `sw.js`, change `CACHE_NAME` from `daily-quote-v3` to `daily-quote-v4`, so the new service worker caches the new files. Start the server if it is not running:

```sh
npx http-server -c-1
```

Open `http://localhost:8080` in Chrome and reload the page so the browser finds the new worker. Activate it with the **Reload** button of the update prompt from lesson 6, or click **skipWaiting** in **Application > Service workers**. Check that the new version is activated and running.

Click **Enable notifications** and allow them in the prompt. The subscription JSON appears in the **Console** panel. Copy it into your note.

## Send a test push from DevTools

In **Application > Service workers**, find the **Push** field next to your service worker. Type `Hello from DevTools` and click **Push**. DevTools sends the text as the message data, so `event.data.text()` returns it. A Daily Quote notification appears in the top-right corner of the screen. Click it, and the app window comes to the front.

This test skips the push service. It checks only your service worker code.

## Send a real push

Now send a message through the real push service. Run this command with the values from your note. Use the `endpoint`, `p256dh`, and `auth` values from the subscription, your two VAPID keys, and your own email address:

```sh
npx web-push send-notification \
  --endpoint="YOUR_ENDPOINT" \
  --key="YOUR_P256DH_KEY" \
  --auth="YOUR_AUTH_SECRET" \
  --vapid-subject="mailto:you@example.com" \
  --vapid-pubkey="YOUR_PUBLIC_KEY" \
  --vapid-pvtkey="YOUR_PRIVATE_KEY" \
  --payload="A new quote is ready."
```

- `--key` and `--auth` encrypt the payload for this browser.
- `--vapid-subject` tells the push service how to contact you. It is a `mailto:` address or an `https:` URL.
- `--vapid-pubkey` and `--vapid-pvtkey` sign the message with your VAPID keys.
- `--payload` is the text that `event.data.text()` returns.

The command prints `Push message sent.` and the notification appears. Close the Daily Quote tab but keep Chrome running, then send it again. Now a click on the notification opens a new window.

If the command prints an error, check that you copied the whole endpoint and that the public key matches the one in `app.js`. A new public key needs a new subscription.

## Practice

Change the push handler so that the server can choose the title. Send a JSON payload such as `{"title":"Quote of the day","body":"Less is more."}`. In the handler, read it with `event.data.json()` and use `Daily Quote` when the title is missing. You are done when the DevTools **Push** button and the `web-push` command both show a notification with your title.

## Official resources

- [Push API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Push notifications overview on web.dev](https://web.dev/articles/push-notifications-overview)
- [Meet Web Push for Safari on WebKit](https://webkit.org/blog/12945/meet-web-push/)
- [web-push on GitHub](https://github.com/web-push-libs/web-push)
