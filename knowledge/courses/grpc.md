---
slug: grpc
title: gRPC
catalogOrder: 90
description: Learn gRPC as a frontend developer by building a small TypeScript service and client on Node.js, from the .proto contract to errors and deadlines.
tags:
  - grpc
  - rpc
  - protocol-buffers
  - typescript
  - nodejs
lessons:
  - grpc/how-grpc-works
  - grpc/grpc-vs-rest
  - grpc/defining-services-in-proto-files
  - grpc/generating-typescript-code
  - grpc/implementing-a-grpc-service
  - grpc/making-unary-rpc-calls
  - grpc/working-with-streaming-rpcs
  - grpc/handling-grpc-status-codes
  - grpc/deadlines-cancellation-and-metadata
---

`gRPC` lets one program call a method of another program through a shared contract. A `.proto` file describes the methods and their messages. Generated code turns that contract into typed TypeScript functions. This course is for frontend developers who meet gRPC in Node.js code, such as a backend-for-frontend, a server-rendering layer, or internal tooling.

The first two lessons explain how a remote call works and how it differs from the REST and `fetch` workflow you already know. After that, the course is practical. You build one small inventory project on Node.js with `@grpc/grpc-js`, the official gRPC library. You write the contract, generate TypeScript code, implement the service, and call it from a client. Then you add streaming, error handling, deadlines, cancellation, and metadata.

## What you will learn

- How services, methods, messages, and generated clients fit together.
- How gRPC differs from a REST API you call with `fetch`.
- How to write a `.proto` contract and generate TypeScript code from it.
- How to implement a gRPC service in Node.js and call it from a TypeScript client.
- How to make unary and streaming calls, handle status codes, and control calls with deadlines, cancellation, and metadata.

## Official resources

- [Introduction to gRPC](https://grpc.io/docs/what-is-grpc/introduction/)
- [gRPC Node.js basics](https://grpc.io/docs/languages/node/basics/)
- [`@grpc/grpc-js` package](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js)
- [Protocol Buffers language guide](https://protobuf.dev/programming-guides/proto3/)
