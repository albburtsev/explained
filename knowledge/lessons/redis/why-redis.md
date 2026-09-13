---
slug: redis/why-redis
title: Why Redis
description: Understand what an in-memory data structure store is, why Redis answers in microseconds, which jobs suit it, and when it is the wrong tool.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - in-memory
---

**Redis** is an in-memory data structure store. It keeps the whole dataset in RAM, addresses every value by a key, and exposes commands that operate on the value's structure rather than on an opaque blob. The name is short for Remote Dictionary Server, and that is a fair first mental model: a dictionary that lives in one process and that every server in your system can reach over the network.

The simplest version of that model is a string value under a key:

```sh
127.0.0.1:6379> SET session:9f2c "user:412"
OK
127.0.0.1:6379> GET session:9f2c
"user:412"
```

That is the last command you need for this lesson. The hands-on work starts in the next one. What matters now is why so many systems put a store like this next to their database, and where that decision goes wrong.

## Read "data structure store" literally

Redis is often introduced as a cache, and caching is its most common job. But the description that explains its command set is **data structure store**: a value is not only a byte string you overwrite whole, it is a structure the server understands and can modify in place.

That gives you, among others:

- **Strings** for plain values, including numbers you can increment atomically.
- **Lists** of strings in insertion order, usable as queues.
- **Sets** of unique strings, with membership tests and set algebra.
- **Sorted sets**, where each member carries a score that keeps the collection ordered — the basis of leaderboards and time-ordered windows.
- **Hashes**, field-value records that let you update one field without rewriting the object.
- **Streams**, an append-only log of entries with consumer tracking.

The practical difference is where the work happens. To add one member to a set in a plain cache, you fetch the value, decode it, modify it, encode it, and write it back — two network round trips and a lost-update race if another server does the same thing. In Redis it is one command, executed atomically on the server. A later lesson picks the right type for each problem; for now, just stop reading "Redis" as "a fast cache of opaque blobs".

## Trace where the time goes

Two design choices explain most of Redis's behavior.

The first is memory. A relational database stores rows on disk and keeps a cache of hot pages in memory. A read that misses that cache has to reach the storage layer. Redis has no such miss: every value is already a structure in the process's heap, so reading it is a pointer lookup, not an I/O operation.

The second is the command loop. Redis uses a mostly single-threaded design: one process serves every client connection through multiplexing, and commands are executed one at a time, in sequence. There is no lock contention between clients, no transaction manager, and no coordination overhead per command.

Together these make the server's own processing time extremely small. The Redis documentation puts it in the sub-microsecond range for ordinary commands. In practice, the number you measure from your application is dominated by the network round trip instead — roughly 200 microseconds over a typical gigabit network. That is where "sub-millisecond Redis" comes from: the work is almost free, and what is left is the wire.

Sequential execution has two consequences worth remembering from the start.

- **Every command is atomic.** No other client can observe a half-applied command, and nothing can interleave between the read and the write inside a single command. This is why Redis is a good place for counters and locks, and the later lessons on rate limiting and locking depend on it.
- **One slow command delays everyone.** `GET`, `SET`, and `LPUSH` run in a small constant time, but commands that touch many elements — `SORT`, `SUNION`, or `KEYS` on a large keyspace — hold the single thread for their whole duration. Every other client waits. Treat a slow command in Redis as a slow command for the entire instance.

## Compare Redis with a disk-backed database

Redis and a relational database are not competitors with different performance numbers. They make different promises.

| Question | Relational database | Redis |
| --- | --- | --- |
| Where does the data live? | On disk, cached in memory | In memory, optionally copied to disk |
| How large can it get? | Larger than RAM | Bounded by RAM |
| How do you ask for data? | SQL, joins, ad-hoc queries, a planner | By key, plus commands for that value's type |
| What happens on a crash? | Committed transactions survive | Recent writes may be lost, depending on configuration |
| How do concurrent writers behave? | Transactions and isolation levels | One command at a time, per instance |

Read that table as a division of labor rather than a ranking. The usual shape of a system is a durable database holding the truth and Redis holding a fast, disposable projection of it: the rows you read most often, the counters you update most often, and the coordination state that only matters for the next few seconds.

## Recognize the jobs teams give Redis

Four patterns account for most production use of Redis, and this course covers each one.

- **Caching.** Store the result of an expensive query or computation under a key with an expiry, and serve later reads from memory. The database keeps the truth; Redis absorbs the repeated reads.
- **Counters and rate limiting.** Atomic increments make Redis a natural place to count requests per user per minute, track quota consumption, or maintain a leaderboard.
- **Coordination.** Several application servers need to agree that only one of them runs a job. A key that only one holder can create, with an expiry so a crashed holder cannot block forever, gives you a rough distributed lock.
- **Ephemeral messaging.** Publish an event and let whichever servers are currently listening receive it, for live dashboards, presence, or cache invalidation signals.

What these share is that the data is small, hot, and either reconstructible or not worth much after a short time. That is the sweet spot.

## Treat durability as a deliberate choice

Redis is not required to be volatile. It offers real persistence options, and you should know what each one actually promises.

- **RDB** takes point-in-time snapshots at configured intervals. It restores fast and makes good backups, but an unclean shutdown loses everything written since the last snapshot — usually the last several minutes.
- **AOF** appends every write command to a log and replays it at startup. Its durability depends on `appendfsync`: `always` fsyncs on every write and is slow, `everysec` is the default and can lose about one second of writes, and `no` leaves flushing to the operating system.
- **Both together** is the recommended setting when you want data safety comparable to a traditional database.

Replication adds a second caveat. Redis replicates asynchronously by default, so a primary can acknowledge a write to your client and then fail before any replica has it. The documentation is explicit that acknowledged writes can still be lost during a failover.

So the honest statement is not "Redis loses data". It is that using Redis as the system of record is a deliberate decision with a measurable loss window, and you have to pick that window on purpose. Most teams decide they would rather not, and keep the truth in a database that was designed to defend it.

## Know when Redis is the wrong tool

Reach for something else in these cases.

- **Data you cannot afford to lose.** Payments, orders, ledgers, audit trails. Even with AOF and replication, you are choosing a small loss window rather than eliminating it.
- **A dataset larger than RAM.** Redis has no on-disk backend for cold data; the dataset must fit in memory. When the `maxmemory` limit is reached, Redis either evicts keys according to your policy or, with the default `noeviction` policy, starts rejecting writes with an error while still serving reads. A later lesson covers expiration and eviction in detail.
- **Complex queries and joins.** There is no SQL, no query planner, and no way to join two keys. Redis Open Source does ship a search and query engine that can index hashes and JSON documents, but it is a secondary index over your keyspace, not a general-purpose relational engine.
- **Reporting and analytics.** Scanning the whole keyspace to compute an aggregate fights the single-threaded design and blocks live traffic. Send that work to a database, a warehouse, or a replica.

A useful test before adding Redis: ask what breaks if the instance restarts empty. If the answer is "the next few requests are slower", Redis fits. If the answer is "we lost records", pick a different home for that data.

## Note how Redis scales out

Everything above assumes a single Redis instance, and so does most of this course. Redis scales horizontally through **Redis Cluster**, which shards the keyspace across several nodes. Each key is mapped to one of 16384 hash slots, and each node owns a range of slots.

Sharding changes one rule that several later patterns rely on: a command that touches multiple keys works only when all of those keys live in the same hash slot. You can force that by putting a shared *hash tag* in braces inside the key names — `user:{123}:profile` and `user:{123}:account` hash to the same slot because only the text inside the braces is hashed.

Each lesson assumes a single instance and adds a short note where Cluster changes the answer.

## Check your understanding

Answer these before reading on.

1. Why does a Redis read avoid the cache-miss problem a relational database has?
2. Your instance suddenly shows high latency for every client, and one application runs `KEYS` against a large keyspace on a timer. Are those related?
3. A colleague proposes storing the only copy of paid invoices in Redis with AOF enabled. Name two risks.
4. Your cached dataset grows past the memory you gave Redis. What happens with the default eviction policy?
5. Which of these fits Redis: a session store, a monthly revenue report, a per-IP request counter, a customer address book that must survive a restart?

Expected answers: 1. The whole dataset is already in memory, so a read is a pointer lookup rather than disk I/O. 2. Yes — commands run sequentially on one thread, so a slow `KEYS` scan stalls every other client. 3. With `appendfsync everysec` you can lose about a second of writes on a crash, and asynchronous replication means an acknowledged write can vanish in a failover. 4. `noeviction` keeps the data but rejects further writes with an error; reads continue to work. 5. Session store and per-IP counter fit; the revenue report needs queries and aggregation, and the address book needs durability.

## Official resources

- [Redis data structure store quick start](https://redis.io/docs/latest/develop/get-started/data-store/)
- [Redis data types](https://redis.io/docs/latest/develop/data-types/)
- [Redis FAQ](https://redis.io/docs/latest/develop/get-started/faq/)
- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Diagnosing latency issues](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/)
- [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/)

The next lesson installs Redis on macOS and puts you inside `redis-cli`, where every remaining example in this course runs.
