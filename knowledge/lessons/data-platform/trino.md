---
slug: data-platform/trino
title: 'Trino: Querying Data Where It Lives'
description: How Trino answers SQL across object storage and databases it does not own, and the workloads it is wrong for.
tags:
  - data-engineering
  - data-platform
  - trino
  - sql
  - analytics
---

The previous two lessons gave data a home: Iceberg tables sitting on object storage, organized as a lakehouse. Something still has to answer questions about them. `Trino` is a distributed SQL query engine designed to query large data sets spread over one or more heterogeneous data sources. It reads data where that data already lives, computes the answer across a cluster of machines, and returns rows. It stores nothing of its own.

That last sentence is the whole idea. Every system in this course so far owns some bytes. Trino owns none.

## What Trino is

A Trino cluster has two kinds of servers. The `coordinator` parses your SQL, plans the query, and manages the rest of the cluster. The `worker` nodes execute the pieces of that plan and process the actual data. You send SQL to the coordinator; the coordinator decides how to split the work; the workers do it in parallel and exchange intermediate results between themselves.

Execution is massively parallel and mostly in memory. The coordinator breaks a query into stages, stages into tasks spread across workers, and tasks into splits — sections of the input data. Workers stream rows through operators and pass intermediate results to each other over the network rather than writing them to disk between steps. This is why Trino returns results in seconds on data sizes where a disk-checkpointing batch engine takes minutes.

Trino reaches data through a `connector`, an adapter for one kind of data source: Iceberg or Hive tables on object storage, PostgreSQL, MySQL, Cassandra, Kafka, Elasticsearch, and many more. You configure a `catalog` — a named set of properties naming one connector plus its connection details — and that catalog becomes the first part of every table name. A fully qualified table is `catalog.schema.table`, so `lakehouse.sales.orders` and `crm.public.customers` can be two entirely different systems.

Because catalogs are just names in the same SQL namespace, one query can span them:

```sql
SELECT c.name, sum(o.total) AS lifetime_value
FROM lakehouse.sales.orders AS o
JOIN crm.public.customers AS c ON c.id = o.customer_id
GROUP BY c.name
ORDER BY lifetime_value DESC
LIMIT 20;
```

This is a `federated query`: one statement joining Iceberg tables on object storage with a live PostgreSQL table, with no pipeline copying one into the other first. Trino pulls from both sources, joins in memory on its workers, and returns the result.

A note on the name. Trino began as Presto, created at Facebook in 2012. In 2019 the original creators forked the project as PrestoSQL, and in December 2020 they renamed it Trino after a trademark dispute over the Presto name. The original project continues separately as PrestoDB under the Linux Foundation. When you read older documentation or a paper titled *Presto: SQL on Everything*, it describes the ancestor of what is now Trino.

## Why it exists

Before engines like this, answering a question about data in several systems meant moving the data first: build a pipeline, load everything into a data warehouse, then query it there. That works, but every new question that touches a new source waits on a new pipeline, and the warehouse copy is always somewhat behind the source.

Trino exists to remove that wait for a large class of questions. Three motivations are worth separating:

- **Query in place.** You can ask a question of data that was never loaded anywhere. The lakehouse tables from the previous lesson are queryable the moment they are written, and a production database can join into the same query without an export step.
- **One SQL dialect across sources.** Analysts write ANSI SQL once instead of learning each source's query language. Trino translates, within the limits of each connector.
- **ANSI SQL over lakehouse tables.** This is the role Trino plays in the architecture of this course. Iceberg gives files on object storage a schema, snapshots, and safe concurrent writes; Trino supplies the SQL engine that a lakehouse otherwise lacks. Through the Iceberg connector it also writes: `INSERT`, `UPDATE`, `DELETE`, `MERGE`, plus Iceberg-specific operations like reading an older snapshot.

Put simply: Iceberg made the table, and Trino made it queryable the way a warehouse table is queryable.

## Where its limits are

The limits follow directly from what Trino is, and mistaking them is the usual way teams get hurt.

**It is not a database and not durable storage.** Trino has no storage layer of its own. If the underlying source loses data, Trino has nothing to offer. It also holds no long-lived state about your tables beyond what the connector's catalog provides. Treat it as a compute layer you could delete and rebuild.

**It is not for OLTP.** The documentation is explicit that Trino is not a replacement for MySQL, PostgreSQL, or Oracle. There is no transactional workload here: no point lookup of one row by primary key in a millisecond, no high-rate single-row updates, no serving path for an application. The `MERGE` and `UPDATE` support on connectors like Iceberg is batch-shaped data management, not an OLTP write path. Analytical questions over many rows are the target; single-row operations are not.

**It is tuned for interactive analytics, not long ETL.** By default a Trino query has no mid-query fault tolerance: if a worker dies, the query fails and must be rerun from the start. That is a deliberate trade for speed. `Fault-tolerant execution` exists as an opt-in mode with `QUERY` and `TASK` retry policies, where `TASK` requires an exchange manager spooling intermediate data to external storage — but it is disabled by default and adds latency for short queries. The documentation's own recommendation is to run separate clusters for batch and interactive workloads. If your job runs for six hours and must survive node failures, reach for a batch engine such as Spark, or split the work into steps that a scheduler retries.

**Queries are memory-bound.** Because Trino holds intermediate results in memory, a query that needs more than the cluster has does not slow down gracefully — it is killed. Limits such as `query.max-memory-per-node` and `query.max-memory` exist precisely to enforce this. A join whose build side does not fit, or an aggregation over unexpectedly high cardinality, fails rather than spilling its way to a slow answer.

**Connector pushdown decides real performance.** Pushdown means delegating work to the source instead of pulling rows across the network: predicate, projection, aggregation, join, limit, and top-N pushdown all exist, and support is specific to each connector and the underlying system. When a filter pushes down, the source scans and returns a small result. When it does not, Trino drags the full table over the network and filters it itself. The same SQL can be fast against one catalog and ruinous against another, and nothing in the query text tells you which — you read the query plan.

**Federation across slow sources is a trap.** The ability to join anything to anything invites queries that no one should run. Joining a petabyte-scale lakehouse table to a production OLTP database means Trino may read large amounts from that database over the network, competing with the application it serves. Federation is best when one side is small or well filtered, and the pushdown actually happens.

## Typical use cases

- **Interactive analytics over the lakehouse.** The most common role: BI dashboards and ad hoc exploration against Iceberg tables on object storage, where a warehouse's compute is replaced by a Trino cluster.
- **Ad hoc questions that cross systems.** Enriching event data in the lake with reference data from an operational database, without waiting to build a pipeline.
- **Reporting and large aggregations.** Data analysis, aggregating large data sets, and producing reports — the OLAP work Trino names as its purpose.
- **A single SQL entry point.** Giving analysts one endpoint and one dialect for many sources, so tool configuration stops multiplying with the number of storage systems.
- **Exploration before committing to a pipeline.** Query the raw data in place, learn what is there, and only then decide what deserves a modeled table built by a batch job — the work of Apache Spark, the next lesson.

## Check your understanding

Answer before reading on:

1. Where does Trino keep the tables you query?
2. Your query joins `lakehouse.events` to `crm.public.users`, and it is far slower than expected. What is the first mechanism to suspect?
3. A nightly transformation runs for two hours on Trino and fails near the end when a worker is replaced. What does the default behavior do, and what would you change?
4. A report's `GROUP BY` over a high-cardinality column suddenly fails instead of running slowly. Why?
5. An application team asks to serve a user profile lookup through Trino. What do you tell them?

Answers: (1) Nowhere — Trino owns no storage; the tables live in object storage or in the source databases, and Trino reads them through connectors. (2) Pushdown: the filter or aggregation probably is not being delegated to a source, so Trino is pulling rows over the network; check the query plan. (3) The whole query fails and would rerun from the start, because fault-tolerant execution is off by default; enable the `TASK` retry policy with an exchange manager, or move the job to a batch engine and let a scheduler retry smaller steps. (4) Trino keeps intermediate results in memory, so exceeding the configured query memory limits kills the query rather than degrading it. (5) No — Trino is not an OLTP database and not a serving path; a single-row lookup belongs in the application's own database.

## Official resources

- [Trino overview](https://trino.io/docs/current/overview.html) and [use cases](https://trino.io/docs/current/overview/use-cases.html)
- [Trino concepts: coordinator, worker, connector, catalog](https://trino.io/docs/current/overview/concepts.html)
- [Pushdown](https://trino.io/docs/current/optimizer/pushdown.html)
- [Fault-tolerant execution](https://trino.io/docs/current/admin/fault-tolerant-execution.html)
- [Resource management properties](https://trino.io/docs/current/admin/properties-resource-management.html)
- [Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
- [We're rebranding PrestoSQL as Trino](https://trino.io/blog/2020/12/27/announcing-trino.html)
