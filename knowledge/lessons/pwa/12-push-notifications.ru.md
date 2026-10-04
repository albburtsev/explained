---
slug: pwa/push-notifications
title: Push-уведомления
description: Подписываем Daily Quote на web push, показываем уведомления из сервис-воркера и отправляем тестовые сообщения из Chrome DevTools и через web-push CLI.
---

Push-уведомление позволяет приложению достучаться до пользователя, даже когда ни одна вкладка не открыта. Сервер отправляет сообщение, сервис-воркер просыпается и показывает его. В этом уроке Daily Quote запросит разрешение, оформит push-подписку и будет показывать уведомление на каждое сообщение. Затем вы отправите тестовые сообщения: сначала из Chrome DevTools, а потом из командной строки.

## Как устроен web push

В `web push` участвуют три стороны:

1. **Сервер приложения** решает, что пользователю пора получить сообщение. Он шифрует сообщение и отправляет его на адрес, который называется endpoint.
2. **Push-сервис браузера** принимает сообщение. Его держит производитель браузера: Chrome пользуется сервисом Google, Safari — сервисом Apple. Push-сервис хранит сообщение, пока браузер не сможет его забрать.
3. **Сервис-воркер** получает событие `push` и показывает уведомление.

Сама страница участвует в этом лишь однажды. Она просит у браузера `push subscription` (push-подписку) — объект с endpoint и ключами, которыми шифруются сообщения для этого браузера. Затем страница передаёт подписку вашему серверу. В настоящем приложении она отправляет её туда через `fetch()`. Создание такого сервера выходит за рамки урока, поэтому подписку вы скопируете вручную. Для обучения этого вполне достаточно.

Чтобы подтвердить, что сообщения приходят именно от вашего сервера, используется пара ключей — `VAPID keys` (VAPID-ключи). Открытый ключ попадает на страницу. Закрытый остаётся на сервере и подписывает каждое сообщение. Push-сервис принимает сообщения для подписки, только если они подписаны соответствующим закрытым ключом.

## Разрешите уведомления в macOS

Chrome и Safari на macOS поддерживают web push. Уведомлениями macOS управляет отдельно для каждого приложения, в том числе для каждого браузера. Откройте **Системные настройки** → **Уведомления** (**System Settings** → **Notifications**), выберите **Google Chrome** или **Safari** и включите **Разрешить уведомления** (**Allow notifications**). Если этот переключатель выключен, веб-код отработает без ошибок, но уведомление так и не появится.

Чтобы получать push-сообщения, Chrome должен быть запущен. Открытые окна ему не нужны, но если завершить его, сообщения подождут до следующего запуска. Safari на macOS передаёт доставку push-сообщений системе, поэтому они приходят, даже когда Safari не запущен.

## Создайте VAPID-ключи

Выполните эту команду в папке `daily-quote/`:

```sh
npx web-push generate-vapid-keys
```

`npx` скачивает пакет `web-push` и запускает его инструмент командной строки. Вывод выглядит примерно так, только значения будут ваши:

```text
=======================================

Public Key:
BEiGt1IPxuF1RW8AuCUsK6SKCk2okh939HzffwJlg2rRt4OiG9O2MwKxUb0jWeogm_jUrxNqhRZ02EpqMcSCEBY

Private Key:
jrYU8Dhn_AYne38FpC_mVlGo4pKS8mCIxn2dHXF6q2I

=======================================
```

Сохраните оба ключа в заметке. Открытый ключ понадобится на странице, а оба ключа — чтобы отправить сообщение. Никогда не кладите закрытый ключ в файл, который загружает браузер.

## Запросите разрешение и оформите подписку

Браузеры ждут, что запрос разрешения последует за действием пользователя на странице. Safari и Firefox требуют, чтобы сначала был клик или нажатие клавиши, а Chrome может показать более скромный запрос сайтам, которые спрашивают слишком рано. Поэтому никогда не спрашивайте при загрузке страницы. Спрашивайте, когда пользователь нажимает кнопку, которая объясняет, что он получит.

Добавьте кнопку в `index.html` рядом с цитатой:

```html
<button id="notify" type="button">Enable notifications</button>
```

Добавьте этот код в конец `app.js` и замените заглушку своим открытым ключом:

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

Вот что делает этот код:

- `Notification.requestPermission()` показывает запрос и возвращает `granted`, `denied` или `default`. Это первый вызов в обработчике клика, поэтому он всё ещё считается частью пользовательского действия. Если пользователь выбрал `denied`, страница больше не сможет спросить. Изменить решение он может только в настройках сайта.
- `navigator.serviceWorker.ready` дожидается активной регистрации из урока 5. Push-подписка всегда принадлежит регистрации сервис-воркера.
- `pushManager.subscribe()` обращается к push-сервису и возвращает подписку. Если подписка с тем же ключом уже есть, метод вернёт её.
- `userVisibleOnly: true` — обещание, что каждое push-сообщение покажет уведомление. Без этого Chrome и Safari откажут в подписке.
- `applicationServerKey` — ваш открытый VAPID-ключ. Вспомогательная функция превращает его текст в URL-безопасной кодировке Base64 в байты — форму, которую принимает любой браузер.

## Разберите подписку

В JSON подписка выглядит так:

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

- `endpoint` — URL push-сервиса для этого браузера и этого приложения. На него сервер отправляет сообщения. В Chrome он ведёт на хост Google, в Safari — на хост Apple.
- `keys.p256dh` — открытый ключ браузера. Им сервер шифрует сообщение.
- `keys.auth` — общий секрет, который тоже участвует в шифровании.

Обращайтесь с подпиской как с конфиденциальными данными. Любой, у кого есть она и ваш закрытый VAPID-ключ, может отправлять уведомления в этот браузер.

## Покажите уведомление из сервис-воркера

Добавьте в `sw.js` обработчик `push`:

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

В `event.data` лежит сообщение, отправленное сервером, или `null`, если сообщение пустое. `showNotification()` возвращает промис. `event.waitUntil()` не даёт сервис-воркеру остановиться, пока этот промис не завершится, — так же, как в событиях жизненного цикла из урока 6. Без него браузер может остановить воркер раньше, чем появится уведомление.

Показывайте уведомление на каждое push-сообщение: именно это обещает `userVisibleOnly`. Если пропустить уведомление, Chrome покажет собственное, безликое, а Safari может отменить подписку.

## Откройте приложение по клику

Клик по уведомлению вызывает в сервис-воркере событие `notificationclick`. Пока вы его не обработаете, ничего не откроется. Добавьте в `sw.js` такой обработчик:

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

Через `self.clients` сервис-воркер получает доступ к страницам в своей области действия. `matchAll()` перечисляет открытые окна приложения. Обработчик выводит первое из них на передний план с помощью `focus()` или открывает новое окно через `openWindow()`. Браузеры разрешают оба вызова, потому что пользователь только что нажал на уведомление.

## Загрузите новую версию

Вы изменили `index.html`, `app.js` и `sw.js`. В `sw.js` замените значение `CACHE_NAME` с `daily-quote-v3` на `daily-quote-v4`, чтобы новый сервис-воркер закешировал обновлённые файлы. Запустите сервер, если он ещё не работает:

```sh
npx http-server -c-1
```

Откройте `http://localhost:8080` в Chrome и перезагрузите страницу, чтобы браузер обнаружил новый воркер. Активируйте его кнопкой **Reload** в баннере обновления из урока 6 или ссылкой **skipWaiting** в **Application > Service workers**. Убедитесь, что новая версия активирована и работает.

Нажмите **Enable notifications** и разрешите уведомления в появившемся запросе. JSON подписки появится на панели **Console**. Скопируйте его в заметку.

## Отправьте тестовое push-сообщение из DevTools

В **Application > Service workers** найдите поле **Push** рядом с вашим сервис-воркером. Введите `Hello from DevTools` и нажмите **Push**. DevTools передаёт этот текст как данные сообщения, поэтому `event.data.text()` вернёт именно его. В правом верхнем углу экрана появится уведомление Daily Quote. Нажмите на него — окно приложения выйдет на передний план.

Эта проверка обходит push-сервис стороной и тестирует только код сервис-воркера.

## Отправьте настоящее push-сообщение

Теперь отправьте сообщение через настоящий push-сервис. Выполните команду, подставив значения из заметки: `endpoint`, `p256dh` и `auth` из подписки, оба VAPID-ключа и свой адрес электронной почты:

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

- `--key` и `--auth` шифруют содержимое сообщения для этого браузера.
- `--vapid-subject` сообщает push-сервису, как с вами связаться. Это адрес `mailto:` или URL `https:`.
- `--vapid-pubkey` и `--vapid-pvtkey` подписывают сообщение вашими VAPID-ключами.
- `--payload` — текст, который вернёт `event.data.text()`.

Команда выведет `Push message sent.`, и появится уведомление. Закройте вкладку Daily Quote, не завершая Chrome, и отправьте сообщение ещё раз. Теперь клик по уведомлению откроет новое окно.

Если команда выводит ошибку, проверьте, что endpoint скопирован целиком, а открытый ключ совпадает с ключом в `app.js`. Для нового открытого ключа нужна новая подписка.

## Практика

Измените обработчик `push` так, чтобы заголовок выбирал сервер. Отправьте JSON вроде `{"title":"Quote of the day","body":"Less is more."}`. В обработчике прочитайте его через `event.data.json()`, а если заголовка нет, используйте `Daily Quote`. Задание выполнено, когда и кнопка **Push** в DevTools, и команда `web-push` показывают уведомление с вашим заголовком.

## Официальные ресурсы

- [Push API на MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Обзор push-уведомлений на web.dev](https://web.dev/articles/push-notifications-overview)
- [Meet Web Push for Safari на WebKit](https://webkit.org/blog/12945/meet-web-push/)
- [web-push на GitHub](https://github.com/web-push-libs/web-push)
