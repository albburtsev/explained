---
slug: grpc/how-grpc-works
title: How gRPC Works
description: Follow a gRPC call from a service contract through a generated client to a response or status.
tags:
  - grpc
  - rpc
  - protocol-buffers
---

With `gRPC`, a client calls a method implemented by another process. This is a `remote procedure call` (RPC): it looks like a method call in client code, but the request crosses a network before the server runs it.

Consider a client that needs a book title. A shared `.proto` contract could declare:

```proto
syntax = "proto3";
package catalog.v1;

service Catalog {
  rpc GetBook (GetBookRequest) returns (GetBookResponse);
}

message GetBookRequest {
  string id = 1;
}

message GetBookResponse {
  string title = 1;
}
```

Here, a `service` groups callable operations, `GetBook` is a `method`, and each `message` defines the shape of data sent in one direction. The client sends a `GetBookRequest` containing an ID; on success, the server sends a `GetBookResponse` containing a title. You will work with the contract syntax in a later lesson.

## Follow one call

1. Generate client code from the same contract the server implements. The generated client, also called a `stub`, exposes `GetBook` with the declared request and response types.
2. The application calls that method with a request message. The gRPC runtime serializes the message, sends it to the server over HTTP/2, and identifies the target service and method.
3. The server decodes the request, runs its implementation of `GetBook`, and sends back a response if the call succeeds.
4. The client receives a response with an OK `status`, or a non-OK status describing why the call failed.

By default, gRPC uses `Protocol Buffers` to define the contract and encode messages. The client and server can be written in different languages as long as they agree on that contract. The example is a `unary` call: one request produces one response. gRPC also supports calls that stream messages in either or both directions.

## Remember the network boundary

The generated method makes the call convenient; it does not make it local. A call can take time, lose its connection, or finish on the server after the client has stopped waiting. Client code therefore needs to handle statuses and set a `deadline`, a limit on how long it will wait. Later lessons show how to do both in Go.

To check the model, look at the contract above and identify the service, method, request type, and response type. Then ask: which parts must the client know before it can call the server? It needs the service contract, generated client code, and a way to reach the server; it does not need the server's implementation code.

## Official resources

- [Introduction to gRPC](https://grpc.io/docs/what-is-grpc/introduction/)
- [Core concepts and RPC lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/)
