---
slug: data-platform/lakehouse
title: "The Lakehouse: Warehouse Tables on Lake Storage"
description: Understand the lakehouse architecture, the two-system problem it solves, its limits, and how it compares with a warehouse and a lake.
tags:
  - data-engineering
  - data-platform
  - lakehouse
  - architecture
  - analytics
---

The previous lesson introduced Apache Iceberg as a table format. A `lakehouse` is the architecture that table format makes possible: analytical tables that live as ordinary files in object storage, but behave like warehouse tables, and that any number of engines can read through a shared catalog. The term comes from a 2021 CIDR paper by Armbrust, Ghodsi, Xin, and Zaharia, which argued that open direct-access formats could replace the closed storage of a data warehouse.

This is an architectural pattern, not a product. You cannot buy "a lakehouse" the way you buy a database, and several vendors will happily sell you one anyway. What matters is the shape of the system.

## The two-system problem

Before the lakehouse, an organization that wanted both cheap storage and fast SQL usually ran two systems.

A `data warehouse` is a closed analytical database: you load data into it, and it owns the storage layout. That ownership is what makes it fast and reliable — schemas, transactions, statistics, indexes, and permissions are all enforced in one place. It also creates three costs. Storage is priced as part of the product rather than as raw bytes. Data in a proprietary format is only readable through that vendor's engine, which is lock-in. And anything the engine cannot do well — training a model, processing video, text, or audio — has to leave the warehouse first.

A `data lake` is the opposite trade: files in object storage such as Amazon S3, usually in an open columnar format like Apache Parquet. Storage is cheap, any tool can read the bytes, and data of any shape can land there. What the lake historically lacked is everything the warehouse enforced: no transactions, so a reader could see a half-finished write; no agreed schema, so meaning drifted; no reliable table-level governance.

So teams ran both, and copied between them: raw data into the lake, then a curated subset loaded into the warehouse for business intelligence. The CIDR paper names what that two-tier architecture costs — reliability problems from continuous ETL between the systems, staleness because the warehouse copy lags the lake, weak support for machine learning, and a total cost of ownership that includes paying for the same data twice.

The lakehouse proposal is to stop copying: keep one copy of the data in open formats in the lake, and add the management layer that was missing.

## What a lakehouse actually is

A lakehouse is a stack of independent layers, each replaceable:

1. **Object storage** holds the bytes. It is durable, cheap, and exposes a file API — nothing more.
2. **An open file format**, usually Parquet, stores the rows in a compressed columnar layout that analytical scans can read efficiently.
3. **An open table format**, such as Iceberg, turns a set of those files into a table with a schema, atomic commits, and time travel. This is the layer the previous lesson covered.
4. **A catalog** maps a table name such as `sales.orders` to that table's current metadata. It is the shared entry point: every engine asks the catalog what the table is right now.
5. **Engines** read and write those tables. Batch processing, ad hoc SQL, streaming, and machine learning frameworks are all just clients.

The defining property is `decoupled storage and compute`: no engine owns the data. Compute is bought, scaled, and replaced independently of the bytes, and two engines can read the same table at the same time without either exporting anything. That is the difference from a warehouse that also separates compute from storage internally — there, the storage is still private to the vendor.

Iceberg is not the only option at layer 3. Delta Lake and Apache Hudi solve the same problem with different designs, and the architecture in this lesson applies to all three. The table format is a choice inside the pattern, not the pattern itself.

## Warehouse, lake, and lakehouse compared

| | Data warehouse | Data lake | Lakehouse |
| --- | --- | --- | --- |
| Where data lives | Storage the engine owns | Files in object storage | Files in object storage |
| Format | Proprietary | Open, but no table layer | Open file format plus open table format |
| Transactions and schema | Enforced by the engine | Absent or by convention | Enforced by the table format |
| Who can read it | That vendor's engine | Any tool that can parse files | Any engine that supports the table format |
| Strength | Fast, mature SQL and governance | Cost, scale, any data shape | One governed copy, many engines |
| Typical failure mode | Cost and lock-in | Unreliable, undocumented data | Operational complexity you now own |

## Where the limits are

A lakehouse is not a drop-in warehouse replacement. The honest limits:

- **Latency.** Reads go to object storage and writes land as commits, so freshness is measured in commits, not in rows. Minutes-fresh analytics is normal; millisecond dashboards and sub-second point lookups are not what this architecture is for.
- **Concurrency.** Table formats generally use optimistic concurrency: two writers touching the same table can conflict, and one retries. Warehouses are tuned for many short concurrent queries against hot, cached data, and often still win there.
- **Governance maturity.** Permissions are spread across the catalog, the storage system, and each engine. Fine-grained row and column security, lineage, and audit are less uniform than inside a single closed product, though catalogs are closing the gap.
- **Maintenance is now your job.** Streaming or frequent writes produce many small files, and old snapshots and orphan files accumulate. Compaction, snapshot expiry, and cleanup are real scheduled work. A warehouse did this invisibly; here it is a pipeline someone has to own.
- **No OLTP.** There is no row-at-a-time transactional workload here, no millisecond single-row lookup, and typically no enforced uniqueness or foreign keys. Your application database does not move into the lakehouse.

The pattern also assumes engines agree. Support for a given table format version or feature varies by engine, so "any engine can read it" holds in practice only for the engines you have actually checked.

## Typical use cases

A lakehouse fits when several of these are true:

- Large and growing analytical data, where object-storage pricing matters.
- More than one consumer of the same tables — BI queries, batch jobs, and model training — and you do not want an export step for each.
- Mixed structured and semi-structured data that a warehouse would not store comfortably.
- Long retention with history and time travel, for audits or reproducible reports.
- A deliberate wish to keep data readable by engines you have not chosen yet.

It fits badly when data volume is modest and a single managed warehouse would answer every question with far less operational work, or when the requirement is transactional or sub-second serving. "Everyone else has one" is not a reason; the lakehouse trades vendor complexity for complexity you run yourself.

In the platform map from the first lesson, this is the storage layer: Kafka delivers events into it, engines query the tables it holds, and a scheduler keeps ingestion and table maintenance running. The next lesson looks at one such engine, Trino, and at what it means to query data you do not own.

To check the model, take one table you work with today and ask where each layer would sit: which file format holds the rows, which table format defines the table, which catalog names it, and which engines read it. If any answer is "the database decides," you are describing a warehouse, not a lakehouse.

## Official resources

- [Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics (CIDR 2021)](https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf)
- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)
- [Apache Iceberg terminology](https://iceberg.apache.org/terms/)
- [Apache Parquet](https://parquet.apache.org/)
- [Delta Lake](https://delta.io/)
- [Apache Hudi](https://hudi.apache.org/)
