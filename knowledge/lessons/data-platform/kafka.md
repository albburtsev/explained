---
slug: data-platform/kafka
title: "Kafka: Moving Events Between Systems"
description: What Apache Kafka is as a durable partitioned log, why it decouples producers from consumers, and where it stops being the right tool.
tags:
  - kafka
  - streaming
  - data-platform
  - distributed-systems
---

The ingestion layer of a data platform has one job: get events out of the systems that produce them and make them available to every system that needs them. Apache Kafka is the tool most platforms use for that job. It is worth understanding precisely, because almost everything downstream — the tables, the queries, the schedules — reads data that arrived this way.

The usual one-line description, "Kafka is a message queue," is the source of most misunderstandings about it. Kafka is not a queue. It is a log.

## What Kafka is

Kafka stores `events` — records of something that happened, each with a key, a value, a timestamp, and optional headers. Events are grouped into a `topic`, a named, durable stream such as `orders` or `page-views`. Applications that write events are `producers`; applications that read them are `consumers`. Kafka itself is a cluster of servers called `brokers`.

The important part is how a topic stores its events.

Each topic is split into one or more `partitions`. A partition is an append-only log: new events go on the end, and nothing is ever inserted into the middle or updated in place. Every event in a partition gets an `offset`, a sequential integer marking its position. A partition is replicated across several brokers — a `replication factor` of 3 is the common production setting — so a broker can fail without losing data.

This structure produces the two properties everything else depends on:

- **Order is per partition, not per topic.** Kafka guarantees that any consumer of a given topic-partition reads that partition's events in exactly the same order they were written. Across partitions, there is no ordering guarantee at all. Kafka routes events with the same key to the same partition, so choosing a key such as `customer_id` is how you decide what stays in order.
- **Reading does not consume.** Events are not deleted after consumption. A consumer's entire position is one number per partition: the offset of the next event it will read. Ten consumers can read the same partition independently, and any of them can move its offset backwards and read the same events again.

How long events stay is a retention policy, configured per topic rather than decided by readers. Time- or size-based retention discards events older than the limit. The alternative is `log compaction`: instead of deleting by age, Kafka keeps at least the last known value for each event key, which turns a topic into a replayable snapshot of current state.

A `consumer group` is how several consumer instances share the work. Each partition in a subscribed topic is assigned to exactly one consumer in the group at a time, and Kafka rebalances the assignment when instances join or leave. A topic with 12 partitions supports up to 12 working consumers in one group; a thirteenth sits idle. Two different groups reading the same topic each get a full copy of the stream, tracking their own offsets independently.

| Concept | What it is |
| --- | --- |
| Topic | A named, durable stream of events |
| Partition | One append-only log within a topic; the unit of ordering and parallelism |
| Offset | An event's sequential position in its partition |
| Consumer group | A set of consumers that split a topic's partitions between them |
| Retention | The per-topic rule for how long events are kept |

One operational fact worth knowing, because older material contradicts it: Kafka used to depend on Apache ZooKeeper for cluster metadata. Kafka 4.0 was the first major release to operate entirely without ZooKeeper, and from it onwards Kafka supports only `KRaft` mode, where the brokers manage cluster metadata themselves. If a tutorial tells you to start ZooKeeper, it predates Kafka 4.0.

## Why it exists

Without Kafka, a system that produces events calls each system that needs them. Five producers and five consumers is twenty-five point-to-point integrations to write, deploy, and keep compatible, and adding a consumer means changing producers. Kafka replaces that with one write and many independent reads. This is the central argument for it:

- **Decoupling.** A producer appends to a topic and is done. It does not know how many consumers exist, whether they are running, or how fast they are. Adding a fraud detector, an analytics pipeline, or an audit log means adding a consumer group — no producer change.
- **Fan-out.** Because reading does not consume, one stream feeds many unrelated purposes at once: a real-time service, a batch load into the storage layer, and a debugging tool can all read the same `orders` topic.
- **Replay.** Events stay for the retention period, so a consumer with a bug can be fixed and restarted from an earlier offset. A new service can be backfilled from history rather than starting empty. A queue that deletes on acknowledgement cannot do this.
- **Back-pressure absorption.** Consumers pull from Kafka rather than being pushed to. A slow consumer simply falls behind — its offset lags, while the log keeps accepting writes at full speed. Bursts land in durable storage instead of overwhelming a downstream system or being dropped.

Kafka is fast at this because of what it refuses to do. There is no per-message state on the broker, no locking, no tracking of which consumer got which message. Appending to a file and serving sequential reads from it is a simple problem, and Kafka's throughput comes from keeping it simple.

## Where its limits are

Every one of those design choices costs something, and the costs decide when Kafka is the wrong answer.

**It is not a task queue.** Traditional brokers track each message individually: a consumer acknowledges one message, another message is redelivered after a timeout, a failing message goes to a dead-letter queue. Kafka has none of that per-message machinery. Committing offset 500 means events up to 500 are done; you cannot acknowledge 501 while leaving 500 outstanding. One poison event blocks its partition until your code handles it explicitly. For work distribution with per-job retries and priorities, a task queue or a workflow engine fits better.

**It is not a database.** A consumer reads a partition sequentially from an offset. There is no query, no index, no "give me the events for customer 42." Getting a filtered view means reading the stream and building that view elsewhere — which is exactly what the storage and query layers of the platform are for.

**Ordering is narrower than people assume.** Global ordering across a topic requires a single partition, which means a single consumer and no parallelism. In practice you pick a partition key and accept that events with different keys may be processed out of order.

**It is operationally heavy.** A production cluster means brokers, replication, partition counts chosen in advance, consumer group rebalances, lag monitoring, schema management for the event format, and the storage bill for retained data. Partition count in particular is easy to increase and awkward to reduce, and changing it changes which key lands where.

**It is oversized for low volume.** If two services exchange a few thousand events a day, a database table, a managed queue, or a direct API call will be cheaper to run and easier to reason about. Kafka earns its complexity through sustained volume, multiple independent consumers, or a genuine need for replay. If none of those apply, it is infrastructure you maintain for nothing.

## Where it shows up

The recurring patterns:

- **Event backbone.** Services publish business events — order placed, payment settled, item shipped — and any service that cares subscribes.
- **Ingestion into the storage layer.** A continuous stream of clicks, sensor readings, or logs lands in Kafka and is written in batches into the platform's tables.
- **Change data capture.** A connector reads a database's replication log and publishes every row change as an event, keeping search indexes, caches, and analytics stores in sync without the application writing to each one.
- **Stream processing.** Jobs read topics, aggregate or join them in flight, and write results back to other topics — running totals, sessionization, real-time alerting.
- **Buffering between mismatched systems.** A fast producer and a slow or intermittently available consumer are connected through a log that tolerates the gap.

The thread through all of them: several consumers with different needs and speeds reading one durable, replayable history. When only one consumer will ever read each message and history is worthless once processed, you are describing a queue, not a log.

Kafka moves events. The next lesson covers what happens when they land — how Apache Iceberg turns the files written from a stream like this into tables you can actually query.

## Official resources

- [Kafka introduction and core concepts](https://kafka.apache.org/intro)
- [Kafka design: guarantees, consumer pull model, and log compaction](https://kafka.apache.org/design)
- [Kafka use cases](https://kafka.apache.org/uses)
- [Apache Kafka 4.0.0 release announcement (ZooKeeper removal)](https://kafka.apache.org/blog/2025/03/18/apache-kafka-4.0.0-release-announcement/)
