---
slug: grpc/grpc-vs-rest
title: gRPC vs REST
description: Compare gRPC methods with the REST and fetch workflow you know, and see what changes when you write a client.
tags:
  - grpc
  - rest
  - api-design
---

`REST` is an architectural style centered on resources and a uniform interface. `gRPC` is a framework for calling named service methods. They solve overlapping API problems, but they do not define the same kind of interface.

Imagine an API that returns an order. A typical resource-oriented HTTP API might expose `GET /orders/42`. In frontend code, you call it with `fetch`, check `response.ok`, parse the JSON, and trust that it matches a TypeScript type you wrote by hand. A gRPC API might define `OrderService.GetOrder` with a `GetOrderRequest` that contains the order ID. The client calls that method through generated code and receives a typed `Order` message. These are two example API designs, not two wire formats for the same endpoint.

| Question | Resource-oriented HTTP API | gRPC API |
| --- | --- | --- |
| What identifies the operation? | An HTTP method and a resource URI, such as `GET /orders/42`. | A service method, such as `OrderService.GetOrder`. |
| Where is the contract? | In HTTP semantics and the API's documentation; a machine-readable description such as OpenAPI may be provided. | Typically in a `.proto` file that defines services, methods, and message types. |
| How does the client send data? | With HTTP requests and an API-specific representation, often JSON. | Usually with Protocol Buffers messages carried by gRPC over HTTP/2. |
| How is the result reported? | Through HTTP response status, headers, and a representation. | Through response messages, a gRPC status, and optional metadata. |
| What about streaming? | An API must specify a suitable mechanism separately. | Methods can declare server, client, or bidirectional message streams. |

The REST column describes a common HTTP API style, not every possible REST implementation. REST does not require JSON or HTTP/1.1, and HTTP APIs can stream data too. The gRPC column describes the usual Protocol Buffers and HTTP/2 setup; gRPC can use other message formats.

## What changes for a client developer?

With a resource-oriented HTTP API, you read its documentation to choose a URL, method, body format, and response handling. Types often come from hand-written interfaces or from a generator that reads an OpenAPI file. With gRPC, you get the service's `.proto` contract and generate a client from it. The generated methods and message types become the main interface you call. The gRPC library handles encoding, connections, and transport.

Check the server's **actual API contract**, not just whether it uses HTTP. You cannot call a gRPC method by sending a JSON request with `fetch` to a similar-looking URL. Likewise, an HTTP endpoint that happens to return Protocol Buffers is not automatically a gRPC service. When you plan a client, find the method you need, its request and response messages, its call shape, and how it reports failures.

For practice, take the order example above and list what you need to know before you write each client. For the HTTP API, you need the path and the JSON shape of the response. For gRPC, you need the service definition and the message fields. The next lesson shows how to write and read that `.proto` definition.

## Sources

- [REST architectural style](https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)
- [gRPC introduction](https://grpc.io/docs/what-is-grpc/introduction/)
- [gRPC core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [gRPC FAQ: comparison with REST](https://grpc.io/docs/what-is-grpc/faq/)
