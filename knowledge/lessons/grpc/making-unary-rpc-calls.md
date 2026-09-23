---
slug: grpc/making-unary-rpc-calls
title: Making Unary RPC Calls
description: Create a Go gRPC client, send one GetItem request, and read its response.
tags:
  - grpc
  - go
---

A `unary RPC` sends one request and receives one response. In the inventory contract from the earlier lesson, `InventoryService.GetItem` accepts a `GetItemRequest` with an SKU and returns an `Item`. The generated Go client turns that contract into a method you can call.

## Call GetItem

Assuming you have generated the Go package declared by `inventory/v1/inventory.proto` and a local server implements that service on port 50051, this program requests one item:

```go
package main

import (
    "context"
    "fmt"
    "log"

    inventoryv1 "example.com/inventory/gen/inventory/v1"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

func main() {
    conn, err := grpc.NewClient(
        "localhost:50051",
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    client := inventoryv1.NewInventoryServiceClient(conn)
    item, err := client.GetItem(
        context.Background(),
        &inventoryv1.GetItemRequest{Sku: "A-100"},
    )
    if err != nil {
        log.Fatalf("GetItem failed: %v", err)
    }

    fmt.Printf("%s: %s (%d in stock)\n", item.GetSku(), item.GetName(), item.GetQuantity())
}
```

`grpc.NewClient` creates a reusable client connection object; it does not contact the server yet. `NewInventoryServiceClient` wraps that connection with the methods generated from `InventoryService`. The `GetItem` call sends the request and waits for either an `Item` or an error. Its first argument is a Go `context.Context`, which lets the caller control the lifetime of the call. This first example uses `context.Background()` to keep the call visible; a later lesson adds a deadline and cancellation.

Check `err` before reading `item`. If the RPC fails, there is no successful response to use. The specific gRPC status carried by an error is covered in the status-code lesson. The printed values depend on the server's data; `A-100` and port 50051 are example inputs, not guaranteed results or a server supplied by this course.

## Choose transport credentials

`insecure.NewCredentials()` disables transport security. Use it only when talking to a local development server that is explicitly configured for plaintext gRPC. For a remote server with a TLS certificate trusted by the macOS system, use TLS transport credentials instead:

```go
conn, err := grpc.NewClient(
    "inventory.example.com:443",
    grpc.WithTransportCredentials(credentials.NewClientTLSFromCert(nil, "")),
)
```

In that alternative, import `google.golang.org/grpc/credentials` in place of `google.golang.org/grpc/credentials/insecure`. Replace the example address with the server's actual host and port. TLS checks the server certificate against the host name; a service using a private CA or mutual TLS needs credentials configured for that contract.

To check your understanding, change the SKU in the request and locate the line that would report an RPC failure. Notice that changing the request does not require changing the generated client method or constructing an HTTP request yourself.

## Official resources

- [gRPC Go basics: creating a client and calling methods](https://grpc.io/docs/languages/go/basics/#creating-the-client)
- [gRPC Go generated client methods](https://grpc.io/docs/languages/go/generated-code/#methods-on-generated-client-interfaces)
- [grpc-go `NewClient` API](https://pkg.go.dev/google.golang.org/grpc#NewClient)
- [grpc-go transport credentials](https://pkg.go.dev/google.golang.org/grpc/credentials#NewClientTLSFromCert)
