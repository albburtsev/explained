---
slug: data-platform/iceberg
title: "Apache Iceberg: Tables on Object Storage"
description: What Apache Iceberg is as an open table format, why directory-based tables broke, where the format stops helping, and which workloads it fits.
tags:
  - data-engineering
  - data-platform
  - iceberg
  - table-format
  - object-storage
---

The previous lesson ended with source data arriving in the platform. Ingestion jobs write it into object storage as files — usually Parquet, the columnar format analytical scans like. That is where the next problem starts: a folder full of Parquet files is not a table. It has no agreed schema, no way to add a column without touching history, no definition of "the current contents", and no rule that stops two writers from corrupting each other's work.

`Apache Iceberg` is an open table format for huge analytic datasets: a specification for the metadata that turns a set of files in object storage into a table with a schema, versions, and safe concurrent writes. The Iceberg documentation puts it as adding tables to compute engines — Spark, Trino, PrestoDB, Flink, Hive, Impala — with a format that "works just like a SQL table".

Read that as a standard, not a product. Nothing runs Iceberg the way something runs PostgreSQL. Engines embed an Iceberg library, and the tables are files that any other Iceberg-aware engine can open.

## What Iceberg is

The design decision everything follows from is one sentence in the spec: this table format tracks individual data files in a table instead of directories. Membership in a table is an explicit list, not "whatever happens to be in this folder".

That list is a tree of metadata files, with a pointer at the top:

```text
catalog
  `- table name -> current metadata file
                     |  schema, partition spec, properties, snapshot history
                     `- snapshot -> manifest list
                                      |- manifest -> data files + statistics
                                      `- manifest -> data files + statistics
```

Each level has a job:

- A `metadata file` is a JSON document holding the table's schema, partition configuration, properties, and its snapshots. Every change to the table writes a *new* metadata file; metadata files are never edited.
- A `snapshot` is the state of the table at one moment — the complete set of data files it contained then.
- A `manifest list` belongs to one snapshot and names the manifests that make it up, with per-manifest partition ranges and file counts, so an engine can skip manifests that cannot match a query.
- A `manifest` lists data files with their partition values and column-level statistics such as value ranges and null counts. Manifests are reused across snapshots, so a small commit does not rewrite the whole inventory.
- A `catalog` holds the last piece: the pointer from a table name such as `sales.orders` to that table's current metadata file.

Statistics at the manifest-list and manifest levels are why this is fast. An engine narrows a scan by reading metadata, not by listing storage. The spec states the goal directly: plan a scan with O(1) remote calls rather than O(n) calls growing with the number of partitions or files.

## How a commit works

A writer does its work off to the side, then makes it visible in one step:

1. Write the new data files. Files are immutable and written in place — never moved, never modified.
2. Write new manifests, a new manifest list, and a new metadata file describing the resulting snapshot.
3. Ask the catalog to swap the table's pointer from the base metadata file to the new one.

Until step 3 succeeds, no reader sees anything. That atomic swap is the whole basis of Iceberg's isolation guarantee: readers use the snapshot that was current when they loaded the table and are unaffected by later commits until they refresh.

Concurrency is handled by `optimistic concurrency`. A writer assumes nothing changed while it worked; if the pointer has moved by the time it commits, the swap fails and the writer retries against the new current version. Some operations can re-apply their changes without redoing the work.

Two familiar features fall out of keeping old snapshots around. `Time travel` lets a query read a named earlier snapshot, so a report is reproducible. `Rollback` resets the table pointer to a known-good snapshot after a bad load — a metadata change, not a restore from backup.

## Why it exists

Iceberg was built against a specific predecessor. In the Hive-style layout, a table *was* a directory, a partition was a subdirectory such as `event_date=2026-09-01`, and the files inside were the data. That convention has four failures that any team running it at scale eventually meets.

**No atomic commit.** A job writing files into a directory is partly visible while it runs, and replacing a partition means deleting files and writing new ones with a gap in between. Readers see half-finished states. Iceberg makes a commit one pointer swap.

**Planning by listing.** Finding the files to read means listing directories, and cost grows with the number of partitions and files. Object stores list slowly, and Iceberg was explicitly designed to solve correctness problems in eventually-consistent object stores by avoiding listings and renames. Iceberg reads a metadata tree instead.

**User-maintained partitioning.** Hive must be handed partition values, because it does not know that `event_date` is derived from `event_time`. The Iceberg documentation lists the consequences bluntly: a writer using the wrong format or the wrong source column produces silently incorrect results rather than an error, a reader who omits the partition filter scans the whole table, and working queries are tied to the physical layout, so the layout cannot change without breaking them.

Iceberg's answer is `hidden partitioning`. The table is configured with a transform — `day(event_time)`, or a bucket of an ID — and Iceberg derives partition values itself and records the relationship. Consumers never see a partition column:

```sql
-- Hive-style: the writer supplies event_date, and the reader must filter on it
SELECT level, count(*) FROM logs
WHERE event_time BETWEEN TIMESTAMP '2026-09-01 10:00:00' AND TIMESTAMP '2026-09-01 12:00:00'
  AND event_date = '2026-09-01';

-- Iceberg table partitioned by day(event_time): the filter on the real column is enough
SELECT level, count(*) FROM logs
WHERE event_time BETWEEN TIMESTAMP '2026-09-01 10:00:00' AND TIMESTAMP '2026-09-01 12:00:00';
```

**Unsafe evolution.** Because queries no longer name partition values, the layout can change. `Partition evolution` is a metadata operation: old data keeps the old spec, new data is written with the new one, both live in the same table, and a query plans each layout separately. Moving from monthly to daily partitions no longer requires a new table.

Schema changes are metadata-only too. Iceberg tracks every column by a unique field ID, so add, drop, rename, reorder, and type-widening leave data files untouched and cannot resurrect a dropped column when a name is reused later — a real hazard in formats that match columns by name or position.

## Know the format versions

The spec is versioned separately from the Java library, and the number matters when you mix engines.

- **V1** manages analytic tables over immutable Parquet, Avro, and ORC files.
- **V2** adds row-level updates and deletes through delete files, so a single row can be deleted or replaced without rewriting its data file.
- **V3** extends types and metadata: nanosecond timestamps, `variant`, geometry and geography, column default values, multi-argument transforms, row lineage, binary deletion vectors, and table encryption keys.

Versions 1, 2, and 3 are complete and adopted; version 4 is under active development and not yet formally adopted. The current release of the Apache implementation is 1.11.0, from May 2026. Engine support for newer spec features is not uniform, so check the engines you actually use before turning one on.

## Where its limits are

- **It is not a query engine.** Iceberg plans nothing and computes nothing by itself. Something else — the next lesson's subject, or Spark, or Flink — has to read it.
- **It is not a database, and not for OLTP.** There is no millisecond point lookup: fetching one row means consulting metadata and scanning a data file. There are typically no enforced primary keys, uniqueness, or foreign keys, and no row-at-a-time transactions. Your application's database does not move here.
- **Writes are commits, not updates.** Freshness is measured in commits; a row is visible when its snapshot is. Frequent tiny writes mean frequent snapshots, and updating a few rows means writing delete files or rewriting data files, not editing them in place.
- **Small files accumulate, and maintenance is yours.** Streaming ingestion produces many small files, which inflate metadata and slow queries through per-file open costs. Snapshots and old metadata files also pile up and keep obsolete data files alive. Compaction, snapshot expiry, metadata cleanup, and orphan-file removal are scheduled jobs someone has to own — which is one reason the last lesson of this course exists.
- **It depends on a catalog.** Atomicity rests entirely on something that can swap a pointer safely: a REST catalog service, a Hive metastore, AWS Glue, a JDBC database, or similar. That catalog is a shared dependency and the naming authority; two engines pointed at different catalogs are not looking at the same tables.
- **It does not replace the file format.** Parquet, ORC, and Avro still store the rows. Iceberg describes which of those files belong to the table and what they mean.

## Typical use cases

Iceberg is a good fit when these appear together:

- **Large append-heavy tables fed by continuous ingestion**, where readers need a consistent view while ingestion keeps committing.
- **One table, several engines.** Batch processing, ad hoc SQL, and machine learning frameworks read the same tables without an export step for each.
- **History that must be queryable.** Reproducible reports, audits, and a rollback path after a bad load.
- **Targeted deletes and updates in an otherwise immutable lake**, such as removing one customer's rows on request.
- **Tables that will outlive their design.** Schemas and partition layouts that will change over years without a migration project each time.
- **Escaping a Hive-layout warehouse** whose listing costs and partition discipline have become the daily problem.

It is the wrong choice when the data is small enough that a single managed database answers every question, when the requirement is transactional or sub-second serving, or when nobody will own the maintenance jobs that keep the tables healthy.

## Check your understanding

1. Why can a reader never see a half-finished Iceberg write?
2. A Hive-layout query filters on `event_time` but not on the `event_date` partition column. What happens, and what does Iceberg do differently?
3. Your job adds a column to a table with ten years of history. How much data is rewritten?
4. Two Spark jobs commit to the same table at the same time. What decides the outcome?
5. A streaming job commits to an Iceberg table every ten seconds, and queries get slower each week although the data volume is modest. What is the likely cause?

Expected answers: 1. Data files are written first and become part of the table only when the catalog atomically swaps the table pointer to the new metadata file. 2. Hive scans every file, because it does not know the two columns are related; Iceberg derives the partition value with a transform and applies the filter automatically. 3. None — a schema change is a metadata operation, and field IDs keep existing files readable. 4. Optimistic concurrency: the first swap wins, and the second writer retries against the new current metadata. 5. Many small files and accumulating snapshots and metadata, which need compaction and expiry.

## Official resources

- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)
- [Iceberg table spec: format versions, overview, optimistic concurrency](https://iceberg.apache.org/spec/)
- [Partitioning and hidden partitioning](https://iceberg.apache.org/docs/latest/partitioning/)
- [Schema and partition evolution](https://iceberg.apache.org/docs/latest/evolution/)
- [Table maintenance: compaction, expiring snapshots, metadata cleanup](https://iceberg.apache.org/docs/latest/maintenance/)
- [Iceberg REST catalog specification](https://iceberg.apache.org/rest-catalog-spec/)
- [Releases](https://iceberg.apache.org/releases/)

Iceberg gives you tables on cheap storage that many engines can share. The next lesson names the architecture built on that idea — the lakehouse — and weighs it against the data warehouse and the plain data lake.
