---
slug: redis/expiration-and-eviction
title: Key Expiration and Memory Eviction
description: Attach a TTL to a key, learn when Redis really deletes it, and configure a memory limit and eviction policy so your application survives a missing key.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - memory-management
---

A key can disappear from Redis for two unrelated reasons. **Expiration** removes a key because its own timer ran out. **Eviction** removes a key because the server ran out of memory and had to free some. You control expiration per key. You control eviction per server.

Keeping the two apart matters. A key with a 10-minute TTL can be gone after 10 seconds because eviction reached it first. A key with no TTL at all can also be gone for the same reason. That is the honest model of Redis: it is a cache with an expiry feature, not a store that promises to hold what you wrote.

## Give a key a lifetime

`EXPIRE` attaches a timeout, in whole seconds, to a key that already exists:

```sh
127.0.0.1:6379> SET session:1001 "alice"
OK
127.0.0.1:6379> EXPIRE session:1001 60
(integer) 1
127.0.0.1:6379> TTL session:1001
(integer) 60
```

`PEXPIRE` does the same with milliseconds. Both return `1` when the timeout was set and `0` when it was not, for example because the key does not exist. A key that carries a timeout is called a **volatile** key.

`TTL` reports the seconds remaining, and its two negative replies are not durations:

- `-1` means the key exists but has no expiration.
- `-2` means the key does not exist.

`PTTL` returns the same information in milliseconds. `PERSIST` removes the timeout and makes the key permanent again:

```sh
127.0.0.1:6379> PERSIST session:1001
(integer) 1
127.0.0.1:6379> TTL session:1001
(integer) -1
```

Calling `EXPIRE` again on a volatile key simply replaces the old timeout. Since Redis 7.0 you can make that conditional with one of `NX`, `XX`, `GT`, or `LT`: set the timeout only if there is none, only if there is one, only if the new deadline is later, or only if it is earlier. `GT` and `LT` treat a key without an expiration as having an infinite TTL.

One sharp edge: `EXPIRE` with a zero or negative timeout does not expire the key, it deletes the key immediately.

## Set the value and its deadline in one command

`SET` accepts the expiration inline, so you never publish a key without its timer:

```sh
127.0.0.1:6379> SET cache:product:42 "lamp" EX 300
OK
127.0.0.1:6379> TTL cache:product:42
(integer) 300
```

The expiration options are mutually exclusive:

- `EX seconds` — expire after this many seconds.
- `PX milliseconds` — expire after this many milliseconds.
- `EXAT unix-time-seconds` — expire at this absolute Unix time in seconds.
- `PXAT unix-time-milliseconds` — the same in milliseconds.
- `KEEPTTL` — keep whatever timeout the key already had.

Prefer `SET ... EX` over `SET` followed by `EXPIRE`. Two commands leave a window in which the key exists with no timeout, and a client that crashes in that window leaves the key in memory forever.

Redis stores an expiration as an absolute timestamp, not as a countdown. The clock therefore keeps running while the server is down, and a large clock change on the host affects which keys are already past their deadline.

## Expect most writes to clear the TTL

This is the trap that catches beginners. The timeout is cleared only by commands that delete or overwrite the whole key, including `DEL`, `SET`, and the `*STORE` commands. Commands that alter a value in place leave the timeout untouched: `INCR` on a counter, `LPUSH` on a list, and `HSET` on a hash field all keep the existing deadline.

`SET` belongs to the first group, so a plain rewrite silently makes the key permanent:

```sh
127.0.0.1:6379> SET session:1001 "alice" EX 60
OK
127.0.0.1:6379> SET session:1001 "alice smith"
OK
127.0.0.1:6379> TTL session:1001
(integer) -1
```

The session now lives forever and quietly occupies memory. `KEEPTTL` is the fix:

```sh
127.0.0.1:6379> SET session:1001 "alice" EX 60
OK
127.0.0.1:6379> SET session:1001 "alice smith" KEEPTTL
OK
127.0.0.1:6379> TTL session:1001
(integer) 60
```

The countdown continues from where it stood; run `TTL` a few seconds later and the number is smaller. If you want the rewrite to restart the clock instead, pass `EX` again and be explicit about it.

`RENAME` carries the time to live over to the new name. If the destination key already existed, it inherits everything from the source, including its timeout or its absence.

## Know when an expired key is really gone

An expired key is never visible to a client. `GET` returns `(nil)` and `TTL` returns `-2` the moment the deadline passes. Removing it from memory is a separate question, and Redis does that in two ways.

The first is **lazy expiration**. When a client touches a key, Redis checks its deadline and deletes it on the spot if it has passed. This costs nothing until someone asks.

The second is the **active expire cycle**. A key nobody ever reads again would otherwise stay forever, so Redis periodically samples a few random keys among those that have an expiration and deletes the ones already past their deadline. The `hz` configuration directive controls how often background tasks like this run, and defaults to `10` times per second.

Sampling is random and partial, so the consequence is worth stating plainly: an expired key can keep holding memory for some time after it stops being readable. Do not size an instance on the assumption that memory is freed at the exact second a TTL runs out.

## Set a memory ceiling with `maxmemory`

Without a limit, Redis grows until the operating system refuses to give it more memory, which is a bad way to find out. `maxmemory` sets the ceiling for the dataset:

```sh
127.0.0.1:6379> CONFIG GET maxmemory
1) "maxmemory"
2) "0"
127.0.0.1:6379> CONFIG SET maxmemory 100mb
OK
```

`0` means no limit and is the default on 64-bit systems. `CONFIG SET` changes the running server only; write `maxmemory 100mb` into `redis.conf` to keep the setting across a restart.

Leave headroom below the machine's real memory. Buffers that hold updates on their way to replicas or to the append-only file are deliberately not counted against `maxmemory`, and the `mem_not_counted_for_evict` field in `INFO memory` shows how much they currently use.

## Choose an eviction policy

When used memory passes `maxmemory`, Redis applies `maxmemory-policy` until it is back under the limit. A policy answers two questions: which keys may be sacrificed, and which one goes first.

| Policy | Candidate keys | Victim chosen |
| --- | --- | --- |
| `noeviction` | none | nothing is evicted; writes fail with an error |
| `allkeys-lru` | every key | least recently used |
| `allkeys-lfu` | every key | least frequently used |
| `allkeys-random` | every key | a random key |
| `volatile-lru` | keys with a TTL | least recently used |
| `volatile-lfu` | keys with a TTL | least frequently used |
| `volatile-random` | keys with a TTL | a random key |
| `volatile-ttl` | keys with a TTL | shortest remaining TTL |

The default is `noeviction`. Inspect and change the policy the same way as the limit:

```sh
127.0.0.1:6379> CONFIG GET maxmemory-policy
1) "maxmemory-policy"
2) "noeviction"
127.0.0.1:6379> CONFIG SET maxmemory-policy allkeys-lru
OK
```

Three things to remember when choosing:

- LRU, LFU, and `volatile-ttl` are approximations. Redis samples a small number of keys rather than scanning the whole keyspace, and `maxmemory-samples` (default `5`) controls how many. The result is close to true LRU, not identical to it.
- A `volatile-*` policy behaves exactly like `noeviction` when no key has a TTL. If you pick one, make sure the keys you expect to be sacrificed actually carry a timeout.
- `allkeys-lru` is the reasonable default for a pure cache, because a small set of keys usually serves most reads. Reach for `volatile-*` only when one instance mixes cache data with keys that must not disappear, and prefer two separate instances when you can.

Redis 8.6 adds two more policies, `allkeys-lrm` and `volatile-lrm`, which pick the least recently *modified* key. They update the timestamp on writes only, so reads do not protect a key from eviction.

## Read the memory and eviction counters

`INFO` reports both halves of this lesson. The output has many more lines than shown here, and every value depends on your server:

```sh
127.0.0.1:6379> INFO memory
# Memory
used_memory:1073664
used_memory_human:1.02M
used_memory_peak_human:1.35M
maxmemory:104857600
maxmemory_human:100.00M
maxmemory_policy:allkeys-lru
mem_fragmentation_ratio:1.08
```

Compare `used_memory` with `maxmemory` to see how close the instance is to evicting, and read `maxmemory_policy` to confirm which policy is actually loaded rather than which one you meant to set.

The counters for keys that disappeared live in a different section:

```sh
127.0.0.1:6379> INFO stats
# Stats
expired_keys:48213
evicted_keys:0
keyspace_hits:918442
keyspace_misses:20117
```

`expired_keys` counts keys removed because their TTL ran out. `evicted_keys` counts keys removed to free memory. Both are totals since the server started, so watch how fast they grow rather than their absolute size. A rising `evicted_keys` together with a falling hit rate is the signal that the instance is too small, or that its policy does not match the access pattern.

## Expect eviction to differ per node in Redis Cluster

In Redis Cluster, `maxmemory` and `maxmemory-policy` are per-node settings, and each node holds only the keys in its own hash slots. A node whose slots happen to carry large or numerous values can hit its limit and start evicting while every other node sits far below its ceiling. Redis does not move keys to a node with free memory.

`CONFIG SET` also applies only to the node your `redis-cli` session is connected to. To change a limit across the cluster, apply it to every node. When you investigate evictions, read `INFO` on each node rather than on whichever one you happened to reach.

## Treat every key as optional

This is the framing the rest of the course builds on. Once eviction is enabled, any key may vanish before its TTL, so every read must handle a miss and recompute or refetch the value. A cache entry, a rate-limit counter, and a lock are all keys, and all three are subject to the same rule.

The alternative is not safety, only a different failure. Under `noeviction`, a full instance stops accepting writes and returns an error to the client:

```text
OOM command not allowed when used memory > 'maxmemory'.
```

Read commands keep working, and a `volatile-*` policy with no suitable candidates produces the same error. So you choose between losing keys you did not choose and losing writes you did. For cache workloads, losing keys is almost always the better trade, provided the application is written to expect it.

## Check your understanding

Answer each of these before reading the answers below.

1. `TTL orders:pending` returns `-1`. What does that say about the key?
2. You run `SET cart:77 "[]" EX 900`, then later `SET cart:77 "[42]"`. What is the TTL afterwards, and which option prevents that?
3. `maxmemory-policy` is `volatile-lru` and no key in the instance has a TTL. Memory reaches `maxmemory`. What happens to the next write?
4. `INFO stats` shows `evicted_keys` climbing steadily. Name two settings worth inspecting first.
5. Your cluster has three nodes. One reports heavy eviction, the others report none. Is that a malfunction?

The answers: (1) the key exists and has no expiration, which is different from `-2`, a key that does not exist; (2) the TTL is gone because `SET` discards it, and `KEEPTTL` would have preserved it; (3) the write fails with the `OOM` error, because a `volatile-*` policy with no candidates behaves like `noeviction`; (4) `maxmemory`, which may simply be too low, and `maxmemory-policy`, which may be evicting the wrong keys; (5) no, `maxmemory` applies per node, so uneven key distribution across hash slots produces exactly this.

## Official resources

- [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [`EXPIRE` command reference](https://redis.io/docs/latest/commands/expire/)
- [`TTL` command reference](https://redis.io/docs/latest/commands/ttl/)
- [`PERSIST` command reference](https://redis.io/docs/latest/commands/persist/)
- [`SET` command reference](https://redis.io/docs/latest/commands/set/)
- [`CONFIG SET` command reference](https://redis.io/docs/latest/commands/config-set/)
- [`INFO` command reference](https://redis.io/docs/latest/commands/info/)
