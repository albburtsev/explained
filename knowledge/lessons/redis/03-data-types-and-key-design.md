---
slug: redis/data-types-and-key-design
title: Core Data Types and Key Design
description: Pick between strings, hashes, lists, sets, and sorted sets, and name keys so a flat key space stays navigable.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - data-modeling
---

A **value type** is the structure Redis keeps under a key. Every key holds exactly one value, and that value has exactly one type. You never declare a schema: the type is fixed when the key is first created, and commands are type-specific. Ask a hash command for a string and the server refuses:

```sh
127.0.0.1:6379> SET user:1042 "Ada"
OK
127.0.0.1:6379> HGET user:1042 name
(error) WRONGTYPE Operation against a key holding the wrong kind of value
```

Five types cover almost every job in this course: strings, hashes, lists, sets, and sorted sets. Choosing among them is the main modeling decision you make in Redis, because the type determines which operations are cheap. The second decision is how you name the key, and it matters more than it looks: the key space is flat, and the key is the only way in.

## Store single values and counters in strings

A **string** is a sequence of bytes, up to 512 MB, that Redis treats as one unit. Use it when the whole value is written and read together: a rendered page, a serialized token, a feature flag.

```sh
127.0.0.1:6379> SET page:home:html "<h1>Home</h1>"
OK
127.0.0.1:6379> GET page:home:html
"<h1>Home</h1>"
```

A string that looks like an integer is also a counter. `INCR` parses the value, adds one, and stores the result in a single atomic step, starting from `0` when the key does not exist. `APPEND` adds bytes to the end and returns the new length, creating an empty string first if the key is missing:

```sh
127.0.0.1:6379> INCR views:2026-09-13
(integer) 1
127.0.0.1:6379> INCR views:2026-09-13
(integer) 2
127.0.0.1:6379> APPEND log:boot "started "
(integer) 8
```

No read-modify-write round trip happens in your application, so two servers incrementing the same counter cannot lose an update; the caching and rate-limiting lessons both rest on that. Most string operations are O(1); the random-access commands `GETRANGE` and `SETRANGE` cost O(N) on large values.

## Group a record's fields in a hash

A **hash** is a map of field-value pairs stored under one key — a record. It is the right type when parts of an object change independently, because you can update one field without rewriting the rest.

```sh
127.0.0.1:6379> HSET user:1042 name "Ada" email "ada@example.com" plan free
(integer) 3
127.0.0.1:6379> HGET user:1042 plan
"free"
127.0.0.1:6379> HINCRBY user:1042 logins 1
(integer) 1
127.0.0.1:6379> HGETALL user:1042
1) "name"
2) "Ada"
3) "email"
4) "ada@example.com"
5) "plan"
6) "free"
7) "logins"
8) "1"
```

`HSET` returns how many fields were newly created, not how many were written. `HINCRBY` gives a counter per field, with the same atomicity as `INCR`. `HGETALL` returns pairs as a flat list; treat the order as unspecified.

Two properties decide a hash against a string holding serialized JSON. A field read or write is O(1) and does not transfer the whole object, and `HINCRBY` on one field cannot clobber a concurrent write to another. The cost is that `HGETALL`, `HKEYS`, and `HVALS` are O(N), so on a hash with thousands of fields prefer `HGET` and `HMGET`. A hash holds up to 2^32 - 1 field-value pairs, but record-sized is what you want.

## Keep insertion order in a list

A **list** is a sequence of strings in insertion order. Pushing and popping at either end is O(1), which makes a list a queue or a short feed of recent items. It is not an index: looking for a particular element costs O(N), and duplicates are allowed.

Push on one end and pop on the other for first-in, first-out delivery:

```sh
127.0.0.1:6379> LPUSH queue:emails "msg:1"
(integer) 1
127.0.0.1:6379> LPUSH queue:emails "msg:2"
(integer) 2
127.0.0.1:6379> RPOP queue:emails
"msg:1"
```

`LRANGE` reads a range by index. Indexes are inclusive and may be negative, so `0 -1` means the whole list:

```sh
127.0.0.1:6379> LPUSH feed:1042 "post:91" "post:92"
(integer) 2
127.0.0.1:6379> LRANGE feed:1042 0 -1
1) "post:92"
2) "post:91"
```

Arguments are pushed left to right, so the last one ends up at the head. For a "most recent" feed, follow each push with `LTRIM feed:1042 0 49`, which discards everything outside the given range. That pairing is what keeps a feed bounded. Without it, the list grows until it becomes the operational problem described further below.

## Test membership and overlap with a set

A **set** is an unordered collection of unique strings. Adding, removing, and testing membership are O(1) regardless of size, which makes sets the natural answer to "have I already seen this?" and to deduplication.

```sh
127.0.0.1:6379> SADD article:88:tags redis databases redis
(integer) 2
127.0.0.1:6379> SISMEMBER article:88:tags redis
(integer) 1
127.0.0.1:6379> SISMEMBER article:88:tags python
(integer) 0
```

Redis ignores the repeated member, so `SADD` reports two additions, and `SISMEMBER` answers `1` or `0`. Sets also do set algebra on the server:

```sh
127.0.0.1:6379> SADD user:1042:likes article:88 article:91
(integer) 2
127.0.0.1:6379> SADD user:2071:likes article:88 article:77
(integer) 2
127.0.0.1:6379> SINTER user:1042:likes user:2071:likes
1) "article:88"
```

`SINTER` computes the intersection, `SUNION` the union, and `SDIFF` the difference. A set holds up to 2^32 - 1 (4,294,967,295) members, but `SMEMBERS` returns all of them in one O(N) reply, so iterate large sets with `SSCAN`.

## Rank and window with a sorted set

A **sorted set** holds unique members, each with a numeric score, kept ordered by that score. Members with equal scores are ordered lexicographically. Most operations are O(log(N)), and a range read is O(log(N) + M) for M results returned.

Scores make this the leaderboard type. `ZADD` sets a score outright; `ZINCRBY` adds to it and returns the new value:

```sh
127.0.0.1:6379> ZADD leaderboard:weekly 100 "wood" 100 "henshaw"
(integer) 2
127.0.0.1:6379> ZINCRBY leaderboard:weekly 50 "wood"
"150"
127.0.0.1:6379> ZRANGE leaderboard:weekly 0 2 REV WITHSCORES
1) "wood"
2) "150"
3) "henshaw"
4) "100"
```

`ZRANGE` reads by index by default, `REV` reverses the order so the highest score comes first, and `WITHSCORES` interleaves each score after its member. Use a timestamp as the score instead and the same type becomes a time-ordered window:

```sh
127.0.0.1:6379> ZADD events:1042 1757721600 "login" 1757725200 "purchase"
(integer) 2
127.0.0.1:6379> ZRANGE events:1042 1757721601 +inf BYSCORE
1) "purchase"
```

With `BYSCORE`, the two bounds are scores rather than indexes. They are inclusive unless prefixed with `(`, and `-inf` and `+inf` stand for no bound. `LIMIT offset count` pages the result. The older `ZRANGEBYSCORE key min max` does the same job and still works, but has been deprecated since Redis 6.2 in favor of `ZRANGE ... BYSCORE`. To keep the window bounded, delete everything older than the cutoff with `ZREMRANGEBYSCORE`; a sorted set of timestamps plus that trim is the shape the rate-limiting lesson uses.

## Match the problem to the type

| The problem | Type | Commands to reach for |
| --- | --- | --- |
| One value always read and written whole | String | `SET`, `GET` |
| A number that several servers increment | String | `INCR`, `INCRBY` |
| A record whose fields change independently | Hash | `HSET`, `HGET`, `HMGET`, `HINCRBY` |
| Work handed from producers to consumers | List | `LPUSH`, `RPOP` |
| The last N items, newest first | List | `LPUSH`, `LTRIM`, `LRANGE` |
| "Have I seen this already?" | Set | `SADD`, `SISMEMBER` |
| What two groups have in common | Set | `SINTER`, `SUNION`, `SDIFF` |
| A ranking or top-N | Sorted set | `ZADD`, `ZINCRBY`, `ZRANGE ... REV` |
| Events inside a time window | Sorted set | `ZADD`, `ZRANGE ... BYSCORE`, `ZREMRANGEBYSCORE` |

When two types fit, ask which reads you need. If you will want a count, an order, or a membership test, choose the type that answers it in one command instead of shipping the whole value to the client.

## Name keys on a deliberate schema

Redis has no namespaces, tables, or folders. The key space is **flat**: every key sits beside every other key in one dictionary, and the only structure is the one you put in the name. The convention is to split a key into sections with `:`, following a schema such as `object-type:id`. A scheme for the examples above might be:

```text
app:user:1042              hash    the user record
app:user:1042:likes        set     articles this user liked
app:leaderboard:weekly     zset    score per user for the current week
app:queue:emails           list    ids of pending outbound email
app:cache:article:88       string  rendered article HTML
```

Four rules keep such a scheme usable:

- **Go from general to specific.** The shared prefix is what lets you match a family of keys with one pattern later.
- **Use one shape per kind of key.** If one user's likes live at `app:user:1042:likes`, every user's do.
- **Balance length against readability.** A 1024-byte key wastes memory and slows key comparisons, but `u1000flw` is a false economy next to `user:1000:followers`. Keys may be up to 512 MB; that is a limit, not a target.
- **Never build a key from unvalidated input.** A user-supplied `:` or `{` silently changes which family — and, in a cluster, which shard — the value belongs to.

The deeper consequence of a flat key space is that **keys are the only index**. Redis will not find values for you by their contents. If the application needs "every session belonging to user 1042", maintain that list yourself, typically as a set at `app:user:1042:sessions`. Design key names and index sets at the same time as the value types.

## Iterate with `SCAN`, never with `KEYS`

A key scheme only pays off if you can walk it, and the shared prefix is what makes that possible. The `redis-cli` lesson introduced the cursor loop: start `SCAN` at cursor `0`, pass back the cursor the server returns, and stop when that cursor is `0` again. Applied to a family of keys, a full iteration looks like this:

```sh
127.0.0.1:6379> SCAN 0 MATCH "app:user:*" COUNT 100
1) "17"
2) 1) "app:user:1042"
   2) "app:user:2071"
127.0.0.1:6379> SCAN 17 MATCH "app:user:*" COUNT 100
1) "0"
2) 1) "app:user:3155"
```

`MATCH` filters with glob patterns, `COUNT` hints at how much work to do per call, and `TYPE` restricts the results to one value type. Because a full iteration may return the same key more than once, make whatever you do with each key safe to repeat. `SSCAN`, `HSCAN`, and `ZSCAN` iterate the members of one large collection the same way.

`KEYS pattern` answers the same question in one reply, and that is exactly the problem: it is O(N) over the whole key space and holds the single command thread for the entire scan. The documentation calls it a debugging command and tells you to keep it out of application code.

## Keep any single key from becoming a hazard

A list with a million elements is not wrong, but it is an operational hazard. Every problem below follows from one fact: a key is one indivisible unit.

- Reading it whole blocks everyone. `LRANGE key 0 -1`, `HGETALL`, and `SMEMBERS` are O(N) on the single command thread, so one such call adds latency to every other client.
- Deleting it blocks too. `DEL` frees all the memory inline; `UNLINK` removes the key from the key space in O(1) and reclaims the memory in another thread.
- Expiry is all-or-nothing. A key expires as a whole, so a huge collection cannot age out gradually.
- In a cluster, one key lives on one node, so a huge key makes one shard hot and cannot be rebalanced away.

Prevent it rather than repair it. Split by time or owner (`app:feed:1042:2026-09`), cap collections as you write them with `LTRIM`, `ZREMRANGEBYRANK`, or `ZREMRANGEBYSCORE`, and read ranges instead of whole collections. To find offenders in an existing instance, `redis-cli --bigkeys` samples the key space for keys with the most elements and `--memkeys` for the ones using the most memory; both iterate with `SCAN`, so they are safe to run against a live server.

## Expect slot rules under Redis Cluster

Redis Cluster splits the key space into 16384 hash slots, assigning each key with `HASH_SLOT = CRC16(key) mod 16384`, and gives each node a range of slots. A multi-key command works only when every key it touches maps to the same slot. Otherwise the server rejects it:

```sh
127.0.0.1:7000> SINTER user:1042:likes user:2071:likes
(error) CROSSSLOT Keys in request don't hash to the same slot
```

This affects any command that names several keys, including `SINTER`, `SUNION`, `MGET`, `MSET`, `DEL`, `RENAME`, transactions, and Lua scripts.

A **hash tag** forces related keys onto one slot. If a key contains `{` followed by `}` with at least one character between them, only that substring is hashed:

```sh
127.0.0.1:7000> SINTER likes:{feed}:1042 likes:{feed}:2071
1) "article:88"
```

Both keys now hash on `feed`, so they share a slot and the intersection runs. `CLUSTER KEYSLOT key` reports the slot for any key.

Use tags sparingly. Every key carrying the same tag lands on the same node, so a popular tag re-creates the hot-shard problem the cluster exists to avoid. Also note that `KEYS` and `SCAN` cover only the node that receives them, not the whole cluster.

## Check your understanding

Answer these before moving on.

1. You cache a user profile whose `last_seen` timestamp updates on every request but whose name and email rarely change. String or hash, and why?
2. A colleague stores each user's liked article ids as a comma-separated string and asks the application to check membership. Which type replaces this, and which single command replaces the check?
3. You need the top ten scores this week and the ability to add points to one player atomically. Which type and which two commands?
4. An admin endpoint calls `KEYS session:*` to count active sessions. Name the problem and two ways to fix it.
5. In a cluster, `SINTER user:1042:likes user:2071:likes` fails. What happened, and what is the cost of fixing it with a hash tag?

Expected answers: 1. A hash, so `last_seen` updates with one O(1) `HSET` or `HINCRBY` instead of rewriting the whole record and racing other writers. 2. A set, and `SISMEMBER`, which is O(1) and cannot be corrupted by a value containing a comma. 3. A sorted set, with `ZINCRBY` to add points and `ZRANGE key 0 9 REV WITHSCORES` to read the top ten. 4. `KEYS` is O(N) over the key space and blocks every other client while it runs; iterate with `SCAN` instead, or keep an explicit set or counter of active sessions so the answer is one command. 5. The two keys hash to different slots, so the cluster refuses the cross-slot command; a shared hash tag puts them in one slot at the cost of pinning every key with that tag to a single node.

## Official resources

- [Redis data types](https://redis.io/docs/latest/develop/data-types/)
- [Keys and values](https://redis.io/docs/latest/develop/using-commands/keyspace/)
- [Redis hashes](https://redis.io/docs/latest/develop/data-types/hashes/)
- [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/)
- [`SCAN`](https://redis.io/docs/latest/commands/scan/) and [`KEYS`](https://redis.io/docs/latest/commands/keys/)
- [`ZRANGE`](https://redis.io/docs/latest/commands/zrange/)
- [Multi-key operations](https://redis.io/docs/latest/develop/using-commands/multi-key-operations/)
- [Redis cluster specification: hash tags](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/#hash-tags)

The next lesson gives keys a lifetime, so the counters and cached records you just modeled disappear on schedule instead of filling memory.
