---
slug: grpc/making-unary-rpc-calls
title: Унарные RPC-вызовы
description: Создайте клиент gRPC на TypeScript, оберните его callback-метод в Promise и вызовите GetItem на сервере курса.
---

`Унарный RPC` отправляет один запрос и получает один ответ. В контракте курса метод `InventoryService.GetItem` принимает `GetItemRequest` с SKU и возвращает `Item`. В этом уроке вы вызовете его из клиента на TypeScript с помощью сгенерированного `InventoryServiceClient`.

## Пишем клиент

Создайте в проекте `inventory` файл `src/client.ts`:

```ts
import { credentials } from "@grpc/grpc-js";
import { InventoryServiceClient, type Item } from "./gen/inventory/v1/inventory.js";

const client = new InventoryServiceClient("localhost:50051", credentials.createInsecure());

function getItem(sku: string): Promise<Item> {
  return new Promise((resolve, reject) => {
    client.getItem({ sku }, (error, item) => {
      if (error) {
        reject(error);
      } else {
        resolve(item);
      }
    });
  });
}

const sku = process.argv[2] ?? "A-100";

try {
  const item = await getItem(sku);
  console.log(`${item.sku}: ${item.name} (${item.quantity} in stock)`);
} catch (error) {
  console.error(`GetItem failed: ${(error as Error).message}`);
} finally {
  client.close();
}
```

`new InventoryServiceClient` принимает адрес сервера и transport credentials. Сразу он не подключается: соединение открывается при первом вызове. Один клиент может выполнять много вызовов одновременно, поэтому создавайте его один раз и используйте повторно. В долгоживущем сервере на Node.js, например в backend-for-frontend, держите один клиент на весь процесс, а не создавайте новый на каждый запрос.

Сгенерированный метод `getItem` сообщает результат через callback в стиле Node.js: либо ошибку, либо `null` и ответ. Небольшая функция `getItem` превращает этот callback в Promise, чтобы остальной код мог пользоваться `async` и `await`. Такая типизированная обёртка лучше, чем `util.promisify`: тот теряет типы перегрузок метода.

Запрос — это обычный объект `{ sku }`. TypeScript сверяет его со сгенерированным интерфейсом `GetItemRequest`, а ответ имеет тип `Item`. Если опечататься в имени поля, проверка типов не пройдёт ещё до запуска кода.

`client.close()` закрывает соединение, чтобы скрипт мог завершиться, когда работа сделана. Проект использует ES-модули, поэтому в файле можно писать `await` на верхнем уровне, вне `async`-функции.

## Запускаем клиент

Убедитесь, что сервер из предыдущего урока запущен в другом терминале. Затем добавьте скрипт и запустите клиент:

```sh
npm pkg set scripts.client="tsx src/client.ts"
npm run client
```

Клиент выведет:

```text
A-100: Desk lamp (12 in stock)
```

## Выбор transport credentials

`credentials.createInsecure()` отключает защиту транспорта. Используйте его только для локального сервера разработки, который, как сервер курса, настроен на gRPC без шифрования. Настоящий сервис в сети работает через TLS. Если его сертификат выдан публичным центром сертификации, создайте клиент с `credentials.createSsl()`:

```ts
const client = new InventoryServiceClient("inventory.example.com:443", credentials.createSsl());
```

Замените адрес из примера настоящими хостом и портом сервера. Сервису с собственным центром сертификации (private CA) или с взаимной аутентификацией (mutual TLS) нужны дополнительные аргументы `createSsl()` — следуйте инструкциям этого сервиса.

## Практика

1. Запросите другой товар: выполните `npm run client -- B-200`. Текст после `--` попадает в скрипт как `process.argv[2]`. Клиент выведет `B-200: Office chair (3 in stock)`.

2. Запросите несуществующий товар: выполните `npm run client -- Z-999`. Клиент выведет `GetItem failed: 5 NOT_FOUND: Item Z-999 not found`. Сообщение начинается с числового кода статуса и его имени; как правильно их обрабатывать, вы узнаете в одном из следующих уроков.

3. Замените строку с `await getItem(sku)` и строку после неё двумя параллельными вызовами через тот же клиент:

   ```ts
   const [lamp, chair] = await Promise.all([getItem("A-100"), getItem("B-200")]);
   console.log(`${lamp.name} and ${chair.name}`);
   ```

   Клиент выведет `Desk lamp and Office chair`. Затем верните исходные две строки — они понадобятся в следующих уроках.

## Официальные ресурсы

- [Основы gRPC для Node.js: создание клиента](https://grpc.io/docs/languages/node/basics/#client)
- [Пакет `@grpc/grpc-js`](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js)
- [Руководство по аутентификации в gRPC](https://grpc.io/docs/guides/auth/)
