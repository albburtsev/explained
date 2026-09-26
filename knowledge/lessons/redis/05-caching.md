---
slug: redis/caching
title: Caching with Redis
description: Serve read-heavy data from Redis with the cache-aside pattern, design keys that cannot return the wrong value, invalidate on write, and survive stampedes and evictions.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - caching
---

A **cache** is a fast copy of an answer that is expensive to produce. The expensive answer usually comes from a relational database: a query that joins several tables, or a row that thousands of requests read every minute. You keep the finished answer in Redis under a key, and you serve later requests from that key instead of asking the database again. Caching is the most common reason a team adds Redis to a system.

The important word is **copy**. The database still owns the data. Redis holds a duplicate that is allowed to disappear, allowed to be slightly old, and never allowed to be the only place the value exists. Every design decision in this lesson follows from that one rule.

## Serve a read through the cache-aside path

**Cache-aside**, also called lazy loading, is the default caching pattern. The application talks to both stores and keeps them in that order:

1. Read the cache key.
2. On a hit, return the cached value and stop.
3. On a miss, load the value from the database.
4. Write the value back into Redis with a TTL.
5. Return the value.

Nothing is cached until somebody asks for it. The cache fills itself from real traffic.

Walk the miss path in `redis-cli`. The first request for product 42 finds nothing:

```sh
127.0.0.1:6379> GET product:42:summary
(nil)
```

`(nil)` is how `redis-cli` prints a null reply. It means the key does not exist. It is not an error, and the application must not treat it as one. A miss is the normal first step for every key.

The application now runs its usual database query and gets the product row. It serializes the row and writes it back with an expiry:

```sh
127.0.0.1:6379> SET product:42:summary '{"id":42,"name":"Red Kettle","price":2490}' EX 300
OK
```

`EX 300` sets the time to live to 300 seconds in the same command that sets the value. Use it every time. A plain `SET` with no expiry option clears any TTL the key already had, so a value written without `EX` stays in memory until something removes it.

The next request for the same product hits:

```sh
127.0.0.1:6379> GET product:42:summary
"{\"id\":42,\"name\":\"Red Kettle\",\"price\":2490}"
```

`redis-cli` escapes the inner double quotes when it prints a string. The stored bytes are unchanged. You can confirm the key is counting down:

```sh
127.0.0.1:6379> TTL product:42:summary
(integer) 300
```

That is the whole read path. Two Redis commands and one conditional database query.

## Put everything that changes the value into the key

The key design lesson introduced the `object-type:id:field` convention. A cache key follows the same shape, with one extra requirement: **the key must encode every input that changes the value**. If two different answers can share one key, the cache will hand one user another user's answer.

Ask which inputs the cached value depends on, then put each of them in the key:

```sh
127.0.0.1:6379> SET cache:v3:product:42:summary:en-us:usd '{"name":"Red Kettle","price":"$24.90"}' EX 300
OK
127.0.0.1:6379> SET cache:v3:product:42:summary:de-de:eur '{"name":"Roter Kessel","price":"22,90 €"}' EX 300
OK
```

The pieces each do a job:

- `cache:` separates cached copies from keys that hold real state, so you can tell at a glance what is safe to delete.
- `v3` is a version marker for the shape of the stored value. Change it when you change the serialized format, and every old key becomes unreachable at once.
- `product:42` identifies the entity.
- `summary` identifies which representation of that entity this is. A `summary` and a `full` view of product 42 are two values and need two keys.
- `en-us` and `usd` are the inputs that change the rendered answer.

The opposite mistake is a key like `product:42` for a value that already depends on language and currency. That key is not wrong once; it is wrong intermittently, and only for some users, which makes it very hard to diagnose.

Never put a user identifier in a key that holds shared data, and never put shared data under a per-user key. Decide which one it is, then name it honestly.

## Delete the key when the database changes

A TTL is not invalidation. If the price of product 42 changes and the cached key still has 280 seconds left, every reader sees the old price for 280 more seconds. The TTL limits how long the damage lasts. It does not stop it.

Invalidate explicitly. After the database write commits, remove the key:

```sh
127.0.0.1:6379> DEL cache:v3:product:42:summary:en-us:usd
(integer) 1
```

`DEL` returns the number of keys it removed, so `(integer) 0` simply means the key was already gone. That is a normal result, not a failure.

The order matters. Write the database first, then delete the key. If you delete first, a concurrent reader can miss, load the old row, and write it back before your write commits. The cache is then stale with no TTL reset in sight.

There are two ways to update a cache on a write, and they are not the same:

- **Delete-on-write** removes the key and lets the next reader rebuild it from the database. The rebuilt value always comes from the system of record, so it cannot be a value you assembled incorrectly. The cost is one extra miss after every write.
- **Write-through** writes the new value into Redis at the same time as the database. The cache stays warm, but the writer must know how to build every cached representation of the row, and two concurrent writers can land in Redis in the opposite order from the database, leaving the cache permanently wrong until the TTL saves it.

Prefer delete-on-write. It is shorter, it has fewer race conditions, and it keeps the database as the single source of truth. Reach for write-through only when a miss after a write is genuinely too expensive.

## Choose a TTL as a staleness budget

Do not ask how long the value stays valid. Ask a different question: **how long may a reader see an old value before it matters?** That answer is your TTL.

- Short TTLs, measured in seconds, keep data fresh and push more traffic to the database.
- Long TTLs, measured in hours, protect the database and widen the window in which a missed invalidation goes unnoticed.

Treat the TTL as the backstop for the invalidation you forgot to write, not as the primary freshness mechanism. A cached value that also has a `DEL` on every write path can afford a long TTL. A value with no invalidation at all needs a TTL short enough that you would accept the worst case every single time.

Also give the cache a ceiling by refusing to cache what does not benefit. A value read once per hour costs memory and returns nothing.

## Stop a cache stampede

A **cache stampede** happens when one popular key expires and many concurrent requests miss at the same instant. Each of them runs the same expensive query, and the database receives in one moment the load the cache was built to prevent. The cache was working perfectly until the moment it helped least.

Two mitigations cover most cases.

Add jitter to the TTL. If you populate a thousand keys together with `EX 300`, they expire together. Pick a random value in a range instead, for example any number of seconds between 240 and 360, so the expiries spread out:

```sh
127.0.0.1:6379> SET cache:v3:product:42:summary:en-us:usd '{"name":"Red Kettle","price":"$24.90"}' EX 287
OK
```

Let one request rebuild at a time. Before doing the expensive work, try to claim a short key that only succeeds if nobody holds it:

```sh
127.0.0.1:6379> SET rebuild:product:42:summary 1 NX EX 5
OK
127.0.0.1:6379> SET rebuild:product:42:summary 1 NX EX 5
(nil)
```

`NX` means set only if the key does not exist, so the first caller gets `OK` and the others get `(nil)`. The winner queries the database and writes the cache; the losers wait a moment and read the key again, or return a slightly older value. The `EX 5` guarantees the claim releases itself if the winner crashes. This is the simplest possible use of `SET NX EX`. The later lesson on distributed locks examines what such a key can and cannot promise across servers.

## Expect a cached key to vanish early

As the lesson on expiration and eviction showed, a key can disappear before its TTL. Under `maxmemory` pressure Redis evicts keys according to the configured policy, and a key you wrote seconds ago can be gone already. Nothing warns the reader.

Three consequences follow, and all three belong in the read path:

- **Never store the only copy in the cache.** If losing a key loses the data, that value is state, not a cache, and it does not belong under a TTL with an eviction policy pointed at it.
- **Treat every read as a possible miss.** A miss is not an anomaly to log loudly. It is step 3 of the pattern.
- **Handle Redis being unreachable.** If the `GET` fails because Redis is down or the connection timed out, fall through to the database and serve the request. A cache outage should make the system slower, never broken. Keep the timeout short so a hanging cache does not become a hanging request, and do not let the failed write-back turn into an error the user sees.

Eviction also clusters in time. Memory pressure arrives when traffic is heavy, so many keys vanish exactly when the database is busiest. That is the same shape as a stampede, which is why jitter and a rebuild key help here too.

## Invalidate carefully under Redis Cluster

Redis Cluster splits the key space into 16384 hash slots and gives each master node a range of them. Cache keys are designed to spread evenly, so a group of related keys usually lands on several different nodes. Two habits break there.

Multi-key `DEL` stops being a single command. In a cluster, `DEL` requires all of its keys to live in one slot; keys in different slots fail with `CROSSSLOT Keys in request don't hash to the same slot`. Invalidating twenty keys means twenty commands, or a hash tag such as `{product:42}` in every related key to force them into one slot. A hash tag also concentrates their load on one node, so use it only for small related groups.

Pattern-based invalidation stops being global. `SCAN` iterates the keys of the node you are connected to, not the whole cluster, so a `SCAN`-based sweep must run separately against every master node and be repeated if the cluster is resharded while it runs.

Both problems are a good argument for the version marker in the key. Bumping `cache:v3` to `cache:v4` retires an entire generation of keys without deleting anything, and the abandoned keys expire on their own.

## Check your understanding

Predict each answer before reading on:

1. `GET cache:v3:product:42:summary:en-us:usd` returns `(nil)`. What does the application do next?
2. A product description is updated in the database. The cached key has 280 seconds of TTL left. What does a reader see if you rely on the TTL alone?
3. Why does `SET cache:v3:product:42:summary:en-us:usd '...'` without `EX` create a problem even though the key held a TTL a moment ago?
4. Why is `SET rebuild:product:42:summary 1 NX EX 5` better than `SET rebuild:product:42:summary 1 NX`?
5. In a cluster, why can `DEL` on fifty cache keys fail?

Answers: (1) It loads the value from the database, writes it back with `SET ... EX`, and returns it. (2) The old description, for up to 280 more seconds, because a TTL is a backstop and not invalidation; delete the key after the write instead. (3) A successful `SET` discards the existing TTL, so the key stops expiring and can hold a stale value indefinitely. (4) Without `EX`, a caller that crashes after claiming the key leaves it set forever, and no one ever rebuilds that value. (5) The keys hash to different slots, and a multi-key `DEL` in a cluster must target a single slot, so it returns `CROSSSLOT Keys in request don't hash to the same slot`.

## Official resources

- [`SET` command reference](https://redis.io/docs/latest/commands/set/)
- [`GET` command reference](https://redis.io/docs/latest/commands/get/)
- [`DEL` command reference](https://redis.io/docs/latest/commands/del/)
- [`TTL` command reference](https://redis.io/docs/latest/commands/ttl/)
- [`SCAN` command reference](https://redis.io/docs/latest/commands/scan/)
- [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [Multi-key operations](https://redis.io/docs/latest/develop/using-commands/multi-key-operations/)
- [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
