---
slug: grpc/working-with-streaming-rpcs
title: Работа со streaming RPC
description: Отправьте медленный поток с сервиса на Node.js, прочитайте его через for await в клиенте на TypeScript и остановите досрочно с помощью cancel.
---

`Streaming RPC` позволяет обмениваться последовательностью сообщений в рамках одного вызова. В контракте курса `WatchItems` — метод с **server streaming**: клиент отправляет одну категорию, а сервер может прислать в ответ много сообщений `Item`.

```proto
rpc WatchItems(WatchItemsRequest) returns (stream Item);
```

Ключевое слово `stream` перед `Item` говорит о том, что ответ — это последовательность, а не одиночный `Item`. Из файла `.proto` не видно, пришлёт ли сервер конечный список или будет присылать обновления без конца. Прежде чем решать, как долго клиент должен держать вызов открытым, загляните в документацию сервиса.

## Замедляем поток на сервере

Сервер из прошлого урока записывает все товары разом, и поток заканчивается почти мгновенно. Чтобы увидеть, как сообщения приходят по одному, замените `watchItems` в `src/server.ts` версией, которая отправляет по товару в секунду:

```ts
  watchItems(call) {
    const matching = items.filter((it) => it.category === call.request.category);
    let index = 0;
    const timer = setInterval(() => {
      if (index === matching.length) {
        clearInterval(timer);
        call.end();
        return;
      }
      call.write(matching[index]);
      index += 1;
    }, 1000);
    call.on("cancelled", () => clearInterval(timer));
  },
```

Обработчик сразу возвращает управление, а таймер продолжает писать в `call`. Когда все товары отправлены, `call.end()` закрывает поток со статусом OK. Событие `cancelled` срабатывает, когда клиент отменяет вызов или отключается, и обработчик в этот момент останавливает таймер. Событие может прийти и после нормального завершения, поэтому в нём стоит делать только такую уборку, которую безопасно повторить. После изменения перезапустите сервер.

## Читаем поток в клиенте

Создайте `src/watch.ts`:

```ts
import { credentials } from "@grpc/grpc-js";
import { InventoryServiceClient, type Item } from "./gen/inventory/v1/inventory.js";

const client = new InventoryServiceClient("localhost:50051", credentials.createInsecure());
const category = process.argv[2] ?? "furniture";
const call = client.watchItems({ category });

try {
  for await (const item of call as AsyncIterable<Item>) {
    console.log(`${item.sku}: ${item.name} (${item.quantity})`);
  }
  console.log("Stream finished");
} catch (error) {
  console.error(`WatchItems failed: ${(error as Error).message}`);
} finally {
  client.close();
}
```

`watchItems` сразу возвращает `ClientReadableStream<Item>` — поток Node.js для чтения. `for await` дожидается каждого сообщения и выполняет тело цикла по разу на товар. Потоки Node.js отдают в `for await` значения типа `any`, поэтому `as AsyncIterable<Item>` возвращает элементам их тип.

Цикл завершается обычным образом, когда сервер закрывает поток со статусом OK, даже если он не прислал ни одного товара. Если вызов не удался, цикл выбрасывает ошибку. В этом случае считайте уже полученные товары частичным результатом, а не полным списком. Иногда тот же поток читают через события: `call.on("data", ...)`, `call.on("error", ...)` и `call.on("end", ...)`. Оба способа работают, но с `for await` вся обработка ошибок умещается в одном блоке `try`.

Добавьте скрипт и запустите клиент, пока работает сервер:

```sh
npm pkg set scripts.watch="tsx src/watch.ts"
npm run watch
```

Два товара из категории мебели приходят с интервалом в секунду:

```text
B-200: Office chair (3)
B-300: Standing desk (5)
Stream finished
```

## Останавливаем поток досрочно

У потока с обновлениями в реальном времени может вовсе не быть естественного конца, поэтому клиент должен уметь его остановить. Выйти из цикла через `break` **недостаточно**: вызов остаётся открытым, и сервер продолжает отправлять данные. Вместо этого вызовите `call.cancel()`. Сервер узнает об отмене, а цикл в клиенте выбросит ошибку с кодом статуса `CANCELLED`. Клиент сам этого ждёт, поэтому сообщать о такой ошибке как о сбое не нужно.

## Другие схемы вызова

По тому, где в сигнатуре метода стоит `stream`, видно, какая сторона отправляет последовательность:

| Схема | Со стороны запроса | Со стороны ответа |
| --- | --- | --- |
| Унарный вызов | Одно сообщение | Одно сообщение |
| Server streaming | Одно сообщение | Поток сообщений |
| Client streaming | Поток сообщений | Одно сообщение |
| Bidirectional streaming | Поток сообщений | Поток сообщений |

`WatchItems` использует вторую схему. Для остальных схем клиентский код устроен иначе, но первый шаг всегда один и тот же: прочитать сигнатуру метода в контракте `.proto`.

## Практика

1. Выполните `npm run watch -- garden`. Товаров с такой категорией нет, поэтому клиент выведет только `Stream finished`. Пустой поток — тоже успешный вызов.

2. Сделайте так, чтобы клиент останавливался после первого товара. В `src/watch.ts` добавьте `status` и тип `ServiceError` в импорт из `@grpc/grpc-js`, вызовите отмену внутри цикла и обработайте `CANCELLED` в `catch`:

   ```ts
   import { credentials, status, type ServiceError } from "@grpc/grpc-js";
   ```

   ```ts
     for await (const item of call as AsyncIterable<Item>) {
       console.log(`${item.sku}: ${item.name} (${item.quantity})`);
       call.cancel();
     }
   ```

   ```ts
   } catch (error) {
     if ((error as ServiceError).code === status.CANCELLED) {
       console.log("Stopped watching");
     } else {
       console.error(`WatchItems failed: ${(error as Error).message}`);
     }
   }
   ```

   Запустите `npm run watch`. Клиент выведет `B-200: Office chair (3)`, а затем `Stopped watching`.

3. Замените `call.cancel()` на `break` и снова запустите клиент. Он выведет `Stream finished`, но вызов при этом не отменён: сервер продолжает крутить таймер, пока не отправит последний товар. Верните `call.cancel()` на место.

## Официальные ресурсы

- [Основы gRPC для Node.js: streaming RPC](https://grpc.io/docs/languages/node/basics/#streaming-rpcs)
- [Отмена вызовов в gRPC](https://grpc.io/docs/guides/cancellation/)
- [API потоков Node.js](https://nodejs.org/api/stream.html)
