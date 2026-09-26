---
slug: redis/rate-limiting
title: Rate Limiting with Redis
description: Count requests in shared Redis keys, understand why INCR is safe under concurrency, and replace the leaky fixed window with a sliding window log.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - rate-limiting
---

**Rate limiting** rejects a client's requests once it exceeds an allowed number in a period of time, such as 100 requests per minute per user. The limit protects a shared resource — a database, a payment provider, an expensive endpoint — from one caller who sends too much traffic, whether by accident or on purpose.

A limit is only meaningful if every server counts into the same place. Redis is a good home for that counter: the counter is small, it is short-lived, losing it during a restart costs you one window rather than real data, and Redis answers the read and the write in a single round trip.

## Count in one shared place, not in each process

Suppose your application runs on four servers behind a load balancer, and each server keeps its own in-memory counter. A client sending 400 requests per minute spreads roughly 100 requests to each server. Every server sees a number below the limit and allows everything. The advertised limit of 100 per minute has quietly become 400.

Routing each client to a fixed server does not fix this. The mapping changes when you deploy, scale, or lose a server, and the counters reset or split at exactly the moments when traffic is least predictable.

Redis removes the problem by holding one counter that all four servers read and write. Each server asks Redis "what is this client's count now?" and gets an answer that already includes the other three servers' requests.

## Count one fixed window with `INCR`

The **fixed window counter** divides time into aligned blocks — for example, each calendar minute — and keeps one counter per client per block. Put the block's start time directly in the key:

```text
ratelimit:user:42:1699999920
             ^      ^
             |      window start as a Unix timestamp
             client identity
```

Your application computes the window start by rounding the current Unix time down to the window size: for a one-minute window, `1699999947` becomes `1699999920`. The examples below use literal values so you can type them into `redis-cli` yourself.

Because the window start is part of the key, a new minute automatically uses a new key. You never reset a counter, and no request can arrive while a counter is half-reset. The previous minute's key simply stops being used and expires.

Handling one request means incrementing the key and comparing the result with the limit:

```sh
127.0.0.1:6379> INCR ratelimit:user:42:1699999920
(integer) 1
127.0.0.1:6379> INCR ratelimit:user:42:1699999920
(integer) 2
```

`INCR` creates the key with the value `0` when it is missing, then increments it, and returns the new value. Nothing has to exist in advance. If the returned value is greater than the limit, reject the request; otherwise serve it.

## Trust `INCR` under concurrency

`INCR` is not just a convenience over `GET` and `SET`. It is the reason this pattern is correct.

Redis executes commands one at a time. Newer versions use extra threads for network input and output, but commands still run in a single logical execution loop, so two commands never overlap. `INCR` reads the value, adds one, and stores the result inside that one indivisible step.

Compare that with a counter kept in a database row and updated by an application: read the value, add one in your process, write it back. Two servers can read `40`, both compute `41`, and both write `41`. One request vanished from the count. The wider the gap between the read and the write, the more requests slip through.

With `INCR` that gap does not exist. There is no read-modify-write round trip to lose, and the value Redis returns to each caller is that caller's own position in the sequence. Ten servers incrementing at the same moment receive ten different numbers.

## Close the gap between `INCR` and `EXPIRE`

A counter key must expire, or every client that ever appeared leaves a key behind forever. The obvious approach sets the expiry only on the first request of a window:

```sh
127.0.0.1:6379> INCR ratelimit:user:42:1699999920
(integer) 1
127.0.0.1:6379> EXPIRE ratelimit:user:42:1699999920 60
(integer) 1
```

Each command is atomic, but the pair is not. If the process crashes, the connection drops, or the server is killed between the two commands, the key exists with a count of `1` and no expiry. Redis keeps it forever. That key never leaves the current window, so the client keeps accumulating against it and is eventually blocked permanently.

Send both commands as one transaction instead:

```sh
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379(TX)> INCR ratelimit:user:42:1699999920
QUEUED
127.0.0.1:6379(TX)> EXPIRE ratelimit:user:42:1699999920 60 NX
QUEUED
127.0.0.1:6379(TX)> EXEC
1) (integer) 1
2) (integer) 1
```

`MULTI` starts a transaction and Redis queues the following commands instead of running them. `EXEC` runs the whole queue as one isolated unit: either both commands run, or neither does. The replies come back as a list in the order you queued them.

The `NX` option on `EXPIRE` (Redis 7.0 and later) sets the expiry only when the key has no expiry yet. Without it, every request would push the deadline 60 seconds further away and the window would never end. On a later request in the same window it returns `0`, which is the expected result rather than a failure:

```sh
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379(TX)> INCR ratelimit:user:42:1699999920
QUEUED
127.0.0.1:6379(TX)> EXPIRE ratelimit:user:42:1699999920 60 NX
QUEUED
127.0.0.1:6379(TX)> EXEC
1) (integer) 2
2) (integer) 0
```

## See the burst a fixed window allows

The fixed window is cheap: one small key per client per window, and one round trip per request. It also has a flaw you must know about before you rely on it.

The limit applies inside a window, not across a window boundary. A client can spend its whole allowance at the very end of one window and its whole allowance immediately after the boundary:

```text
22:00:59.8   100 requests  ->  ratelimit:user:42:1699999200  count reaches 100
22:01:00.2   100 requests  ->  ratelimit:user:42:1699999260  count reaches 100
```

Both windows are respected. Both counters stop at exactly 100. Yet the protected service received 200 requests in under a second — twice the rate you advertised, in the worst possible shape. Any fixed window permits up to twice its limit across a boundary, and a client that watches the clock can reproduce it on every boundary.

Accept that for a generous limit whose purpose is to stop runaway clients. Do not accept it when the limit protects something that a short doubled burst can actually damage.

## Replace it with a sliding window log

The **sliding window log** removes the boundary by remembering the individual requests instead of a total. Keep one sorted set per client, where each member is one request and its score is the request's timestamp in milliseconds. "The last 60 seconds" then means "members whose score is above now minus 60000", and that range moves continuously with the clock.

Handling one request takes four commands. Assume a limit of 3 requests per 60 seconds and a request arriving at `1699999920000`:

```sh
127.0.0.1:6379> ZREMRANGEBYSCORE ratelimit:slide:user:42 -inf 1699999860000
(integer) 0
127.0.0.1:6379> ZCARD ratelimit:slide:user:42
(integer) 0
127.0.0.1:6379> ZADD ratelimit:slide:user:42 1699999920000 1699999920000-a1
(integer) 1
127.0.0.1:6379> EXPIRE ratelimit:slide:user:42 60
(integer) 1
```

Read the four commands as one procedure:

- `ZREMRANGEBYSCORE` deletes every member older than the window. `-inf` is the lowest possible score, and `1699999860000` is the request time minus 60000. This is the step that makes the window slide.
- `ZCARD` returns how many requests remain inside the window. Compare this number with the limit: below it, allow the request; at it or above it, reject.
- `ZADD` records the allowed request. The score is the timestamp; the member must be unique, because adding an existing member only updates its score instead of adding a second entry. A timestamp plus a short random suffix works.
- `EXPIRE` bounds the key so an idle client's sorted set disappears instead of lingering. Refresh it on every write; the newest entry can only matter for one more window.

After three allowed requests the fourth is refused, because `ZCARD` reports that the window is already full:

```sh
127.0.0.1:6379> ZCARD ratelimit:slide:user:42
(integer) 3
127.0.0.1:6379> ZRANGE ratelimit:slide:user:42 0 -1 WITHSCORES
1) "1699999920000-a1"
2) "1699999920000"
3) "1699999935000-b7"
4) "1699999935000"
5) "1699999950000-c3"
6) "1699999950000"
```

Nothing is released at a fixed boundary. The first entry stops counting 60 seconds after it was recorded, and the client regains exactly one slot at that moment. The doubled burst is gone.

You pay for that in memory. The fixed window stores one small integer per client per window. The log stores one sorted-set entry per allowed request: the member string, its score, and the index Redis keeps for ordering. A limit of 100 per minute costs up to 100 entries for every client that is currently active, so a million active clients can mean tens of millions of entries plus their overhead. Measure the limit multiplied by your realistic number of concurrent clients before choosing this pattern, and prefer it for expensive endpoints with modest limits rather than for every request your service handles.

## Keep the whole check atomic

The fixed window needs only `INCR`, so a single command already decides the outcome. The sliding window is different: four commands run between reading the count and recording the request. Sent one by one, two servers can both read `ZCARD` as `2` against a limit of 3 and both add an entry, so a limit of 3 admits 4 requests. Send the four commands inside `MULTI`/`EXEC`, or inside a Lua script run with `EVAL`, and Redis executes them as one isolated unit that no other client can interleave with.

The two options differ in one way that matters. A transaction queues commands before any reply arrives, so it cannot branch on the `ZCARD` result — you queue the `ZADD` unconditionally and compare the count afterwards, which means rejected requests are also recorded and a blocked client stays blocked slightly longer. A Lua script sees each reply as it runs, so it can check the count and skip the `ZADD` when the request is refused. This course has no scripting lesson; for now, know that `EVAL` exists, that it is the usual choice for production limiters, and that `MULTI`/`EXEC` is a correct if blunter alternative:

```sh
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379(TX)> ZREMRANGEBYSCORE ratelimit:slide:user:42 -inf 1699999860000
QUEUED
127.0.0.1:6379(TX)> ZCARD ratelimit:slide:user:42
QUEUED
127.0.0.1:6379(TX)> ZADD ratelimit:slide:user:42 1699999920000 1699999920000-a1
QUEUED
127.0.0.1:6379(TX)> EXPIRE ratelimit:slide:user:42 60
QUEUED
127.0.0.1:6379(TX)> EXEC
1) (integer) 0
2) (integer) 0
3) (integer) 1
4) (integer) 1
```

The second reply is the count before this request was recorded. Compare that number with the limit to decide whether to serve the request.

## Allow controlled bursts with a token bucket

There is a third common option. A **token bucket** gives each client a bucket with a maximum number of tokens that refills at a steady rate. A request spends one token; an empty bucket means rejection. A client that has been quiet accumulates tokens and may spend them in one short burst, while its long-run rate stays capped by the refill rate.

Choose it when a burst is a legitimate pattern — a page that issues several API calls at once, or a batch job that wakes up occasionally. It stores only the token count and the last refill time per client, so its memory cost is close to the fixed window's. It also needs the whole refill-and-spend step to be atomic, which again means a Lua script. Implementing one is beyond this lesson.

## Keep limiter keys on one Cluster node

Redis Cluster assigns each key to one of 16384 hash slots, so keys with unrelated names usually land on different nodes.

A limiter built on one key per client is unaffected. `ratelimit:user:42:1699999920` lives in exactly one slot on exactly one node, every server that increments it reaches that same node, and the count stays correct.

A limiter that touches several keys in one atomic step is affected, because `MULTI`/`EXEC` and `EVAL` require every key involved to be in the same slot. Suppose you check a per-user limit and a per-endpoint limit together. Wrap the shared part of both key names in a **hash tag** — braces telling Redis to hash only that substring:

```text
ratelimit:{user:42}:global
ratelimit:{user:42}:endpoint:checkout
```

Redis hashes only `user:42` in both names, so both keys share a slot and a node. Use hash tags only where you need them: every key sharing a tag also shares a node, and a popular tag concentrates its traffic on one node instead of spreading it across the cluster.

## Check your understanding

Answer these before reading the responses below:

1. Two servers handle requests from the same user at the same millisecond and both run `INCR` on the same key. Can the count end up one lower than the number of requests?
2. Why does the fixed window key contain `1699999920` rather than being a single key per user?
3. A limiter runs `INCR` and then `EXPIRE`, and the process is killed between them. What state is the key in, and what does the user experience?
4. A service allows 100 requests per minute with a fixed window. What is the largest number of requests a client can send in a two-second period?
5. Under a sliding window log with a limit of 3, the three entries were recorded at `1699999920000`, `1699999935000`, and `1699999950000`. At what time does the client regain its first free slot?

Answers: 1. No — `INCR` reads, adds, and writes in one indivisible step, and Redis runs commands one at a time, so each server receives a different number. 2. The window start in the key means a new window uses a new key, so no counter has to be reset while requests are arriving. 3. The key exists with the count `1` and no expiry, so it never leaves the current window and the user is eventually blocked forever. 4. About 200, by spending a full window just before a boundary and another full window just after it. 5. At `1699999980000`, exactly 60 seconds after the oldest entry, when `ZREMRANGEBYSCORE` drops it from the window.

## Official resources

- [`INCR`](https://redis.io/docs/latest/commands/incr/)
- [`EXPIRE`](https://redis.io/docs/latest/commands/expire/)
- [`ZADD`](https://redis.io/docs/latest/commands/zadd/)
- [`ZREMRANGEBYSCORE`](https://redis.io/docs/latest/commands/zremrangebyscore/)
- [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/)
- [Transactions](https://redis.io/docs/latest/develop/using-commands/transactions/)
- [Scripting with Lua](https://redis.io/docs/latest/develop/programmability/eval-intro/)
- [Redis rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/)
- [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
