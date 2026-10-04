---
slug: pwa/service-worker-lifecycle-and-updates
title: Жизненный цикл и обновление
description: Как сервис-воркер проходит путь от установки до активации, почему новая версия ждёт своей очереди и как предложить пользователю перезагрузку, когда обновление готово.
---

Daily Quote уже регистрирует `/sw.js`, и сервис-воркер управляет всеми страницами в своей области действия. Рано или поздно этот файл придётся изменить. Но браузер не подменяет старый сервис-воркер новым сразу: каждая версия проходит строго определённую последовательность состояний, и новая нередко останавливается и ждёт. В этом уроке разберём эту последовательность и научимся сообщать пользователю, что обновление готово.

## Состояния сервис-воркера

`Жизненный цикл` (lifecycle) — это последовательность состояний, через которую проходит каждая версия сервис-воркера. Текущее состояние хранится в свойстве `state` объекта `ServiceWorker`:

1. `installing` — браузер загрузил скрипт и отправил событие `install`.
2. `installed` — установка прошла успешно, и теперь это ожидающий, `waiting`, сервис-воркер. Здесь он и остаётся, пока страницами управляет более старая версия.
3. `activating` — сервис-воркер берёт управление на себя и уже получил событие `activate`.
4. `activated` — это активный, `active`, сервис-воркер. Теперь он обрабатывает события вроде `fetch` и `push`.
5. `redundant` — сервис-воркер больше не используется: либо его установка не удалась, либо его сменила более новая версия.

Регистрация может одновременно хранить до трёх сервис-воркеров, по одному в каждой ячейке: `registration.installing`, `registration.waiting` и `registration.active`. При первом посещении сервис-воркер проходит все состояния без остановок. При последующих обновлениях он, как правило, задерживается в `installed`.

## События `install` и `activate`

Событие `install` браузер отправляет по одному разу для каждой новой версии сервис-воркера. Здесь готовят всё, что понадобится этой версии. Событие `activate` приходит тоже один раз — в момент, когда версия берёт управление на себя. Здесь прибирают то, что осталось от предыдущей.

Измените `sw.js` так, чтобы каждая версия сообщала своё имя:

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

`event.waitUntil()` принимает промис и не даёт текущему этапу завершиться, пока промис не выполнится. Браузер вправе остановить простаивающий сервис-воркер в любой момент, поэтому только так можно надёжно довести до конца асинхронную работу внутри этих событий:

- В `install` сервис-воркер остаётся в состоянии `installing`, пока промис не будет выполнен. Если промис отклонён, установка проваливается: новый сервис-воркер переходит в `redundant`, а старый продолжает работать как прежде.
- В `activate` браузер придерживает `fetch` и другие события, пока промис не выполнится. Так новый сервис-воркер не станет обрабатывать запросы, не закончив уборку.

В уроке 9 оба события понадобятся, чтобы заполнить кеш и удалить устаревшие кеши. Пока они только пишут в консоль.

## Почему новая версия ждёт

Выпустите обновление и понаблюдайте за ним. Откройте `http://localhost:8080` в Chrome с открытой консолью. Там появятся `v1: install` и `v1: activate`. Теперь замените первую строку `sw.js` на `const VERSION = 'v2';` и перезагрузите страницу.

В консоли появится `v2: install`, но не `v2: activate`. Вторая версия установлена и ждёт, а страницей по-прежнему управляет первая.

Перезагрузки для смены сервис-воркера мало. Во время перезагрузки старая страница остаётся на экране до тех пор, пока не придёт ответ для новой. Значит, хотя бы одна подконтрольная страница существует всегда, и старый сервис-воркер сохраняет управление. Новый ждёт, пока в его области действия не останется ни одной вкладки и ни одного окна установленного приложения, которые пользуются старым. Закройте все вкладки Daily Quote, снова откройте приложение — и увидите `v2: activate`.

Это правило защищает приложение. В каждый момент страницами управляет лишь одна версия. Страница, загруженная старым сервис-воркером, никогда не получит ответов от нового, который может работать иначе. Например, новый сервис-воркер способен удалить кеш, которым старая страница ещё пользуется.

## Как не ждать: `skipWaiting()` и `clients.claim()`

Два метода нарушают это правило намеренно:

```js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

`self.skipWaiting()` велит ожидающему или устанавливающемуся сервис-воркеру активироваться сразу после окончания установки, не дожидаясь, пока закроются старые вкладки. Старый сервис-воркер при этом переходит в `redundant`.

`clients.claim()` позволяет активному сервис-воркеру взять под контроль открытые страницы в своей области действия, которыми он ещё не управляет. Без этого вызова страница, которая регистрирует сервис-воркер при первом посещении, остаётся неподконтрольной до следующей загрузки.

У обоих методов есть цена. После `skipWaiting()` страницы, загруженные старой версией, начинают получать ответы от новой. Если версии несовместимы — скажем, старая страница запрашивает файл, которого у нового сервис-воркера уже нет, — страница может сломаться. У `clients.claim()` тот же риск, только в меньшем масштабе: страница, загруженная из сети, посреди своей жизни вдруг начинает зависеть от сервис-воркера.

Поэтому безусловно вызывать `skipWaiting()` стоит лишь тогда, когда любая версия уживается со страницами любой другой. В остальных случаях пусть момент переключения выбирает пользователь. Именно так и поступает подсказка, которую мы соберём в конце урока.

## Как браузер находит обновление

Браузер проверяет, не появилась ли новая версия сервис-воркера, в следующих случаях:

- Пользователь переходит на страницу в области действия сервис-воркера.
- Событие вроде `push` запускает сервис-воркер, а за последние 24 часа проверки не было.
- Страница вызывает `register()` с другим URL скрипта. Этого лучше избегать: URL должен оставаться неизменным.
- Ваш код вызывает `registration.update()`.

При каждой проверке браузер загружает `sw.js` и побайтово сравнивает его с установленной версией. Сравниваются и скрипты, которые сервис-воркер подключает через `importScripts()`. Если различий нет, ничего не происходит. Одно лишь изменение `quotes.json` или `style.css` новой версии не порождает. Вот почему пригодится константа `VERSION`: стоит её поменять — и файл сервис-воркера изменится.

Вкладка может оставаться открытой днями без единого перехода. Чтобы проверка происходила и в ней, вызывайте `registration.update()` по таймеру:

```js
setInterval(() => registration.update(), 60 * 60 * 1000);
```

По умолчанию при таких проверках `sw.js` загружается в обход HTTP-кеша. Это поведение задаёт параметр `updateViaCache` метода `register()`:

- `'imports'` — значение по умолчанию: `sw.js` всегда берётся из сети, а скрипты, подключённые через `importScripts()`, могут прийти из HTTP-кеша.
- `'none'` — HTTP-кеш не используется ни для того, ни для другого.
- `'all'` — HTTP-кеш используется для обоих.

```js
navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
```

Daily Quote не импортирует скриптов, так что значение по умолчанию ему вполне подходит. К тому же с `http-server -c-1` ничего не кешируется в любом случае.

## Подсказка «Доступна новая версия»

Страница может следить за жизненным циклом с помощью трёх событий:

- `updatefound` возникает на регистрации, когда начинается установка нового сервис-воркера. Он находится в `registration.installing`.
- `statechange` возникает на объекте `ServiceWorker` при каждом изменении его `state`.
- `controllerchange` возникает на `navigator.serviceWorker`, когда страницей начинает управлять другой сервис-воркер.

С их помощью собирается привычный сценарий. Когда новая версия доходит до `installed`, страница показывает сообщение. Когда пользователь нажимает Reload, страница просит ожидающий сервис-воркер вызвать `skipWaiting()`. Когда новый сервис-воркер берёт управление, страница перезагружается.

Начните с сервис-воркера. Замените `sw.js` такой версией — она вызывает `skipWaiting()`, только получив от страницы сообщение `skip-waiting`:

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

Добавьте в `index.html` скрытый баннер — прямо перед тегом `<script>`, который загружает `app.js`:

```html
<div id="update-banner" hidden>
  A new version is available.
  <button id="update-button" type="button">Reload</button>
</div>
```

В `app.js` замените код регистрации следующим:

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

Код учитывает три случая. Новая версия может уже ждать — после проверки, которая прошла во время одного из прошлых посещений. Она может устанавливаться в тот самый момент, когда запускается страница, ведь проверку запустил сам переход. Наконец, она может появиться позже — об этом сообщит `updatefound`. Проверка `navigator.serviceWorker.controller` отличает обновление от первой установки: при первом посещении старого сервис-воркера нет, а значит, и ждать некого.

Флаг `reloading` защищает от повторной перезагрузки. Проверка `hadController` нужна из-за `clients.claim()`: при первом посещении этот вызов тоже порождает `controllerchange`, и перезагрузка в этот момент была бы бессмысленной.

Попробуйте. Перезагрузите страницу. Новый `sw.js` сам по себе — обновление, поэтому `v3` устанавливается и ждёт, а на странице появляется баннер. Нажмите Reload: в консоли появится `v3: activate`, и страница перезагрузится уже под новым сервис-воркером. Поменяйте `VERSION` на `'v4'` и перезагрузите страницу, чтобы пройти весь путь ещё раз. Другие открытые вкладки приложения тоже получат `controllerchange` и перезагрузятся вместе с этой.

## Официальные ресурсы

- [web.dev: жизненный цикл сервис-воркера](https://web.dev/articles/service-worker-lifecycle)
- [MDN: ServiceWorker.state](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state)
- [MDN: ServiceWorkerGlobalScope.skipWaiting()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)
- [MDN: Clients.claim()](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim)
- [MDN: ServiceWorkerRegistration.updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache)
- [Chrome for Developers: свежие сервис-воркеры по умолчанию](https://developer.chrome.com/blog/fresher-sw)
