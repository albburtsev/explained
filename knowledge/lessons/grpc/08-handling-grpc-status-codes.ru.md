---
slug: grpc/handling-grpc-status-codes
title: Обработка кодов статуса gRPC
description: Возвращайте коды статуса gRPC из сервиса на Node.js и обрабатывайте в клиенте на TypeScript случаи, когда товар не найден, запрос некорректен или сервис недоступен.
---

Каждый вызов gRPC завершается со `статусом` (status): это код и, если что-то пошло не так, описание. У успешного вызова код `OK`. У неудачного — `код статуса`, который сообщает клиенту, какого рода сбой произошёл. Этот код не имеет отношения к HTTP-статусу транспорта: ответ gRPC может прийти с HTTP 200 и всё равно сообщать о статусе gRPC, отличном от OK. Поэтому проверить `response.ok`, как с `fetch`, не получится — проверять нужно код gRPC.

В `@grpc/grpc-js` коды — это члены перечисления `status`, например `status.NOT_FOUND`. При неудачном вызове клиент получает `ServiceError`: в поле `code` лежит число, а в поле `details` — описание от сервера.

## Возвращаем статус с сервера

Файл `.proto` **не** определяет, какой код сервис возвращает в каком случае. Это решает и документирует сам сервис. Для сервиса курса установим такие правила: пустой SKU — это `INVALID_ARGUMENT`, неизвестный SKU — `NOT_FOUND`. Обновите `getItem` в `src/server.ts`:

```ts
  getItem(call, callback) {
    if (call.request.sku === "") {
      callback({ code: status.INVALID_ARGUMENT, details: "SKU is required" });
      return;
    }
    const item = items.find((it) => it.sku === call.request.sku);
    if (!item) {
      callback({ code: status.NOT_FOUND, details: `Item ${call.request.sku} not found` });
      return;
    }
    callback(null, item);
  },
```

После изменения перезапустите сервер.

## Обрабатываем статус в клиенте

Теперь клиент может считать `NOT_FOUND` отсутствием товара и при этом сохранять все остальные сбои как ошибки. Замените содержимое `src/client.ts`:

```ts
import { credentials, status, type ServiceError } from "@grpc/grpc-js";
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

async function findItem(sku: string): Promise<Item | null> {
  try {
    return await getItem(sku);
  } catch (error) {
    if ((error as ServiceError).code === status.NOT_FOUND) {
      return null; // The service defines NOT_FOUND as an absent item.
    }
    throw error;
  }
}

const sku = process.argv[2] ?? "A-100";

try {
  const item = await findItem(sku);
  if (item) {
    console.log(`${item.sku}: ${item.name} (${item.quantity} in stock)`);
  } else {
    console.log(`No item with SKU ${sku}`);
  }
} catch (error) {
  const { code, details } = error as ServiceError;
  console.error(`GetItem failed with ${status[code]}: ${details}`);
} finally {
  client.close();
}
```

`findItem` возвращает `null` только при `NOT_FOUND`, а любую другую ошибку выбрасывает дальше. Благодаря этому вызывающий код отличает отсутствующий товар от неисправного сервиса. `status[code]` превращает число обратно в имя, например `INVALID_ARGUMENT`, — так логи читать гораздо проще.

## Решаем, что делать дальше

| Код | Значение | Типичная реакция клиента |
| --- | --- | --- |
| `NOT_FOUND` | Запрошенная сущность не найдена. | Считать это отсутствием, только если сервис определяет именно такой смысл. |
| `INVALID_ARGUMENT` | В запросе недопустимый аргумент. | Исправить входные данные; повтор того же запроса не поможет. |
| `UNAVAILABLE` | Сервис временно недоступен. | Рассмотреть ограниченное число повторов с растущими паузами, если повторять вызов безопасно. |
| `DEADLINE_EXCEEDED` | Вызов не завершился до своего deadline. | Сообщить о превышении времени или решить, безопасен ли новый вызов. Сервер мог всё-таки выполнить операцию. |

Эти коды описывают результат, а не универсальную политику повторов. `GetItem` только читает данные. Но если вызов изменяет данные, ошибка может прийти уже после того, как сервер выполнил действие. Прежде чем повторять вызов, выясните, безопасно ли повторять этот метод и что сервис говорит о повторах. Не повторяйте `INVALID_ARGUMENT` с теми же входными данными и не превращайте любой сбой в `NOT_FOUND`.

## Практика

1. Выполните `npm run client -- Z-999`. Клиент выведет `No item with SKU Z-999`: ошибка превратилась в обычный результат.

2. Выполните `npm run client -- ""`, чтобы отправить пустой SKU. Клиент выведет `GetItem failed with INVALID_ARGUMENT: SKU is required`.

3. Остановите сервер клавишами `Ctrl+C` и выполните `npm run client`. Клиент выведет `GetItem failed with UNAVAILABLE: No connection established.` и подробности о соединении. Этот код выставила сама клиентская библиотека: ни один сервер не ответил. Снова запустите сервер.

## Официальные ресурсы

- [Коды статуса gRPC](https://grpc.io/docs/guides/status-codes/)
- [Обработка ошибок в gRPC](https://grpc.io/docs/guides/error/)
- [Руководство по повторам в gRPC](https://grpc.io/docs/guides/retry/)
