---
slug: grpc/implementing-a-grpc-service
title: Implementing a gRPC Service in Node.js
description: Implement the generated service interface in TypeScript, start a gRPC server on Node.js, and test it with buf curl.
tags:
  - grpc
  - typescript
  - nodejs
---

A client needs a server to call. In this lesson, you write the inventory service from the course contract and run it on Node.js. The generated `InventoryServiceServer` interface tells you which methods to write and which types they receive. TypeScript reports an error if a method is missing or returns the wrong shape.

## Write the service

Create `src/server.ts` in the `inventory` project:

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

The import ends in `.js` although the file is `inventory.ts`. This is how TypeScript writes relative imports in Node.js ES modules, and `tsx` finds the `.ts` file.

## How the handlers work

Each method in `inventoryService` is a `handler`: a function that the server calls when a request arrives. The data stays in an in-memory array to keep the example short; a real service would read a database or another API.

- `getItem` is unary. `call.request` holds the decoded `GetItemRequest`. You answer exactly once through `callback`: `callback(null, item)` sends a response, and `callback({ code, details })` ends the call with an error status. Here, an unknown SKU gets `NOT_FOUND`. A later lesson covers status codes in detail.
- `watchItems` is server-streaming. Instead of a callback, it writes messages to `call` with `call.write()`. `call.end()` closes the stream with an OK status. Until you call `end()`, the client keeps waiting for more messages.

The last block starts the server. `addService` connects the implementation to `InventoryServiceService`, the generated definition with method paths and message converters. `bindAsync` opens the port and calls its callback when the server is ready. `ServerCredentials.createInsecure()` turns off TLS, which is fine for a local development server. A server that other machines reach needs TLS credentials.

## Run and test the server

Add a script and start the server:

```sh
npm pkg set scripts.server="tsx src/server.ts"
npm run server
```

The terminal prints:

```text
Inventory service listening on port 50051
```

The server keeps running until you press `Ctrl+C`. You have no client yet, but `buf` includes `buf curl`, which works like `curl` for gRPC. Open a second terminal in the project and call `GetItem`:

```sh
npx buf curl --protocol grpc --http2-prior-knowledge --schema proto \
  --data '{"sku": "A-100"}' \
  http://localhost:50051/inventory.v1.InventoryService/GetItem
```

`--schema proto` tells `buf curl` to read the contract from the `proto` folder, so you can write the request as JSON. `--http2-prior-knowledge` uses HTTP/2 without TLS, which matches the insecure server. The URL ends with the method path you found in the generated code. The response is the item as JSON:

```json
{
  "sku": "A-100",
  "name": "Desk lamp",
  "category": "lighting",
  "quantity": 12
}
```

## Practice

1. Call `GetItem` with the SKU `Z-999`. `buf curl` prints an error with the code `not_found` and the message `Item Z-999 not found`.

2. Call the streaming method: change the URL to end with `WatchItems` and the data to `{"category": "furniture"}`. You receive two JSON objects, `B-200` and `B-300`, and then the command ends because the server called `call.end()`.

3. Add a fourth item to the `items` array, for example `{ sku: "C-400", name: "Bookshelf", category: "furniture", quantity: 7 }`. Restart the server and repeat task 2. Then remove the `quantity` property from that item and run `npm run typecheck`: TypeScript reports that `quantity` is missing, because the array uses the generated `Item` type. Put the property back.

## Official resources

- [gRPC Node.js basics: creating the server](https://grpc.io/docs/languages/node/basics/#server)
- [`@grpc/grpc-js` package](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js)
- [Buf: `buf curl` reference](https://buf.build/docs/reference/cli/buf/curl/)
