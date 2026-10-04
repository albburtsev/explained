---
slug: pwa/installing-the-app
title: Установка приложения
description: Как проверить критерии установки в Chrome, установить Daily Quote из Chrome и Safari на macOS, добавить собственную кнопку установки, распознать режим standalone и удалить приложение.
---

Установленное PWA открывается в отдельном окне — без вкладок и адресной строки. У него появляется собственный значок, и запускать его можно так же, как любое другое приложение на Mac. В этом уроке вы установите Daily Quote в Chrome и Safari, добавите свою кнопку установки и научите приложение понимать, как его открыли. Сервис-воркер для этого пока не нужен.

Запустите проект из папки `daily-quote/` и не останавливайте сервер:

```bash
npx http-server -c-1
```

Откройте `http://localhost:8080` в Chrome.

## Критерии установки в Chrome

Можно ли установить сайт, решают сами Chrome и другие браузеры на базе Chromium. Если сайт проходит `критерии установки` (install criteria), в адресной строке появляется кнопка установки, а его страницы могут получать событие `beforeinstallprompt`. Критерии такие:

- Страница отдаётся по HTTPS или с `localhost`.
- Страница ссылается на манифест, в котором есть `name` или `short_name`.
- В манифесте перечислены значки размером 192 и 512 пикселей.
- В манифесте задан `start_url`.
- `display` имеет значение `fullscreen`, `standalone`, `minimal-ui` или `window-controls-overlay`.
- `prefer_related_applications` отсутствует или равен `false`.
- Приложение ещё не установлено.

Манифест из прошлого урока удовлетворяет всем этим условиям. В старых руководствах можно встретить ещё одно требование — сервис-воркер с обработчиком `fetch`. На десктопе Chrome отказался от этого правила в версии 112, так что Daily Quote можно установить уже сейчас.

Кроме того, Chrome опирается на `эвристику вовлечённости` (engagement heuristic): он может подождать, пока пользователь хотя бы раз щёлкнет по странице и проведёт на ней около 30 секунд. Если сразу после загрузки ничего не появилось, щёлкните по странице и немного подождите.

## Установка из адресной строки

Когда страницу можно установить, Chrome показывает кнопку установки у правого края адресной строки. Нажмите её и подтвердите выбор кнопкой **Install**. Chrome откроет Daily Quote в новом окне, где нет ни вкладок, ни адресной строки.

Если кнопки не видно, откройте меню Chrome (**⋮**) и выберите **Cast, save, and share** → **Install page as app…**. Этот пункт работает для любой страницы, поэтому ещё не доказывает, что манифест составлен верно. Доказательство — именно кнопка в адресной строке.

Установленное приложение — обычное приложение macOS. Закройте его, затем найдите через Spotlight по значению `name` и откройте снова. Оно запустится с `start_url`, а не со страницы, на которой вы его устанавливали.

## Собственная кнопка установки

Кнопку в адресной строке легко не заметить, поэтому приложение может предложить свою. Браузеры на базе Chromium отправляют событие `beforeinstallprompt` объекту `window`, когда страницу становится можно установить. С помощью этого события диалог установки Chrome можно показать позже — по нажатию вашей кнопки.

Событие не входит ни в один стандарт и поддерживается только в Chromium. Поэтому относитесь к кнопке как к дополнению: по умолчанию скрывайте её и показывайте лишь тогда, когда событие пришло.

Добавьте кнопку в `index.html`, внутрь `<body>`:

```html
<button id="install-button" type="button" hidden>Install app</button>
```

Затем допишите этот код в конец `app.js`:

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

Вот что делает каждая часть:

- `event.preventDefault()` не даёт Chrome показать собственное предложение установки, и его место занимает ваша кнопка.
- `installPrompt` хранит событие. Его метод `prompt()` можно вызвать лишь один раз и только в ответ на действие пользователя, например на щелчок.
- `prompt()` показывает диалог установки. Его промис разрешается объектом, у которого поле `outcome` равно `accepted` или `dismissed`.
- `appinstalled` срабатывает после любой успешной установки, в том числе из адресной строки.

Пока приложение установлено, событие не приходит. Чтобы проверить кнопку, сначала удалите Daily Quote (см. последний раздел), перезагрузите страницу во вкладке Chrome, щёлкните по ней и дождитесь появления кнопки.

## Добавление в Dock в Safari

Safari в macOS Sonoma и более новых версиях умеет превратить в веб-приложение любой сайт. Критерии установки Chrome он не применяет и `beforeinstallprompt` не отправляет, поэтому ваша кнопка там так и останется скрытой.

1. Откройте `http://localhost:8080` в Safari.
2. Выберите **File** → **Add to Dock**.
3. Оставьте или измените название и нажмите **Add**.

Приложение появится в Dock и будет открываться в собственном окне. Такие сведения, как название, начальный адрес и режим отображения, Safari берёт из вашего манифеста. Cookie сайта он однократно копирует в новое приложение, а дальше приложение и Safari хранят данные сайта раздельно.

## Как распознать режим standalone

Сам факт установки странице не виден, но она может узнать, как её открыли. Медиа-функция `display-mode` совпадает с режимом, в котором работает страница. В обычной вкладке это `browser`, а в окне приложения, открытого с `"display": "standalone"`, — `standalone`.

Установленному приложению незачем предлагать установить самого себя. Добавьте в `style.css` правило, которое скрывает кнопку в окне приложения:

```css
@media (display-mode: standalone) {
  #install-button {
    display: none;
  }
}
```

В JavaScript тот же запрос выполняет `window.matchMedia()`. Добавьте в `app.js` такой код:

```js
const standaloneQuery = window.matchMedia('(display-mode: standalone)');

function logDisplayMode() {
  const mode = standaloneQuery.matches ? 'standalone' : 'browser';
  console.log(`Display mode: ${mode}`);
}

logDisplayMode();
standaloneQuery.addEventListener('change', logDisplayMode);
```

Обработчик `change` срабатывает, если режим меняется, пока страница открыта: Chrome, например, может после установки перенести открытую вкладку в окно приложения. Проверка в JavaScript нужна, когда режим важен коду — скажем, для аналитики. Проверка в CSS подходит, когда меняется только вёрстка.

Проверяйте то значение, которое задаёт ваш манифест. Если вместо `standalone` вы используете `minimal-ui`, проверяйте `(display-mode: minimal-ui)`. Убедитесь, что всё работает в каждом браузере, который вы поддерживаете: поддержка этой функции в веб-приложениях Safari от версии к версии менялась.

## Удаление приложения

При удалении исчезает само приложение, а файлы проекта остаются на месте. Удаляйте его, когда хотите заново проверить сценарий установки.

В Chrome:

1. Откройте Daily Quote в окне приложения.
2. Откройте меню приложения (**⋮**) в заголовке окна.
3. Выберите **Uninstall Daily Quote…** и нажмите **Remove**. Если хотите начать с чистого листа, отметьте **Also delete data from Chrome**.

Удалить приложение можно и иначе: откройте во вкладке `chrome://apps`, щёлкните по приложению правой кнопкой и удалите его.

В Safari убрать значок из Dock ещё не значит удалить приложение. Веб-приложения Safari хранятся в папке `Applications` внутри вашей домашней папки. В Finder выберите **Go** → **Home**, откройте `Applications` и перетащите Daily Quote в корзину.

## Официальные ресурсы

- [Making PWAs installable на MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [What does it take to be installable? на web.dev](https://web.dev/articles/install-criteria)
- [Revisiting Chrome's installability criteria](https://developer.chrome.com/blog/update-install-criteria)
- [Событие `beforeinstallprompt` на MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)
- [Медиа-функция `display-mode` на MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode)
- [Веб-приложения Safari на Mac](https://support.apple.com/en-us/104996)
