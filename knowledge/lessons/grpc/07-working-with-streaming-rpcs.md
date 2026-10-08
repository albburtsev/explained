---
slug: grpc/working-with-streaming-rpcs
title: Working with Streaming RPCs
description: Send a slow server stream from the Node.js service, read it with for await in a TypeScript client, and stop it early with cancel.
tags:
  - grpc
  - streaming
  - typescript
  - nodejs
---

A `streaming RPC` exchanges a sequence of messages within one call. In the course contract, `WatchItems` is a **server-streaming** method: the client sends one category, and the server can send many `Item` messages back.

```proto
rpc WatchItems(WatchItemsRequest) returns (stream Item);
```

The `stream` keyword before `Item` tells you that the response is a sequence, not a single `Item`. The `.proto` file does not say whether the server sends a finite list or keeps sending updates. Check the service's documentation before you decide how long your client should keep the call open.

## Slow down the server stream

The server from the earlier lesson writes all items at once, so the stream ends almost immediately. To see messages arrive one by one, replace `watchItems` in `src/server.ts` with a version that sends one item per second:

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

The handler returns right away, and the timer keeps writing to `call`. When all items are sent, `call.end()` closes the stream with an OK status. The `cancelled` event fires when the client cancels or disconnects, and the handler stops its timer then. The event can also fire after a normal end, so the handler only does cleanup that is safe to repeat. Restart the server after the change.

## Read the stream in the client

Create `src/watch.ts`:

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

`watchItems` returns at once with a `ClientReadableStream<Item>`, which is a Node.js readable stream. `for await` waits for each message and runs the loop body once per item. Node.js streams give `any` values to `for await`, so `as AsyncIterable<Item>` restores the item type.

The loop ends normally when the server closes the stream with an OK status, even if it sent zero items. If the call fails, the loop throws an error. In that case, treat the items you already received as a partial result, not a complete list. Some code reads the same stream with events instead: `call.on("data", ...)`, `call.on("error", ...)`, and `call.on("end", ...)`. Both styles work; `for await` keeps error handling in one `try` block.

Add a script and run the client while the server is running:

```sh
npm pkg set scripts.watch="tsx src/watch.ts"
npm run watch
```

The two furniture items arrive one second apart:

```text
B-200: Office chair (3)
B-300: Standing desk (5)
Stream finished
```

## Stop a stream early

A live stream may have no natural end, so the client must be able to stop it. Leaving the loop with `break` is **not** enough: the call stays open, and the server keeps sending. Call `call.cancel()` instead. The server receives the cancellation, and the client's loop throws an error with the status code `CANCELLED`. The client expects this error, so it should not report it as a failure.

## Recognize the other call shapes

The place of `stream` in a method signature tells you which side sends a sequence:

| Shape | Request side | Response side |
| --- | --- | --- |
| Unary | One message | One message |
| Server streaming | One message | Stream of messages |
| Client streaming | Stream of messages | One message |
| Bidirectional streaming | Stream of messages | Stream of messages |

`WatchItems` uses the second shape. The other shapes need different client code, but the first step is always the same: read the method signature in the `.proto` contract.

## Practice

1. Run `npm run watch -- garden`. No item has this category, so the client prints only `Stream finished`. An empty stream is still a successful call.

2. Make the client stop after the first item. In `src/watch.ts`, add `status` and the `ServiceError` type to the `@grpc/grpc-js` import, add a cancel call inside the loop, and handle `CANCELLED` in `catch`:

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

   Run `npm run watch`. The client prints `B-200: Office chair (3)` and then `Stopped watching`.

3. Replace `call.cancel()` with `break` and run the client again. It prints `Stream finished`, but the call was not cancelled: the server still runs its timer until it sends the last item. Put `call.cancel()` back.

## Official resources

- [gRPC Node.js basics: streaming RPCs](https://grpc.io/docs/languages/node/basics/#streaming-rpcs)
- [gRPC cancellation](https://grpc.io/docs/guides/cancellation/)
- [Node.js stream API](https://nodejs.org/api/stream.html)
