---
slug: grpc/generating-a-grpc-client
title: Generating a gRPC Client
description: Generate Go message and client code from a service contract and identify the API your application will use.
tags:
  - grpc
  - protocol-buffers
  - go
---

The `.proto` contract describes a service, but Go cannot call it directly. A `generated client` turns its methods and messages into Go types. Use the contract published by the service owner, including any files it imports; you do not need the server's implementation.

## Generate from the contract

On macOS, this example needs Go v1.25+, `protoc` v3+, and the `protoc-gen-go` and `protoc-gen-go-grpc` plugins available to `protoc`. Use the previous lesson's `inventory/v1/inventory.proto` in a Go module named `example.com/inventory`. From that module's root, run:

```sh
protoc --go_out=. --go_opt=module=example.com/inventory \
  --go-grpc_out=. --go-grpc_opt=module=example.com/inventory \
  inventory/v1/inventory.proto
```

This creates two files under `gen/inventory/v1/`, matching the contract's `go_package` import path:

| File | What it provides |
| --- | --- |
| `inventory.pb.go` | Go types for `GetItemRequest`, `WatchItemsRequest`, and `Item`, plus message encoding support. |
| `inventory_grpc.pb.go` | The `InventoryServiceClient` interface, `NewInventoryServiceClient` constructor, and method implementations that use gRPC. |

`protoc` reads the contract. Its `--go_out` flag calls `protoc-gen-go` for messages; `--go-grpc_out` calls `protoc-gen-go-grpc` for service code. The `module=` options remove the module prefix from the `go_package` path when choosing output directories. Without them, the default import-path layout would put files beneath an extra `example.com/inventory/` directory. Regenerate both files when the service contract changes; do not hand-edit generated code.

## Find the client API

The generated package is `inventoryv1`, imported from `example.com/inventory/gen/inventory/v1`. In it, `NewInventoryServiceClient` takes a gRPC connection and returns an `InventoryServiceClient`. Its methods correspond to the two RPCs in the contract:

```go
GetItem(ctx context.Context, in *GetItemRequest, opts ...grpc.CallOption) (*Item, error)
WatchItems(ctx context.Context, in *WatchItemsRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[Item], error)
```

`GetItem` returns one item or an error. `WatchItems` returns an object from which the caller receives a sequence of items. These signatures tell you which request to construct and what result to handle; the next lessons show how to connect and call them.

If the service owner already publishes a generated Go package for this contract, depend on that package instead of generating a second copy. Check its contract version and import path before writing your client.

For practice, locate `GetItemRequest` in `inventory.pb.go` and `InventoryServiceClient` in `inventory_grpc.pb.go`. Which file would you inspect to learn the Go type of `Item.quantity`? It is `inventory.pb.go`.

## Official resources

- [gRPC Go quick start: regenerate gRPC code](https://grpc.io/docs/languages/go/quickstart/#regenerate-grpc-code)
- [gRPC-Go v1.84.0 module requirements](https://github.com/grpc/grpc-go/blob/v1.84.0/go.mod)
- [Protocol Buffers Go generated code guide](https://protobuf.dev/reference/go/go-generated/)
- [gRPC-Go stream API](https://pkg.go.dev/google.golang.org/grpc#ServerStreamingClient)
- [gRPC-Go client code generator](https://github.com/grpc/grpc-go/blob/master/cmd/protoc-gen-go-grpc/grpc.go)
