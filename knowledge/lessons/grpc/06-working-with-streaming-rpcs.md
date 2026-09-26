---
slug: grpc/working-with-streaming-rpcs
title: Working with Streaming RPCs
description: Read a server-streaming gRPC call in Go, including successful completion and receive errors.
tags:
  - grpc
  - streaming
  - go
---

A `streaming RPC` can exchange a sequence of messages within one call. In the inventory contract from the earlier lessons, `WatchItems` is a **server-streaming** method: the client sends one category and the server can send multiple `Item` messages back.

```proto
rpc WatchItems(WatchItemsRequest) returns (stream Item);
```

The `stream` keyword before `Item` tells you that the response is a sequence, not a single `Item`. The `.proto` file does not say whether the server sends a finite snapshot or keeps sending updates. Check the service's behavior before deciding how long your client should keep the call open.

## Receive items in Go

With the generated `InventoryServiceClient`, call `WatchItems` once and then call `Recv` repeatedly on the returned stream:

```go
import (
    "context"
    "errors"
    "fmt"
    "io"

    inventoryv1 "example.com/inventory/gen/inventory/v1"
)

func watchItems(ctx context.Context, client inventoryv1.InventoryServiceClient, category string) error {
    stream, err := client.WatchItems(ctx, &inventoryv1.WatchItemsRequest{
        Category: category,
    })
    if err != nil {
        return fmt.Errorf("start WatchItems: %w", err)
    }

    for {
        item, err := stream.Recv()
        if errors.Is(err, io.EOF) {
            return nil // The server finished successfully.
        }
        if err != nil {
            return fmt.Errorf("receive WatchItems item: %w", err)
        }
        fmt.Printf("%s: %s (%d)\n", item.GetSku(), item.GetName(), item.GetQuantity())
    }
}
```

Each successful `Recv` returns one `Item`. It may wait while the server prepares the next message. `io.EOF` means the server ended the stream with an OK gRPC status, including when it sent zero items. Any other error means the call did not complete successfully; return or handle it rather than treating the messages already received as a complete result. The next lesson shows how to interpret gRPC status codes.

A live stream may have no natural end. The caller should control how long it stays open through the call's context; the final lesson covers deadlines and cancellation. If you stop reading early, cancel that context so the call can release its resources.

## Recognize the other call shapes

The placement of `stream` in a method signature tells you which side sends a sequence:

| Shape | Request side | Response side |
| --- | --- | --- |
| Unary | One message | One message |
| Server streaming | One message | Stream of messages |
| Client streaming | Stream of messages | One message |
| Bidirectional streaming | Stream of messages | Stream of messages |

`WatchItems` uses the second shape. Other shapes require different client loops, but the first step is always to read the method signature in the `.proto` contract.

For practice, consider a `WatchItems` call that returns two items and then a non-EOF error. Which branch does the function take, and can the caller claim it received the complete set? It returns an error, so the two items are only a partial result.

## Official resources

- [gRPC Go basics: server-side streaming RPC](https://grpc.io/docs/languages/go/basics/#server-side-streaming-rpc)
- [gRPC Go `ServerStreamingClient` API](https://pkg.go.dev/google.golang.org/grpc#ServerStreamingClient)
