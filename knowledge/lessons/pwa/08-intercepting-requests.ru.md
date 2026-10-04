---
slug: pwa/intercepting-requests
title: Перехват запросов
description: Как обработать событие fetch в сервис-воркере, прочитать запрос, ответить на него через respondWith() и оставить браузеру cross-origin запросы и запросы с методом, отличным от GET.
---

Сервис-воркер стоит между страницей и сетью. До сих пор `sw.js` в Daily Quote умел только устанавливаться и активироваться. В этом уроке он начнёт видеть каждый запрос страницы и сам решать, как ответить на некоторые из них. Кеша пока нет: сервис-воркер лишь читает запросы, передаёт их дальше или собирает ответы сам. Cache Storage API появится в следующем уроке.

## Событие `fetch`

Когда страница, которой управляет сервис-воркер, что-то запрашивает, браузер вызывает в сервис-воркере событие `fetch`. Это касается и самой страницы, и её CSS и скриптов, и изображений, и каждого вызова `fetch()` из `app.js`. Переход на другую страницу в пределах области действия, например на `about.html`, тоже порождает это событие.

Добавьте обработчик в конец `sw.js`, после обработчиков `install` и `activate`:

```js
self.addEventListener('fetch', (event) => {
  console.log(event.request.method, event.request.url);
});
```

Перезагрузите страницу. Если изменения не применились, проверьте, что в панели **Application** включён флажок **Update on reload**, как в предыдущем уроке. Теперь в **Console** в DevTools на каждый запрос выводится по строке. Обработчик только пишет в журнал, поэтому все запросы, как и прежде, уходят в сеть.

## Что можно узнать из запроса

`event.request` — это объект `Request`. Почти всё нужное сообщают четыре его свойства:

- `url` — полный адрес, например `http://localhost:8080/quotes.json`. Чтобы разобрать его на части, такие как `origin` и `pathname`, используйте `new URL(request.url)`.
- `method` — HTTP-метод, например `GET` или `POST`.
- `mode` показывает, как был сделан запрос. Значение `navigate` означает, что браузер загружает страницу целиком. Другие возможные значения — `cors`, `no-cors` и `same-origin`.
- `destination` говорит, для чего нужен ответ: `document`, `style`, `script`, `image` и так далее. У вызова `fetch()` это пустая строка.

При первой загрузке Daily Quote значения будут примерно такими:

| Запрос | `mode` | `destination` |
| --- | --- | --- |
| `/` (сама страница) | `navigate` | `document` |
| `/style.css` | `no-cors` | `style` |
| `/quotes.json` (из `fetch()`) | `cors` | пустая строка |

## Ответ через `respondWith()`

У обработчика `fetch` есть три варианта действий для каждого запроса.

**Ничего не делать.** Если обработчик завершается, не вызвав `event.respondWith()`, браузер обрабатывает запрос так, будто сервис-воркера нет. Для большинства запросов, которые вы не собираетесь менять, это и есть правильный выбор.

**Пропустить запрос дальше.** `fetch(event.request)` отправляет тот же запрос в сеть и возвращает промис с объектом `Response`. Передайте этот промис в `respondWith()`:

```js
event.respondWith(fetch(event.request));
```

Внешне результат не отличается от бездействия, но теперь ответом распоряжается сервис-воркер: он может изучить или изменить его, прежде чем ответ получит страница. Если сеть недоступна, `fetch()` отклоняет промис, и страница получает сетевую ошибку. Этот случай разберём в следующих уроках.

**Собрать синтетический ответ.** Объект `Response` может прийти не из сети, а из вашего собственного кода:

```js
event.respondWith(
  new Response('Hello from the service worker!', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
);
```

`respondWith()` принимает `Response` или промис, который разрешается в `Response`. Вызывать его нужно синхронно, пока событие ещё обрабатывается. Вызов после `await` или внутри колбэка `then()` выбросит ошибку: браузер к этому моменту уже пошёл дальше. Всю асинхронную работу помещайте внутрь промиса, который передаёте в `respondWith()`.

## Не трогайте cross-origin запросы и запросы, отличные от GET

Страница может запрашивать файлы и с других origin — например, у сервиса шрифтов или у скрипта аналитики. Она может отправлять и `POST`-запросы, которые меняют данные на сервере. Как правило, сервис-воркеру не стоит вмешиваться ни в те, ни в другие:

- Ответы с другого origin часто оказываются `opaque`: их статус, заголовки и тело скрыты от вашего кода. Проверить или изменить такой ответ безопасно не получится.
- У запроса с методом, отличным от GET, есть побочные эффекты или тело. Если повторить его или ответить на него сохранённым ответом, легко получить ошибки. К тому же Cache Storage API из следующего урока хранит только ответы на `GET`.

Поэтому начните обработчик с фильтра и просто выходите из него во всех остальных случаях:

```js
const url = new URL(event.request.url);

if (url.origin !== self.location.origin || event.request.method !== 'GET') {
  return;
}
```

`self.location` — это адрес `sw.js`, так что `self.location.origin` — собственный origin приложения, `http://localhost:8080`.

## Навигационные запросы и подресурсы

Запрос, у которого `mode` равен `navigate`, загружает HTML-страницу целиком. Так происходит, когда пользователь открывает приложение, вводит URL в пределах области действия, переходит по ссылке на `about.html` или перезагружает страницу. Все остальные запросы — `подресурсы` (subresources): файлы или данные, которые нужны странице, такие как CSS, скрипт, изображение или `quotes.json`.

```js
if (event.request.mode === 'navigate') {
  // A whole page: index.html, about.html, or any URL typed in the scope.
}
```

Обычно для этих двух видов запросов нужны разные правила. Например, позже в этом курсе на неудавшуюся навигацию мы ответим офлайн-страницей, а неудачно загруженное изображение можно просто оставить пустым местом.

## Попробуйте: перепишите один ответ и придумайте страницу

Замените обработчик с журналированием в `sw.js` такой версией:

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

Теперь обработчик делает все три вещи. Страницу `/hello-sw` он собирает с нуля. `quotes.json` пропускает дальше, попутно меняя заголовки. Все прочие запросы оставляет браузеру. Заголовки ответа, полученного через `fetch()`, доступны только для чтения, поэтому `addHeader()` копирует их в новый объект `Headers` и собирает новый `Response` вокруг того же тела.

## Проверьте результат

Когда приложение запущено на `http://localhost:8080`:

1. Перезагрузите страницу и откройте **Console**. Для каждого запроса к тому же origin выводятся его `mode`, `destination` и путь. Перейдите по ссылке на `about.html` и найдите строку `navigate document`.
2. Откройте панель **Network**, перезагрузите страницу и выберите `quotes.json`. Среди заголовков ответа есть `X-Served-By: daily-quote-sw`. Вторая строка `quotes.json` со значком шестерёнки — это запрос, который сам сервис-воркер отправил в сеть.
3. Откройте `http://localhost:8080/hello-sw`. На странице появится `Hello from the service worker!`, хотя у `http-server` такого файла нет.
4. В разделе **Application** → **Service workers** включите **Bypass for network** и перезагрузите `/hello-sw`. Теперь запрос уходит на сервер, и тот возвращает ошибку 404. Затем снова выключите этот флажок.

## Официальные ресурсы

- [MDN: `FetchEvent`](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent)
- [MDN: `FetchEvent.respondWith()`](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/respondWith)
- [MDN: `Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
- [MDN: `Response()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response)
- [Service Workers specification](https://w3c.github.io/ServiceWorker/)
