---
slug: grpc/handling-grpc-status-codes
title: Handling gRPC Status Codes
description: Return gRPC status codes from the Node.js service and handle missing, invalid, and unavailable cases in the TypeScript client.
tags:
  - grpc
  - typescript
  - error-handling
---

Every gRPC call ends with a `status`: a code and, when something fails, a description. A successful call has the code `OK`. A failed call has a `status code` that tells the client what kind of failure happened. This is separate from the HTTP status of the transport: a gRPC response can carry HTTP 200 and still report a non-OK gRPC status. So you cannot check `response.ok` the way you do with `fetch`; you check the gRPC code.

In `@grpc/grpc-js`, codes are members of the `status` enum, such as `status.NOT_FOUND`. A failed call gives the client a `ServiceError`. Its `code` field holds the number, and its `details` field holds the server's description.

## Return a status from the server

The `.proto` file does **not** say which code a service returns in which case. The service must decide and document it. For the course service, set these rules: an empty SKU is `INVALID_ARGUMENT`, and an unknown SKU is `NOT_FOUND`. In `src/server.ts`, update `getItem`:

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

Restart the server after the change.

## Handle the status in the client

The client can now treat `NOT_FOUND` as "no such item" and keep every other failure as an error. Replace `src/client.ts` with:

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

`findItem` returns `null` only for `NOT_FOUND` and throws every other error again. Its caller can then tell a missing item from a broken service. `status[code]` turns the number back into its name, such as `INVALID_ARGUMENT`, which makes logs easier to read.

## Decide what to do next

| Code | Meaning | Typical client response |
| --- | --- | --- |
| `NOT_FOUND` | The requested entity was not found. | Treat it as absence only if the service defines that meaning. |
| `INVALID_ARGUMENT` | The request has an invalid argument. | Fix the input; sending the same request again will not help. |
| `UNAVAILABLE` | The service is temporarily unavailable. | Consider a limited retry with growing delays if repeating the call is safe. |
| `DEADLINE_EXCEEDED` | The call did not finish before its deadline. | Report the timeout or decide whether a new call is safe. The server may still have completed the operation. |

These codes describe the result, not a universal retry policy. `GetItem` only reads data. For a call that changes data, an error may arrive after the server has already acted. Check whether the method is safe to repeat and what the service says about retries before you retry. Do not retry `INVALID_ARGUMENT` with unchanged input, and do not turn every failure into `NOT_FOUND`.

## Practice

1. Run `npm run client -- Z-999`. The client prints `No item with SKU Z-999`: the error became a normal result.

2. Run `npm run client -- ""` to send an empty SKU. The client prints `GetItem failed with INVALID_ARGUMENT: SKU is required`.

3. Stop the server with `Ctrl+C` and run `npm run client`. The client prints `GetItem failed with UNAVAILABLE: No connection established.` and connection details. This code comes from the client library itself: no server answered. Start the server again.

## Official resources

- [gRPC status codes](https://grpc.io/docs/guides/status-codes/)
- [gRPC error handling](https://grpc.io/docs/guides/error/)
- [gRPC retry guide](https://grpc.io/docs/guides/retry/)
