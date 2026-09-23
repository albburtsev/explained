---
slug: grpc
title: gRPC
catalogOrder: 90
description: Learn to read gRPC contracts, generate a Go client, make unary and streaming calls, and handle call results.
tags:
  - grpc
  - rpc
  - protocol-buffers
  - go
lessons:
  - grpc/how-grpc-works
  - grpc/grpc-vs-rest
  - grpc/defining-services-in-proto-files
  - grpc/generating-a-grpc-client
  - grpc/making-unary-rpc-calls
  - grpc/working-with-streaming-rpcs
  - grpc/handling-grpc-status-codes
  - grpc/deadlines-cancellation-and-metadata
---

`gRPC` lets a client call a service method defined in a shared contract. A `.proto` file describes that method and its request and response messages; generated client code gives the application a typed way to make the call. This course approaches the protocol from the client side, using Go for concrete examples while keeping the underlying concepts language independent.

Start with how a remote call works and how gRPC differs from a REST API. Then read and define a service contract, generate a client, and make unary and streaming calls. Finish by interpreting status codes and controlling each call with deadlines, cancellation, and metadata.

## What you will learn

- How services, methods, messages, and client stubs fit together.
- How gRPC and REST differ in contracts, transport, and call patterns.
- How to read a `.proto` contract and generate Go client code from it.
- How to make unary and streaming calls with a generated client.
- How to handle gRPC statuses and set call-scoped deadlines, cancellation, and metadata.

## Official resources

- [Introduction to gRPC](https://grpc.io/docs/what-is-grpc/introduction/)
- [gRPC Go basics](https://grpc.io/docs/languages/go/basics/)
- [Protocol Buffers language guide](https://protobuf.dev/programming-guides/proto3/)
