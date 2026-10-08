---
slug: grpc/defining-services-in-proto-files
title: Defining Services in .proto Files
description: Start the course project, write a gRPC service contract, and learn how to change message fields safely.
tags:
  - grpc
  - protocol-buffers
---

A `.proto` file is the shared contract between a gRPC client and server. It names the operations the server offers and describes the messages sent in each direction. Both sides generate code from it, so read it before you write a call or a service.

In this lesson, you start the project that the rest of the course builds on: a small inventory service. Here is its contract:

```proto
syntax = "proto3";

package inventory.v1;

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
  string category = 3;
  int32 quantity = 4;
}
```

## Read the service

`syntax = "proto3";` selects the proto3 language. The `package` gives these definitions the protobuf namespace `inventory.v1`, so their names do not collide with definitions from another API. The `v1` part is a common way to version a contract.

A `service` groups remote methods. Each `rpc` declares one request type and one response type:

- `GetItem` takes one `GetItemRequest` and returns one `Item`. This is a unary call.
- `WatchItems` takes one `WatchItemsRequest` and returns a stream of `Item` messages. The `stream` keyword marks a server-streaming call: the client may receive many items from one request.

The service definition describes message shapes and call direction. It does not say what happens when an SKU is missing, or when the `WatchItems` stream ends. The team that owns the service must describe that behavior separately, for example in comments or documentation.

## Read the messages

A `message` is a structured request or response. In `GetItemRequest`, `sku` is a string field. In `Item`, `quantity` is a signed 32-bit integer. The number after `=` is the field's `field number`: it identifies the field in the binary data, and it is not a display order. Field numbers must be unique *within a message*; the `sku = 1` fields in two different messages do not conflict.

To read an unfamiliar contract, follow the method signature into its message definitions. For `GetItem`, you send a request with an SKU and receive an item with an SKU, name, category, and quantity. For `WatchItems`, you send a category and read a sequence of items.

In proto3, a missing scalar field has a zero value: an empty string or `0`. So `GetItemRequest` alone does not guarantee that the caller sent a non-empty SKU. The server must check that itself; you will do this in a later lesson.

## Keep field numbers stable

Once clients and servers use a message, do not change the number of an existing field. For example, if you change `Item.name` from `2` to `5`, old and new programs will read different fields from the same data. Adding a new field with an unused number is generally safe: older programs skip a field they do not know. The API still needs to define what an absent value means.

If you remove a field, reserve its old number so nobody can reuse it with a different meaning later. You can reserve its name too, which protects the JSON form of the message. For example, after you remove an old `legacy_code = 5` field from `Item`, its definition could look like this:

```proto
message Item {
  reserved 5;
  reserved "legacy_code";

  string sku = 1;
  string name = 2;
  string category = 3;
  int32 quantity = 4;
}
```

## Practice

1. Create the course project on macOS. You need Node.js v20+. In a terminal, run:

   ```sh
   mkdir inventory
   cd inventory
   npm init -y
   mkdir -p proto/inventory/v1
   ```

   Save the contract from the start of this lesson as `proto/inventory/v1/inventory.proto`. Keep it unchanged: the next lessons generate code from this exact file.

2. Trace both methods in the contract. Name the request type, the response type, and whether the response is one message or a stream. The answers are `GetItemRequest` → one `Item`, and `WatchItemsRequest` → a stream of `Item`.

3. Imagine a future version of `Item` without the `category` field. Write the lines that protect its old number and name. The answer is `reserved 3;` and `reserved "category";`. The number `4` must stay with `quantity`.

## Official resources

- [Protocol Buffers proto3 language guide](https://protobuf.dev/programming-guides/proto3/)
- [Protocol Buffers: updating a message type](https://protobuf.dev/programming-guides/proto3/#updating)
- [gRPC Node.js basics: defining the service](https://grpc.io/docs/languages/node/basics/#defining-the-service)
