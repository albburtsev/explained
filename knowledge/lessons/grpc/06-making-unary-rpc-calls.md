---
slug: grpc/making-unary-rpc-calls
title: Making Unary RPC Calls
description: Create a TypeScript gRPC client, wrap its callback method in a Promise, and call GetItem on the course server.
tags:
  - grpc
  - typescript
  - nodejs
---

A `unary RPC` sends one request and receives one response. In the course contract, `InventoryService.GetItem` takes a `GetItemRequest` with an SKU and returns an `Item`. In this lesson, you call it from a TypeScript client with the generated `InventoryServiceClient`.

## Write the client

Create `src/client.ts` in the `inventory` project:

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

`new InventoryServiceClient` takes the server address and transport credentials. It does not connect yet; the connection opens on the first call. One client can make many calls at the same time, so create it once and reuse it. In a long-running Node.js server, such as a backend-for-frontend, keep one client for the whole process instead of creating one per request.

The generated `getItem` method reports its result through a Node.js-style callback: an error, or `null` and the response. The small `getItem` function turns that callback into a Promise, so the rest of the code can use `async` and `await`. A typed wrapper like this is better than `util.promisify`, which does not keep the types of the method's overloads.

The request is a plain object, `{ sku }`. TypeScript checks it against the generated `GetItemRequest` interface, and the response has the `Item` type. If you misspell a field, the type check fails before the code runs.

`client.close()` closes the connection, so the script can exit when the work is done. The project uses ES modules, so the file can use `await` at the top level, outside an `async` function.

## Run the client

Make sure the server from the previous lesson is running in another terminal. Then add a script and run the client:

```sh
npm pkg set scripts.client="tsx src/client.ts"
npm run client
```

The client prints:

```text
A-100: Desk lamp (12 in stock)
```

## Choose transport credentials

`credentials.createInsecure()` turns off transport security. Use it only for a local development server, like the course server, that is set up for plaintext gRPC. A real service on the network uses TLS. If its certificate comes from a public certificate authority, create the client with `credentials.createSsl()`:

```ts
const client = new InventoryServiceClient("inventory.example.com:443", credentials.createSsl());
```

Replace the example address with the server's real host and port. A service that uses a private certificate authority or mutual TLS needs extra arguments for `createSsl()`; follow that service's instructions.

## Practice

1. Ask for a different item: run `npm run client -- B-200`. The text after `--` reaches the script as `process.argv[2]`. The client prints `B-200: Office chair (3 in stock)`.

2. Ask for an item that does not exist: run `npm run client -- Z-999`. The client prints `GetItem failed: 5 NOT_FOUND: Item Z-999 not found`. The message starts with the numeric status code and its name; you will handle them properly in a later lesson.

3. Replace the line with `await getItem(sku)` and the line after it with two parallel calls through the same client:

   ```ts
   const [lamp, chair] = await Promise.all([getItem("A-100"), getItem("B-200")]);
   console.log(`${lamp.name} and ${chair.name}`);
   ```

   The client prints `Desk lamp and Office chair`. Then restore the original two lines for the next lessons.

## Official resources

- [gRPC Node.js basics: creating the client](https://grpc.io/docs/languages/node/basics/#client)
- [`@grpc/grpc-js` package](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js)
- [gRPC authentication guide](https://grpc.io/docs/guides/auth/)
