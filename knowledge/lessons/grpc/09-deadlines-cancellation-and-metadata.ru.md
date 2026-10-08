---
slug: grpc/deadlines-cancellation-and-metadata
title: Deadline, отмена и metadata
description: Ограничьте gRPC-вызов на TypeScript с помощью deadline, отмените его через AbortSignal и передайте идентификатор запроса, который прочитает сервис на Node.js.
---

Клиент из прошлых уроков ждёт `GetItem` столько, сколько потребуется. Это рискованно: в backend-for-frontend один медленный сервис заставляет ждать всю страницу. Каждый сгенерированный метод клиента принимает два дополнительных аргумента, которые управляют отдельным вызовом: `Metadata` и параметры вызова. В этом уроке вы с их помощью добавите ограничение по времени, возможность отмены и идентификатор запроса.

## Добавляем deadline и metadata

В `src/client.ts` добавьте `Metadata` в импорт из `@grpc/grpc-js` и замените функцию `getItem`:

```ts
import { credentials, Metadata, status, type ServiceError } from "@grpc/grpc-js";
```

```ts
function getItem(sku: string): Promise<Item> {
  const metadata = new Metadata();
  metadata.set("x-request-id", crypto.randomUUID());
  const options = { deadline: Date.now() + 2000 };

  return new Promise((resolve, reject) => {
    client.getItem({ sku }, metadata, options, (error, item) => {
      if (error) {
        reject(error);
      } else {
        resolve(item);
      }
    });
  });
}
```

`Deadline` — момент времени, после которого клиент перестаёт ждать. Здесь это две секунды от текущего момента; выбирайте предел, соответствующий обычной скорости сервиса. Когда deadline наступает, вызов завершается с `DEADLINE_EXCEEDED`. gRPC передаёт deadline и серверу, так что сервер может увидеть, что клиент больше не ждёт, и тоже прекратить работу. Впрочем, уже начатую работу сервер может и довести до конца.

`Metadata` — сведения о вызове в виде пар «ключ — значение». Они передаются как заголовки HTTP/2, отдельно от сообщений запроса и ответа protobuf, и похожи на заголовки, которые вы передаёте в `fetch`. Ключи записываются строчными буквами. Здесь `x-request-id` несёт случайный идентификатор, который помогает сопоставить логи клиента с логами сервера. Сервер читает только известные ему ключи, поэтому сверяйтесь с документацией сервиса.

Если metadata несут учётные данные, например токен `authorization`, используйте для соединения TLS и никогда не записывайте секрет в логи. Идентификатор запроса учётными данными не является.

## Читаем metadata на сервере

В `src/server.ts` добавьте две строки в начало `getItem`:

```ts
  getItem(call, callback) {
    const requestId = call.metadata.get("x-request-id")[0] ?? "none";
    console.log(`GetItem ${call.request.sku} (request ${requestId})`);
```

`call.metadata.get` возвращает массив, потому что у одного ключа может быть несколько значений. Перезапустите сервер и выполните `npm run client`. Клиент, как и раньше, выведет товар, а в терминале сервера появится строка вроде `GetItem A-100 (request 9b2f...)` — с новым идентификатором при каждом вызове.

## Отменяем вызов

`Отмена` (cancellation) означает, что результат клиенту больше не нужен. Каждый вызов возвращает объект с методом `cancel()`. Во фронтенд-коде и в Node.js для той же идеи обычно используют `AbortSignal`, так что свяжите одно с другим. Передайте в `getItem` необязательный сигнал и отменяйте вызов, когда он сработает:

```ts
function getItem(sku: string, signal?: AbortSignal): Promise<Item> {
  const metadata = new Metadata();
  metadata.set("x-request-id", crypto.randomUUID());
  const options = { deadline: Date.now() + 2000 };

  return new Promise((resolve, reject) => {
    const call = client.getItem({ sku }, metadata, options, (error, item) => {
      if (error) {
        reject(error);
      } else {
        resolve(item);
      }
    });
    signal?.addEventListener("abort", () => call.cancel());
  });
}
```

Отменённый вызов завершается с кодом `CANCELLED`. Сервер узнаёт об отмене, но не может откатить то, что уже успел сделать. В backend-for-frontend можно передавать сигнал входящего запроса — тогда gRPC-вызов прекратится, как только пользователь уйдёт со страницы. Для потока в прошлом уроке использовался тот же метод `cancel()`.

## Практика

1. Сделайте сервис медленным. В серверном `getItem` замените последнюю строку, `callback(null, item);`, отложенным ответом:

   ```ts
       setTimeout(() => {
         if (call.cancelled) {
           console.log("GetItem cancelled by the client");
           return;
         }
         callback(null, item);
       }, 3000);
   ```

   Перезапустите сервер и выполните `npm run client`. Примерно через две секунды клиент выведет `GetItem failed with DEADLINE_EXCEEDED: Deadline exceeded after` и подробности о времени. Ещё через секунду сервер напишет `GetItem cancelled by the client`: `call.cancelled` стал равен `true`, как только наступил deadline.

2. Отмените вызов раньше deadline. Пусть `findItem` принимает сигнал и передаёт его дальше; затем вызовите её с сигналом, который срабатывает через полсекунды:

   ```ts
   async function findItem(sku: string, signal?: AbortSignal): Promise<Item | null> {
     try {
       return await getItem(sku, signal);
   ```

   ```ts
     const item = await findItem(sku, AbortSignal.timeout(500));
   ```

   Выполните `npm run client`. Клиент выведет `GetItem failed with CANCELLED: Cancelled on client`.

3. Замените задержку на сервере с `3000` на `100` и перезапустите его. Теперь вызов завершается задолго до обоих пределов, и клиент выводит `A-100: Desk lamp (12 in stock)`. Ни deadline, ни сигнал не меняют сообщение `GetItemRequest`.

## Официальные ресурсы

- [Deadline в gRPC](https://grpc.io/docs/guides/deadlines/)
- [Отмена вызовов в gRPC](https://grpc.io/docs/guides/cancellation/)
- [Metadata в gRPC](https://grpc.io/docs/guides/metadata/)
- [`AbortSignal` в Node.js](https://nodejs.org/api/globals.html#class-abortsignal)
