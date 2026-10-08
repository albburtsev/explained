---
slug: grpc/implementing-a-grpc-service
title: Реализация сервиса gRPC на Node.js
description: Реализуйте на TypeScript сгенерированный интерфейс сервиса, запустите сервер gRPC на Node.js и проверьте его с помощью buf curl.
---

Клиенту нужен сервер, к которому можно обратиться. В этом уроке вы напишете сервис склада по контракту курса и запустите его на Node.js. Сгенерированный интерфейс `InventoryServiceServer` подсказывает, какие методы нужно написать и какие типы они получают. Если метода не хватает или он возвращает данные не той формы, TypeScript сообщит об ошибке.

## Пишем сервис

Создайте в проекте `inventory` файл `src/server.ts`:

```ts
import { Server, ServerCredentials, status } from "@grpc/grpc-js";
import {
  InventoryServiceService,
  type InventoryServiceServer,
  type Item,
} from "./gen/inventory/v1/inventory.js";

const items: Item[] = [
  { sku: "A-100", name: "Desk lamp", category: "lighting", quantity: 12 },
  { sku: "B-200", name: "Office chair", category: "furniture", quantity: 3 },
  { sku: "B-300", name: "Standing desk", category: "furniture", quantity: 5 },
];

const inventoryService: InventoryServiceServer = {
  getItem(call, callback) {
    const item = items.find((it) => it.sku === call.request.sku);
    if (!item) {
      callback({ code: status.NOT_FOUND, details: `Item ${call.request.sku} not found` });
      return;
    }
    callback(null, item);
  },
  watchItems(call) {
    for (const item of items) {
      if (item.category === call.request.category) {
        call.write(item);
      }
    }
    call.end();
  },
};

const server = new Server();
server.addService(InventoryServiceService, inventoryService);
server.bindAsync("localhost:50051", ServerCredentials.createInsecure(), (error, port) => {
  if (error) {
    throw error;
  }
  console.log(`Inventory service listening on port ${port}`);
});
```

Импорт заканчивается на `.js`, хотя сам файл называется `inventory.ts`. Так TypeScript записывает относительные импорты в ES-модулях Node.js, а `tsx` находит нужный файл `.ts`.

## Как устроены обработчики

Каждый метод в `inventoryService` — это `обработчик` (handler): функция, которую сервер вызывает, когда приходит запрос. Чтобы пример оставался коротким, данные хранятся в массиве в памяти; настоящий сервис читал бы базу данных или другой API.

- `getItem` — унарный метод. В `call.request` лежит декодированный `GetItemRequest`. Ответить нужно ровно один раз, через `callback`: `callback(null, item)` отправляет ответ, а `callback({ code, details })` завершает вызов со статусом ошибки. Здесь на неизвестный SKU сервер отвечает `NOT_FOUND`. Подробно коды статуса разобраны в одном из следующих уроков.
- `watchItems` — метод с server streaming. Вместо callback он записывает сообщения в `call` через `call.write()`. `call.end()` закрывает поток со статусом OK. Пока вы не вызвали `end()`, клиент продолжает ждать новых сообщений.

Последний блок запускает сервер. `addService` связывает реализацию с `InventoryServiceService` — сгенерированным определением, в котором есть пути методов и преобразователи сообщений. `bindAsync` открывает порт и вызывает свой callback, когда сервер готов. `ServerCredentials.createInsecure()` отключает TLS — для локального сервера разработки это допустимо. Серверу, к которому обращаются другие машины, нужны TLS credentials.

## Запускаем и проверяем сервер

Добавьте скрипт и запустите сервер:

```sh
npm pkg set scripts.server="tsx src/server.ts"
npm run server
```

В терминале появится строка:

```text
Inventory service listening on port 50051
```

Сервер работает, пока вы не нажмёте `Ctrl+C`. Клиента у вас ещё нет, но в составе `buf` есть `buf curl`, который работает как `curl`, только для gRPC. Откройте второй терминал в каталоге проекта и вызовите `GetItem`:

```sh
npx buf curl --protocol grpc --http2-prior-knowledge --schema proto \
  --data '{"sku": "A-100"}' \
  http://localhost:50051/inventory.v1.InventoryService/GetItem
```

`--schema proto` велит `buf curl` прочитать контракт из каталога `proto`, поэтому запрос можно записать в виде JSON. `--http2-prior-knowledge` включает HTTP/2 без TLS — это соответствует незащищённому серверу. URL заканчивается путём метода, который вы нашли в сгенерированном коде. В ответ приходит товар в виде JSON:

```json
{
  "sku": "A-100",
  "name": "Desk lamp",
  "category": "lighting",
  "quantity": 12
}
```

## Практика

1. Вызовите `GetItem` с SKU `Z-999`. `buf curl` выведет ошибку с кодом `not_found` и сообщением `Item Z-999 not found`.

2. Вызовите streaming-метод: замените окончание URL на `WatchItems`, а данные — на `{"category": "furniture"}`. Вы получите два JSON-объекта, `B-200` и `B-300`, после чего команда завершится, потому что сервер вызвал `call.end()`.

3. Добавьте в массив `items` четвёртый товар, например `{ sku: "C-400", name: "Bookshelf", category: "furniture", quantity: 7 }`. Перезапустите сервер и повторите задание 2. Затем уберите у этого товара свойство `quantity` и выполните `npm run typecheck`: TypeScript сообщит, что `quantity` отсутствует, ведь массив использует сгенерированный тип `Item`. Верните свойство на место.

## Официальные ресурсы

- [Основы gRPC для Node.js: создание сервера](https://grpc.io/docs/languages/node/basics/#server)
- [Пакет `@grpc/grpc-js`](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js)
- [Buf: справочник по `buf curl`](https://buf.build/docs/reference/cli/buf/curl/)
