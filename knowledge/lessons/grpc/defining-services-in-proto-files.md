---
slug: grpc/defining-services-in-proto-files
title: Defining Services in .proto Files
description: Read a gRPC service contract, identify its request and response messages, and change message fields safely.
tags:
  - grpc
  - protocol-buffers
  - go
---

A `.proto` file is the shared contract between a gRPC client and server. It names the operations the server offers and describes the messages sent in each direction. As a client developer, read this file before writing a call: it tells you which method to invoke and which fields to fill.

Here is the contract used in the following lessons. Save it as `inventory/v1/inventory.proto` if you want to generate a client from it later:

```proto
syntax = "proto3";

package inventory.v1;

option go_package = "example.com/inventory/gen/inventory/v1;inventoryv1";

service InventoryService {
  rpc GetItem(GetItemRequest) returns (Item);
  rpc WatchItems(WatchItemsRequest) returns (stream Item);
}

message GetItemRequest {
  string sku = 1;
}

message WatchItemsRequest {
  string category = 1;
}

message Item {
  string sku = 1;
  string name = 2;
  int32 quantity = 3;
}
```

## Read the service

`syntax = "proto3";` selects the proto3 language. The `package` gives these definitions the protobuf namespace `inventory.v1`, so their names do not collide with definitions from another API. The `go_package` option specifies the generated Go import path and, after the semicolon, the Go package name `inventoryv1`. It does not change the protobuf namespace.

A `service` groups remote methods. Each `rpc` declares one request type and one response type:

- `GetItem` takes one `GetItemRequest` and returns one `Item`. This is a unary call.
- `WatchItems` takes one `WatchItemsRequest` and returns a stream of `Item` messages. The `stream` keyword marks a server-streaming call; the client may receive multiple items from one request.

The service definition describes message shapes and call direction. It does not specify what happens when an SKU is missing, whether `WatchItems` sends a snapshot or live updates, or when its stream ends. Those behaviors need an API contract beyond this syntax.

## Read the messages

A `message` is a structured request or response. In `GetItemRequest`, `sku` is a string field. In `Item`, `quantity` is a signed 32-bit integer. The number after `=` is the field's wire identifier, not its display order. Field numbers must be unique *within a message*; the `sku = 1` fields in two different messages do not conflict.

When reading an unfamiliar contract, follow the method signature into its message definitions. For `GetItem`, you send a request with an SKU and receive an item with an SKU, name, and quantity. For `WatchItems`, you send a category and consume a sequence of items. A proto3 scalar such as `string` or `int32` has an implicit zero value when absent; `GetItemRequest` alone does not guarantee that the caller supplied a nonempty SKU. Such validation is part of the API's behavior.

## Keep field numbers stable

Once clients and servers use a message, do not change the number assigned to an existing field. For example, changing `Item.name` from `2` to `4` makes old and new programs interpret different wire fields. Adding a new field with an unused number is generally safe for protobuf binary compatibility because older readers can ignore a field they do not know, although the API still needs to define what an absent value means.

If you remove a field, reserve its old number so it cannot be assigned to a different meaning later. You can reserve its name too, which protects text and JSON representations. For example, after removing an old `legacy_code = 4` field from `Item`, its definition could include:

```proto
message Item {
  reserved 4;
  reserved "legacy_code";

  string sku = 1;
  string name = 2;
  int32 quantity = 3;
}
```

Try tracing both methods in the first contract: name the request type, response type, and whether each response is singular or a stream. Then identify which `Item` field number a future client must continue to use for `quantity`. The answers are `GetItemRequest` → one `Item`, `WatchItemsRequest` → a stream of `Item`, and `3` for `quantity`.

The next lesson uses this exact contract to generate a Go client.

## Official resources

- [Protocol Buffers proto3 language guide](https://protobuf.dev/programming-guides/proto3/)
- [Protocol Buffers Go generated code guide](https://protobuf.dev/reference/go/go-generated/)
- [gRPC Go basics: defining the service](https://grpc.io/docs/languages/go/basics/#defining-the-service)
