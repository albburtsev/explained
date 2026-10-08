---
slug: grpc/deadlines-cancellation-and-metadata
title: Deadlines, Cancellation, and Metadata
description: Limit a TypeScript gRPC call with a deadline, cancel it with an AbortSignal, and send a request ID that the Node.js service reads.
tags:
  - grpc
  - typescript
  - nodejs
---

The client from the earlier lessons waits for `GetItem` as long as it takes. That is risky: in a backend-for-frontend, a slow service makes the whole page wait. Every generated client method accepts two extra arguments that control a single call: `Metadata` and call options. In this lesson, you use them to add a time limit, a way to cancel, and a request ID.

## Add a deadline and metadata

In `src/client.ts`, add `Metadata` to the import from `@grpc/grpc-js` and replace the `getItem` function:

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

A `deadline` is the point in time after which the client stops waiting. Here, it is two seconds from now; choose a limit that fits the service's normal speed. When the deadline passes, the call fails with `DEADLINE_EXCEEDED`. gRPC also sends the deadline to the server, so the server can see that the client stopped waiting and give up too. The server may still finish work it has already started.

`Metadata` is key-value information about a call. It travels as HTTP/2 headers, separate from the protobuf request and response messages. It works like the headers you pass to `fetch`. Keys are lowercase. Here, `x-request-id` carries a random ID that helps match client logs with server logs. A server reads only the keys it knows, so follow the service's documentation for the keys it expects.

If metadata carries credentials, such as an `authorization` token, use TLS for the connection and never log the secret value. A request ID is not a credential.

## Read the metadata on the server

In `src/server.ts`, add two lines at the start of `getItem`:

```ts
  getItem(call, callback) {
    const requestId = call.metadata.get("x-request-id")[0] ?? "none";
    console.log(`GetItem ${call.request.sku} (request ${requestId})`);
```

`call.metadata.get` returns an array, because a key can have several values. Restart the server and run `npm run client`. The client prints the item as before, and the server terminal prints a line like `GetItem A-100 (request 9b2f...)` with a new ID on every call.

## Cancel a call

`Cancellation` means the client no longer needs the result. Each call returns an object with a `cancel()` method. Frontend and Node.js code often uses an `AbortSignal` for the same idea, so connect the two. Give `getItem` an optional signal and cancel the call when the signal aborts:

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

A cancelled call fails with the code `CANCELLED`. The server learns about the cancellation, but it cannot undo work it has already done. In a backend-for-frontend, you can pass the signal of the incoming request, so the gRPC call stops when the user leaves the page. For a stream, the earlier lesson used the same `cancel()` method.

## Practice

1. Make the service slow. In `getItem` on the server, replace the last line, `callback(null, item);`, with a delayed answer:

   ```ts
       setTimeout(() => {
         if (call.cancelled) {
           console.log("GetItem cancelled by the client");
           return;
         }
         callback(null, item);
       }, 3000);
   ```

   Restart the server and run `npm run client`. After about two seconds, the client prints `GetItem failed with DEADLINE_EXCEEDED: Deadline exceeded after` and timing details. A second later, the server prints `GetItem cancelled by the client`: `call.cancelled` became `true` when the deadline passed.

2. Cancel the call before the deadline. Make `findItem` accept a signal and pass it on, then call it with a signal that aborts after half a second:

   ```ts
   async function findItem(sku: string, signal?: AbortSignal): Promise<Item | null> {
     try {
       return await getItem(sku, signal);
   ```

   ```ts
     const item = await findItem(sku, AbortSignal.timeout(500));
   ```

   Run `npm run client`. The client prints `GetItem failed with CANCELLED: Cancelled on client`.

3. Change the server delay from `3000` to `100` and restart it. The call now ends well before both limits, and the client prints `A-100: Desk lamp (12 in stock)`. Neither the deadline nor the signal changes the `GetItemRequest` message.

## Official resources

- [gRPC deadlines](https://grpc.io/docs/guides/deadlines/)
- [gRPC cancellation](https://grpc.io/docs/guides/cancellation/)
- [gRPC metadata](https://grpc.io/docs/guides/metadata/)
- [`AbortSignal` in Node.js](https://nodejs.org/api/globals.html#class-abortsignal)
