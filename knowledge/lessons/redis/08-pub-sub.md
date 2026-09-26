---
slug: redis/pub-sub
title: Pub/Sub for Real-Time Messaging
description: Broadcast messages to many listeners with SUBSCRIBE and PUBLISH, use patterns and introspection, and recognize the at-most-once limits that point to Redis Streams.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - pub-sub
---

**Pub/Sub** is a messaging pattern in which a publisher sends a message to a named **channel** instead of to a named receiver. Redis pushes that message to every client currently subscribed to the channel. The publisher does not know how many subscribers exist, and the subscribers do not know who published. That decoupling is the whole point: you can add or remove listeners without changing the code that sends.

Pub/Sub has no relation to the keyspace. Channels are not keys, they are not stored, and they are not affected by the expiration and eviction rules from earlier in this course. A channel exists only while at least one client is subscribed to it.

## Send your first message between two terminals

Open two terminal windows. In the first, start `redis-cli` and subscribe to a channel:

```sh
redis-cli
```

```sh
127.0.0.1:6379> SUBSCRIBE news
Reading messages... (press Ctrl-C to quit)
1) "subscribe"
2) "news"
3) (integer) 1
```

The three-element reply is the server confirming the subscription: the message kind, the channel, and the number of channels and patterns this connection is now subscribed to. The terminal now blocks and waits.

In the second window, start another `redis-cli` and publish:

```sh
127.0.0.1:6379> PUBLISH news "hello"
(integer) 1
```

`PUBLISH` returns an integer: the number of clients that the message was sent to. Here that is `1`, your subscriber. Look back at the first window, which has printed a new message:

```sh
1) "message"
2) "news"
3) "hello"
```

Now press `Ctrl-C` in the first window to leave subscribed mode, and publish again:

```sh
127.0.0.1:6379> PUBLISH news "anyone there?"
(integer) 0
```

The reply is `0`. The message was delivered to nobody and is gone. Nothing was stored, and nothing failed. Remember this result — it is the core of the lesson.

## Subscribe to many channels with one pattern

`PSUBSCRIBE` subscribes to glob-style patterns rather than exact channel names. A subscriber that wants every news category does not need to list them:

```sh
127.0.0.1:6379> PSUBSCRIBE "news.*"
Reading messages... (press Ctrl-C to quit)
1) "psubscribe"
2) "news.*"
3) (integer) 1
```

Publish to a channel that matches the pattern from the other window:

```sh
127.0.0.1:6379> PUBLISH news.music.jazz "new set list"
(integer) 1
```

The pattern subscriber receives a four-element message of kind `pmessage`, which adds the pattern that matched:

```sh
1) "pmessage"
2) "news.*"
3) "news.music.jazz"
4) "new set list"
```

Note the separate message kind. A client subscribed both to `news` and to `new*` receives two copies of a message published to `news`: one `message` and one `pmessage`. Redis does not deduplicate.

`UNSUBSCRIBE` removes channel subscriptions and `PUNSUBSCRIBE` removes pattern subscriptions. With no arguments, each removes all of them. The server acknowledges with the same three-element shape, where the last element counts the remaining subscriptions:

```sh
1) "unsubscribe"
2) "news"
3) (integer) 0
```

When that count reaches zero, the connection leaves Pub/Sub state. In `redis-cli` you cannot type `UNSUBSCRIBE` while subscribed, because the prompt is busy reading messages; press `Ctrl-C` instead. A real client library sends the command on the connection.

## Inspect who is listening

`PUBSUB` reports the current subscription state, and you can run it from any ordinary connection:

```sh
127.0.0.1:6379> PUBSUB CHANNELS
1) "news"
2) "cache:invalidate"
```

`PUBSUB CHANNELS` lists active channels, meaning channels with at least one subscriber. Clients subscribed only through patterns are excluded. Pass an optional glob pattern to narrow the list:

```sh
127.0.0.1:6379> PUBSUB CHANNELS "cache:*"
1) "cache:invalidate"
```

`PUBSUB NUMSUB` counts subscribers per channel and replies with alternating channel names and counts:

```sh
127.0.0.1:6379> PUBSUB NUMSUB news sports
1) "news"
2) (integer) 1
3) "sports"
4) (integer) 0
```

Pattern subscribers are excluded here too; `PUBSUB NUMPAT` returns the number of distinct patterns instead. These commands are your debugging tools. When a message seems lost, check whether anyone was subscribed at all.

## Know that a subscribed connection is restricted

Under the RESP2 protocol, a connection in subscribed state accepts only a small set of commands: `SUBSCRIBE`, `UNSUBSCRIBE`, `PSUBSCRIBE`, `PUNSUBSCRIBE`, `SSUBSCRIBE`, `SUNSUBSCRIBE`, `PING`, `RESET`, and `QUIT`. Send `GET` or `SET` on that connection and the server replies with an error instead of running it.

The practical consequence is that a subscriber needs its own dedicated connection. An application that both listens for events and reads cached values must hold two connections, which is why client libraries open a separate one for Pub/Sub. Under RESP3, negotiated with `HELLO 3`, this restriction is lifted and a client may issue any command while subscribed, because push messages are a distinct reply type on the wire.

## Use it to fan out a live update

Pub/Sub fits problems where many processes must learn about something at the same moment.

Imagine an application running on several servers, each holding open WebSocket connections to browsers. A user posts a comment on one server. That server publishes once:

```sh
127.0.0.1:6379> PUBLISH room:42 "{\"user\":\"ada\",\"text\":\"shipped\"}"
(integer) 3
```

All three servers are subscribed to `room:42`, so each receives the message and forwards it to the browsers it is holding. The publishing server never needs a list of its peers.

The same shape solves cache invalidation. In the caching lesson you deleted a cache key after a write. If each server also keeps a small local in-process cache, deleting the Redis key is not enough — the copies inside the other processes are still stale. Publish the invalidation instead:

```sh
127.0.0.1:6379> DEL user:1001
(integer) 1
127.0.0.1:6379> PUBLISH cache:invalidate "user:1001"
(integer) 3
```

Every peer subscribed to `cache:invalidate` drops its local copy. This works because a missed invalidation is survivable: the worst case is one server serving stale data until its own entry expires.

## Accept that delivery is fire-and-forget

This is the most important thing to take away. Redis Pub/Sub has **at-most-once** delivery semantics: a message is delivered once if at all. Be precise about what that means:

- **No persistence.** A message is never written to the keyspace, to the RDB file, or to the AOF. It exists only while Redis is pushing it to sockets.
- **No delivery to absent subscribers.** A subscriber that is disconnected or restarting at the moment of the `PUBLISH` receives nothing. There is no queue holding the message until it returns.
- **No acknowledgement.** The publisher learns how many clients the message was *sent to*, not how many processed it. A subscriber that crashes mid-handler is indistinguishable from one that succeeded.
- **No replay.** There is no way to ask for messages you missed. Once sent, the message is gone.
- **No retry.** Redis never sends a message a second time.

There is one more failure mode that surprises people. Redis buffers output per client, and a subscriber that reads slower than messages arrive makes its buffer grow. Redis caps that buffer for Pub/Sub clients — by default a hard limit of 32 megabytes and a soft limit of 8 megabytes sustained for 60 seconds — and **closes the connection** when a limit is reached. A slow consumer is therefore not merely delayed; it is disconnected, and every message published while it reconnects is lost.

The design rule follows directly: use Pub/Sub only when a lost message is acceptable. Live presence indicators, dashboard tickers, chat fan-out, and cache invalidation all qualify. Order confirmations, payments, and job dispatch do not.

## Watch out under Redis Cluster

Classic Pub/Sub ignores slots. Because a channel is not a key, it hashes to nothing, so Redis Cluster forwards every published message across the cluster bus to **every node**, whether or not that node has a subscriber. Clients can therefore publish to any node and subscribe on any node and the message still arrives. The convenience costs bandwidth that grows with the number of nodes, which makes global Pub/Sub the wrong thing to scale by adding nodes.

Two smaller details follow from the same design. `PUBLISH` returns only the number of clients connected to the *same node* as the publisher, so the count is not a cluster-wide total. `PUBSUB CHANNELS` and `PUBSUB NUMSUB` likewise report only the node you asked, not the whole cluster.

Redis 7.0 added **sharded Pub/Sub** to fix the bandwidth problem. `SSUBSCRIBE`, `SUNSUBSCRIBE`, and `SPUBLISH` treat the shard channel name like a key: it hashes to a slot, and the message propagates only within the shard that owns that slot.

```sh
127.0.0.1:6379> SPUBLISH orders "hello"
(integer) 1
```

Subscribers must connect to the node owning the slot, or to one of its replicas. In exchange, message traffic stays inside one shard, so adding shards scales Pub/Sub capacity instead of multiplying traffic. On a single instance the two families behave alike; the difference appears only in a cluster.

## Reach for Streams when you need guarantees

When a lost message is not acceptable, the answer is not a cleverer use of Pub/Sub. It is a different data type.

A **Redis Stream** is an append-only log stored under a normal key. Entries persist, carry ordered IDs, and stay available for later readers. `XADD` appends an entry, `XREAD` reads entries after a given ID, and `XREADGROUP` reads on behalf of a **consumer group**, which distributes entries across workers and tracks which ones each consumer has not yet acknowledged. That combination gives you what Pub/Sub cannot: a subscriber that was offline can come back and read what it missed, and an entry stays pending until it is acknowledged.

Those commands are pointers, not this lesson's material. The judgement you need now is simply which question to ask: *may this message be lost?* If yes, Pub/Sub is the smallest tool that works. If no, start with Streams — and if you need durable routing, dead-letter handling, or cross-system delivery guarantees, a dedicated message broker is the honest answer rather than a data store you are bending into one.

## Check your understanding

Answer before reading on:

1. You run `PUBLISH alerts "disk full"` and get `(integer) 0`. Is the message queued for the next subscriber?
2. A subscriber restarts and takes four seconds to reconnect. Which messages does it receive for that gap?
3. A client runs `SUBSCRIBE news` and then `GET user:1` on the same RESP2 connection. What happens?
4. A client is subscribed to `news` and to the pattern `ne*`. How many messages does it receive from one `PUBLISH news "hi"`?
5. In a six-node cluster, one client publishes with `PUBLISH`. How far does that message travel?

Answers: (1) No — the message is discarded, and `0` simply means no client was subscribed at that instant. (2) None; there is no buffer or replay, so the gap is a permanent hole. (3) The server rejects `GET` with an error, because a subscribed RESP2 connection accepts only subscription commands, `PING`, `RESET`, and `QUIT`. (4) Two — one `message` and one `pmessage`, because Redis does not deduplicate across subscription types. (5) To all six nodes over the cluster bus, since classic channels are not assigned to slots; `SPUBLISH` would have confined it to one shard.

## Official resources

- [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/)
- [`SUBSCRIBE`](https://redis.io/docs/latest/commands/subscribe/) and [`PUBLISH`](https://redis.io/docs/latest/commands/publish/)
- [`PSUBSCRIBE`](https://redis.io/docs/latest/commands/psubscribe/) and [`PUBSUB CHANNELS`](https://redis.io/docs/latest/commands/pubsub-channels/)
- [`SPUBLISH`](https://redis.io/docs/latest/commands/spublish/) and [`SSUBSCRIBE`](https://redis.io/docs/latest/commands/ssubscribe/)
- [Redis client handling: output buffer limits](https://redis.io/docs/latest/develop/reference/clients/)
- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)

You now have the whole shape of the course. Redis is a fast in-memory store whose data types you choose deliberately, whose keys you name so they stay readable, and whose expiration and eviction rules decide what survives. On that base you built the four patterns that put Redis into a distributed system: a cache in front of a slow database, a counter that limits request rates, a lock that expires so a dead holder cannot block the system forever, and now a channel that broadcasts to everyone listening. The thread running through all four is the same trade: Redis gives you speed by keeping data in memory, so every pattern you build on it must stay correct when that data disappears. Design for it, and Redis becomes a dependable part of your architecture rather than a hidden single point of failure.
