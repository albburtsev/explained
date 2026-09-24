---
slug: data-platform/platform-architecture
title: How a Data Platform Fits Together
description: See why analytics needs its own platform, how ingestion, storage, query, and orchestration divide the work, and where Kafka, Iceberg, Trino, and Airflow sit.
tags:
  - data-engineering
  - data-platform
  - architecture
  - olap
---

As an application developer you already run a data system: a database behind a service, with a schema, indexes, and transactions. It answers questions like *what is in order 4812?* in a millisecond, thousands of times a second, while other requests write to the same rows.

Now the business asks a different question: *how did average delivery time change by region over the last three years, for customers who first ordered during a promotion?* Nothing about that question is unusual, and your production database is the wrong place to answer it. It would read most of the table, hold resources for minutes, and compete with the traffic that pays for the system. The data it needs also lives in several places — orders in one service's database, shipments in another's, click events in a log.

A data platform exists to answer the second kind of question without damaging the first kind of system. This lesson gives you the map: the jobs a platform is made of, and which tool does which. The later lessons visit each tool in turn.

## Separate the two kinds of work

The distinction that motivates the whole platform is `OLTP` (online transaction processing) versus `OLAP` (online analytical processing). These are not two products; they are two workloads with opposite requirements.

| | OLTP | OLAP |
| --- | --- | --- |
| Typical query | Read or write a few rows by key | Scan millions of rows, aggregate a few columns |
| Latency target | Milliseconds | Seconds to minutes |
| Concurrency | Many small concurrent transactions | Few large queries |
| Data scope | One service's current state | Many sources, including history |
| Optimized for | Correct, isolated writes | Reading large volumes cheaply |
| Storage layout | Usually row-oriented | Usually column-oriented |

The last row is the one that decides the rest. A transactional database stores a row's fields together, because a transaction touches whole rows. An analytical system stores each column together, because a report reads three columns out of eighty and wants to skip the rest without reading it. The same data, laid out for a different question.

So the platform's first principle is: copy the data out of the operational systems into a place designed for the second workload, and keep it current. Everything else follows from that sentence.

## Name the four jobs

Almost every analytical platform, whatever it is built from, divides into four jobs.

**Ingestion and event transport.** Getting data out of the systems that produce it — application databases, services, devices, third-party APIs — and delivering it to the platform, either in batches or continuously as events happen. This layer's hard problems are decoupling (a producer must not wait for every consumer), buffering (consumers fall behind and must catch up), and replay (a consumer that was broken for a day needs yesterday's data again).

**Storage and table format.** Where the data rests. Modern platforms keep the bytes in `object storage`: a service that stores files by name, cheaply and durably, with no server to keep running. Cheap files alone are not tables, though. A directory of files has no schema, no way to change one record safely, and no way for two writers to avoid corrupting each other. A `table format` is the metadata layer that turns a set of files into a table — with columns, types, versions, and rules for concurrent writes.

**Query engine.** The component that accepts SQL, plans the work, splits it across many machines, reads the storage layer, and returns rows. In this architecture the engine is separate from the storage: the data is not "inside" the engine, and more than one engine can read the same tables.

**Orchestration.** The platform is not one pipeline but hundreds of dependent tasks — load, clean, join, aggregate, publish — that must run in the right order, on a schedule, with retries when a step fails and a way to re-run last Tuesday after a bug is fixed. An `orchestrator` owns that dependency graph and its execution.

These four are a division of labour, not a strict sequence. Data can loop back: a query engine's output becomes a new table that another job reads.

## Place the tools

Here is where the rest of the course fits.

| Job | Tool in this course | One-line role |
| --- | --- | --- |
| Ingestion and event transport | Apache Kafka | A durable, replayable log of events that many producers write and many consumers read independently |
| Storage and table format | Apache Iceberg | Table metadata that makes files in object storage behave like real tables with schemas and versions |
| Architecture pattern | Lakehouse | The design that puts warehouse-style tables directly on lake storage instead of loading them into a warehouse |
| Query engine | Trino | A distributed SQL engine that queries large datasets across sources it does not own |
| Orchestration | Apache Airflow | A platform for developing, scheduling, and monitoring batch-oriented workflows defined as code |

A few placements deserve a note now, because they are the ones newcomers get wrong.

Kafka is in the ingestion row, but it is not a queue you drain. It stores events durably for a configured retention period, and reading an event does not delete it — which is what makes replay and independent consumers possible. It is also not a database: you do not ask it analytical questions.

Iceberg is a specification, not a running service. Nothing "runs Iceberg" the way something runs a database. It defines how metadata describes a table so that independent engines can read and write the same table safely and at the same time.

Trino is a query engine with no storage of its own. Its documentation is explicit that it is not a general-purpose relational database and was not designed for OLTP — it is built for analytics: scanning, aggregating, reporting. It reads Iceberg tables in object storage, and it can also read your operational databases directly.

Airflow schedules and monitors work; it does not move or transform the data itself. A task tells some other system to do the work. Its model is batch-oriented — runs with a beginning and an end — which is exactly why Kafka sits in a different row.

## Follow one question through the platform

Take the delivery-time question from the opening and trace it.

1. Order and shipment services emit events as they happen. Kafka carries those events and retains them, so a slow or restarted consumer can catch up without asking the services to resend anything.
2. A job reads from Kafka and writes the events into tables in object storage. Iceberg gives those tables a schema, so a column can be added later without rewriting history, and readers never see a half-finished write.
3. Further jobs clean and join the raw tables into ones shaped for reporting.
4. An analyst runs SQL. Trino plans the query, reads only the needed columns of the needed files across many machines, and returns the result.
5. Airflow owns steps 2 and 3: what runs, in what order, how often, what happens when a step fails, and how to re-run a past day.

The production database appears only at the far left, as a source. That is the point of the whole structure.

## Keep the map honest

The four boxes are a way to reason, not a law.

- **The boundaries overlap.** Kafka can do stream processing; query engines can write tables; some orchestrators run the transformation themselves. Vendors merge boxes deliberately.
- **Not every platform has all four.** A single analytical database can be a complete platform for a small company. Scheduled exports are legitimate ingestion. Adopting four systems to answer one report is a bad trade.
- **These tools are widely used, not mandatory.** Each row has credible alternatives, and the roles matter more than the names.

Judge a design by whether each job has an owner and whether the owner is suited to it. That is the question this course is training you to answer.

## Check your understanding

1. Why is a column-oriented layout a poor fit for the workload your application database serves?
2. Which of the four jobs is missing if data lands in object storage correctly but nobody can tell whether yesterday's load finished?
3. A colleague says "we will use Kafka as our analytics store, since it keeps all our events anyway." What is wrong with that?
4. Trino has no storage. What must exist for it to be useful?
5. A weekly report is built by one scheduled export and one query against a single analytical database. Which boxes does that platform skip, and is that a problem?

Expected answers: 1. A transaction reads and writes whole rows, so splitting a row across per-column storage makes the common operation expensive. 2. Orchestration — the scheduling, retry, and visibility layer. 3. Kafka is an event log built for durable transport and replay, not a query engine; analytical questions belong to a storage-plus-query layer. 4. Data in a storage layer it can read, and table metadata describing it. 5. It skips event transport and a separate table format; that is fine as long as the volume, freshness, and number of sources stay small.

## Official resources

- [Apache Kafka introduction](https://kafka.apache.org/intro)
- [Apache Iceberg](https://iceberg.apache.org/)
- [Trino use cases](https://trino.io/docs/current/overview/use-cases.html)
- [Apache Airflow documentation](https://airflow.apache.org/docs/apache-airflow/stable/index.html)
- [Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics](https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf)

The next lesson starts at the left of the map, with Kafka and the problem of moving events between systems.
