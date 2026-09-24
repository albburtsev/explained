---
slug: redis
title: Redis
catalogOrder: 80
description: Learn how Redis stores data in memory and how distributed systems use it for caching, rate limiting, locking, and real-time messaging.
tags:
  - redis
  - key-value-store
  - distributed-systems
lessons:
  - redis/why-redis
  - redis/redis-cli
  - redis/data-types-and-key-design
  - redis/expiration-and-eviction
  - redis/caching
  - redis/rate-limiting
  - redis/distributed-locks
  - redis/pub-sub
---

Redis keeps its data in memory and answers most commands in well under a millisecond. That speed changes what a data store is useful for. A relational database remains the system of record, while Redis absorbs the work that would otherwise make the database slow: repeated reads, request counters, short-lived coordination between servers, and messages that only matter right now.

This course introduces Redis as a key-value store with useful data structures, then applies it to the patterns that appear most often in distributed systems. You will work entirely in `redis-cli`, so every example is a plain Redis command rather than code in one language. Lessons assume a single Redis instance and note separately where Redis Cluster changes the answer.

## Install Redis on macOS

Required tool: [Homebrew](https://brew.sh/).

Install the server and its command-line client:

```sh
brew install redis
```

Start Redis now and automatically when you log in:

```sh
brew services start redis
```

Confirm the server answers:

```sh
redis-cli PING
```

It replies `PONG`, and you are ready for the first lesson.

## What you will learn

- Where Redis fits next to a durable database, and where it is the wrong tool.
- How to run Redis on macOS and explore it from `redis-cli`.
- Which data type each problem calls for, and how to design keys you can still reason about later.
- How expiration and eviction turn Redis into a cache instead of a store you can trust.
- How to cache read-heavy data safely, including invalidation and stampede control.
- How to limit request rates with a counter, and why the simple version leaks bursts.
- How to coordinate work across servers with a lock that expires, and what such a lock cannot promise.
- How to broadcast real-time messages, and when fire-and-forget delivery is not enough.
