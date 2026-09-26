---
slug: grpc/deadlines-cancellation-and-metadata
title: Deadlines, Cancellation, and Metadata
description: Bound a Go gRPC call, cancel work that is no longer needed, and attach outgoing call metadata.
tags:
  - grpc
  - go
---

Every generated Go client method accepts a `context.Context`. Use it to control an individual call's lifetime and attach information that travels alongside the request. The earlier `GetItem` example passed `context.Background()` directly; this version gives the call a time limit and a request ID.

## Bound the call and attach metadata

```go
import (
    "context"
    "fmt"
    "time"

    inventoryv1 "example.com/inventory/gen/inventory/v1"
    "google.golang.org/grpc/metadata"
)

func getItem(parent context.Context, client inventoryv1.InventoryServiceClient, sku, requestID string) (*inventoryv1.Item, error) {
    ctx, cancel := context.WithTimeout(parent, 2*time.Second)
    defer cancel()

    ctx = metadata.AppendToOutgoingContext(ctx, "x-request-id", requestID)
    item, err := client.GetItem(ctx, &inventoryv1.GetItemRequest{Sku: sku})
    if err != nil {
        return nil, fmt.Errorf("GetItem: %w", err)
    }
    return item, nil
}
```

A `deadline` is the point in time after which the client stops waiting. `context.WithTimeout` sets one relative to when the context is created. The two-second value is an example; choose a limit that fits the service's expected latency. If the parent context has an earlier deadline or is canceled, the call stops sooner. Always call the returned `cancel` function, even after a successful call, to release resources associated with the timer.

`Cancellation` means the caller no longer needs the call. The caller can cancel the parent context when it abandons the request; the derived context then cancels the RPC. For a long-running `WatchItems` stream, cancel its context when you stop reading early. Cancellation signals the server to stop work, but it cannot guarantee the server has not already acted.

`Metadata` is key-value call information sent as HTTP/2 headers or trailers, separate from the protobuf request and response messages. `AppendToOutgoingContext` adds outgoing metadata without replacing metadata already on the context. Here, `x-request-id` can help correlate this call with server logs if the service recognizes that key. Do not assume a server understands arbitrary metadata keys; follow its API contract.

If metadata carries credentials, use TLS transport credentials for the connection and never log secret values. The earlier unary-call lesson shows how to configure a TLS connection. A request ID is not itself a credential.

For practice, suppose `GetItem` normally takes 100 ms but hangs for five seconds. With the example's two-second timeout, the client stops waiting around the deadline. Then suppose the caller cancels `parent` after 50 ms: that earlier cancellation takes precedence. Neither case changes the `GetItemRequest` message.

## Official resources

- [gRPC deadlines](https://grpc.io/docs/guides/deadlines/)
- [gRPC cancellation](https://grpc.io/docs/guides/cancellation/)
- [gRPC metadata](https://grpc.io/docs/guides/metadata/)
- [Go context package](https://pkg.go.dev/context)
- [grpc-go metadata package](https://pkg.go.dev/google.golang.org/grpc/metadata#AppendToOutgoingContext)
