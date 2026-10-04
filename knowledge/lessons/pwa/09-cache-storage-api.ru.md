---
slug: pwa/cache-storage-api
title: Cache Storage API
description: Сохраняйте ответы через Cache Storage API, заранее кешируйте app shell приложения Daily Quote при установке, отвечайте на запросы из кеша и удаляйте старые версии кеша.
---

В предыдущем уроке сервис-воркер перехватывал каждый запрос в обработчике `fetch`. Но чтобы ответить без сети, ответы нужно где-то хранить. Для этого и существует `Cache Storage API` — хранилище пар «запрос — ответ», которое ваш код сам наполняет и сам читает.

В этом уроке вы сохраните основные файлы приложения во время `install`, научите сервис-воркер отвечать на запросы из кеша и удалять старые кеши, когда активируется новая версия.

## Два разных кеша

У браузера уже есть `HTTP-кеш`. Он сохраняет ответы самостоятельно и подчиняется заголовкам вроде `Cache-Control`; что в нём окажется и как долго пролежит, решаете не вы.

Cache Storage устроен иначе:

- Записи добавляет и удаляет только ваш код — сам браузер туда ничего не кладёт.
- Заголовки HTTP-кеширования он не учитывает. Срока годности у записей нет: запись хранится, пока вы её не удалите.
- Он принадлежит одному источнику (origin). Все страницы и сервис-воркер на `http://localhost:8080` видят одни и те же кеши.
- У источника может быть несколько именованных кешей, и каждый сопоставляет запросу ответ.

Доступ ко всем кешам даёт глобальный объект `caches`. Он есть и в сервис-воркере, и на обычных страницах, так что для начала с ним можно поэкспериментировать в консоли DevTools.

## API в нескольких вызовах

Откройте `http://localhost:8080`, затем консоль DevTools и выполняйте строки по очереди. Консоль понимает `await` на верхнем уровне.

`caches.open(name)` возвращает кеш с указанным именем, а если такого ещё нет, создаёт его:

```js
const cache = await caches.open('daily-quote-v1');
```

`cache.addAll(urls)` загружает каждый URL и сохраняет ответы. Если хотя бы одна загрузка не удалась или вернула статус вне диапазона 200–299, весь вызов отклоняется, и ничего из него в кеш не попадает:

```js
await cache.addAll(['/', '/style.css']);
```

`cache.put(request, response)` сохраняет ответ, который у вас уже есть. Тело ответа можно прочитать лишь однажды, поэтому если ответ нужен где-то ещё — например, чтобы вернуть его странице, — сохраните копию, сделанную через `response.clone()`:

```js
const response = await fetch('/quotes.json');
await cache.put('/quotes.json', response.clone());
const quotes = await response.json();
```

`cache.match(request)` ищет сохранённый ответ в одном кеше, а `caches.match(request)` — во всех кешах источника, в том порядке, в каком они создавались. Если совпадения нет, оба метода возвращают `undefined`, поэтому результат всегда стоит проверять:

```js
const cached = await caches.match('/style.css');
console.log(cached ? cached.status : 'not cached');
```

Ключом служит полный URL. `/` и `/index.html` — две разные записи, как и `/app.js` и `/app.js?v=2`.

`cache.delete(request)` удаляет одну запись. `caches.keys()` перечисляет имена кешей, а `caches.delete(name)` удаляет кеш целиком. Оба метода удаления возвращают `true`, если что-то действительно было удалено:

```js
await cache.delete('/quotes.json');
console.log(await caches.keys());
await caches.delete('daily-quote-v1');
```

Последняя строка удаляет тестовый кеш, и сервис-воркер начнёт с чистого листа.

## Заранее кешируем app shell

`app shell` (оболочка приложения) — это набор файлов, без которых приложение не запустится: HTML-страницы, стили, скрипт, манифест и иконки. Сохранение таких файлов ещё до того, как их запросили, называют предварительным кешированием, или `precaching`. Лучший момент для него — событие `install`.

Замените содержимое `sw.js` следующей версией. Обработчики `install`, `activate` и `fetch` из прошлых уроков остаются на месте, но теперь каждый из них занят настоящим делом. Обработчик `activate` по-прежнему вызывает `self.clients.claim()`, а обработчик `message` из шестого урока, как и раньше, вызывает `skipWaiting()`, когда об этом просит подсказка об обновлении:

```js
const CACHE_NAME = 'daily-quote-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/about.html',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(fromCacheOrNetwork(event.request));
});

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

async function deleteOldCaches() {
  const names = await caches.keys();
  const oldNames = names.filter(
    (name) => name.startsWith('daily-quote-') && name !== CACHE_NAME
  );
  await Promise.all(oldNames.map((name) => caches.delete(name)));
}

async function fromCacheOrNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
```

`event.waitUntil(precache())` удерживает воркер в состоянии установки, пока промис не завершится. Если `addAll` отклоняется — скажем, потому что одного из файлов `APP_SHELL` нет на сервере, — установка не удаётся. Тогда браузер оставляет прежний воркер и повторит попытку при одном из следующих посещений. Новый воркер никогда не начинает работу с половиной файлов.

Убедитесь, что каждый путь в `APP_SHELL` существует: одной опечатки достаточно, чтобы сорвать всю установку.

## Отвечаем на запросы из кеша

Обработчик `fetch` пропускает запросы, которые не являются `GET` или адресованы другому источнику. Для них он не вызывает `respondWith`, и браузер обрабатывает их как обычно.

Для остальных запросов `fromCacheOrNetwork` сначала заглядывает в кеш. Если ответ там нашёлся, страница получает сохранённую копию, а сеть не используется вовсе. Если нет, воркер загружает файл, сохраняет копию через `cache.put` и возвращает исходный ответ. Сохраняются только успешные ответы, так что страница с ошибкой в кеш не попадёт.

`quotes.json` в app shell не входит: он оказывается в кеше, когда `app.js` запрашивает его впервые. С этого момента приложение показывает одни и те же сохранённые цитаты, даже если файл на сервере изменился. Для первого примера это допустимо, а в следующем уроке вы подберёте для каждого вида файлов более подходящую стратегию.

## Проверяем результат в DevTools

Перезагрузите страницу. Новый воркер установится и перейдёт в ожидание. Активируйте его кнопкой Reload в подсказке об обновлении из шестого урока или откройте в Chrome DevTools **Application > Service workers** и нажмите **skipWaiting**.

Затем откройте **Application > Storage > Cache storage** и выберите `daily-quote-v1`. В таблице перечислены все сохранённые запросы. Выделите строку, чтобы увидеть заголовки ответа и превью тела. Если список выглядит устаревшим, нажмите **Refresh**.

Перезагрузите страницу ещё раз и перейдите на панель **Network**. У ответов, которые выдал воркер, в столбце **Size** стоит `(ServiceWorker)`.

Теперь измените `style.css` и перезагрузите страницу. Стили останутся прежними: воркер отвечает из кеша. Пока вы правите файлы, либо включите **Bypass for network** в **Application > Service workers**, либо выпускайте новую версию кеша.

## Выпускаем новую версию

Браузер устанавливает новый воркер, только когда меняются байты `sw.js`. Номер версии в имени кеша даёт естественный повод их изменить.

Измените первую строку `sw.js`:

```js
const CACHE_NAME = 'daily-quote-v2';
```

Перезагрузите страницу и активируйте новый воркер, как в прошлый раз. Его обработчик `install` загрузит свежую копию app shell в `daily-quote-v2`. Обработчик `activate` срабатывает, когда новый воркер сменяет прежний. `daily-quote-v1` больше не читает ни один воркер, поэтому обработчик его удаляет. Обновите **Cache storage**: останется только `daily-quote-v2`.

Фильтр по префиксу `daily-quote-` здесь важен. Кеши с другими именами на том же источнике могут принадлежать другому коду, и `deleteOldCaches` их не трогает.

## Квота хранилища

Cache Storage делит квоту с другими хранилищами сайта, например с IndexedDB. Каждый браузер ограничивает объём данных одного источника, а когда на диске кончается место, может удалить все данные источника разом. Чтобы узнать текущий расход и предел в байтах, выполните в консоли:

```js
const { usage, quota } = await navigator.storage.estimate();
console.log(usage, quota);
```

Оба числа приблизительные. App shell из нескольких файлов занимает лишь малую долю квоты, но считать кеш вечным хранилищем не стоит: приложение должно работать и тогда, когда кеш пуст.

## Официальные ресурсы

- [Cache на MDN](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [CacheStorage на MDN](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage)
- [Краткое руководство по Cache API на web.dev](https://web.dev/articles/cache-api-quick-guide)
- [Квоты хранилища и правила вытеснения данных на MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Просмотр данных кеша в Chrome DevTools](https://developer.chrome.com/docs/devtools/storage/cache)
