---
slug: grpc/grpc-vs-rest
title: gRPC vs REST
description: Compare gRPC methods with REST resources and see what changes when you build a client.
tags:
  - grpc
  - rest
  - api-design
---

`REST` is an architectural style centered on resources and a uniform interface. `gRPC` is a framework for calling named service methods. They solve overlapping API problems, but they do not define the same kind of interface.

Imagine an API that retrieves an order. A typical resource-oriented HTTP API might expose `GET /orders/42`; the client constructs an HTTP request, then interprets the response status and representation. A gRPC API might define `OrderService.GetOrder` with a `GetOrderRequest` containing the order ID; the client calls that method through a generated client and receives a typed `Order` message. These are illustrative API designs, not two wire formats for the same endpoint.

| Question | Resource-oriented HTTP API | gRPC API |
| --- | --- | --- |
| What identifies the operation? | An HTTP method and a resource URI, such as `GET /orders/42`. | A service method, such as `OrderService.GetOrder`. |
| Where is the contract? | In HTTP semantics and the API's documentation; a machine-readable description such as OpenAPI may be provided. | Typically in a `.proto` file defining services, methods, and message types. |
| How does the client send data? | With HTTP requests and an API-specific representation, often JSON. | Usually with Protocol Buffers messages carried by gRPC over HTTP/2. |
| How is the result reported? | Through HTTP response status, headers, and a representation. | Through response messages, a gRPC status, and optional metadata. |
| What about streaming? | An API must specify a suitable mechanism separately. | Methods can declare server, client, or bidirectional message streams. |

The REST column describes a common HTTP API style, not every possible REST implementation. REST does not require JSON or HTTP/1.1, and HTTP APIs can use streaming techniques too. The gRPC column describes the usual Protocol Buffers and HTTP/2 setup; gRPC can use other message formats.

## What changes for a client developer?

With a resource-oriented HTTP API, you follow its documentation to choose a URL, method, representation, and response handling. With gRPC, obtain the service's `.proto` contract and generate or acquire a compatible client. The generated method and message types become the main interface you call; the gRPC library handles encoding and transport details.

Check the server's **actual API contract**, not just whether it uses HTTP. A gRPC method is not generally callable by sending a JSON request to a similar-looking URL. Likewise, an HTTP endpoint that happens to return Protocol Buffers is not automatically a gRPC service. When planning your client, identify the method you need, its request and response messages, its call shape, and how failures are reported.

For practice, take the example above and name the information you would need before writing each client: the HTTP API's path and response representation on one side, and the gRPC service definition and message fields on the other. The next lesson shows how to read that `.proto` definition.

## Sources

- [REST architectural style](https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)
- [gRPC introduction](https://grpc.io/docs/what-is-grpc/introduction/)
- [gRPC core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [gRPC FAQ: comparison with REST](https://grpc.io/docs/what-is-grpc/faq/)
