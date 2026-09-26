---
slug: data-platform/spark
title: Apache Spark
description: What Apache Spark is as a distributed processing engine, why platforms use it to build tables, where it is the wrong tool, and how it compares with Trino.
tags:
  - data-engineering
  - data-platform
  - spark
  - batch-processing
  - trino
---

The previous lesson showed Trino answering SQL questions over lakehouse tables. Someone still has to build those tables. Raw files must be cleaned, joined, and rewritten into tables shaped for reporting, often over years of history. That work can run for hours, and it must survive a failed machine. This is the job most platforms give to Apache Spark.

`Apache Spark` is, in its own words, "a unified analytics engine for large-scale data processing". It runs your code across a cluster of machines, reads data from storage, transforms it, and writes the result back. Like Trino, it stores nothing of its own. Unlike Trino, it is not only a SQL engine: it is a general engine for programs that process data.

## What Spark is

A Spark program is called an application. Each application has one `driver`: the process that runs your main program, plans the work, and coordinates it. The actual computation runs in `executors`, processes on the cluster machines that run tasks and hold data for that application. A `cluster manager` gives the application its machines. Spark supports its own Standalone manager, Hadoop YARN, and Kubernetes.

You describe the work with the `DataFrame` API: a table-like dataset with named columns, available in Python, Scala, Java, and R. Spark SQL runs on the same engine, so SQL and DataFrame code can be mixed in one job. Here is a small PySpark job. It assumes the session already has an Iceberg catalog named `lakehouse`:

```python
from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("daily-revenue").getOrCreate()

orders = spark.table("lakehouse.sales.orders")
daily = (
    orders
    .where(F.col("status") == "paid")
    .groupBy(F.to_date("created_at").alias("day"))
    .agg(F.sum("total").alias("revenue"))
)

daily.writeTo("lakehouse.marts.daily_revenue").createOrReplace()
```

The first lines do not read any data. Spark separates `transformations`, such as `where` and `groupBy`, from `actions`, such as writing or collecting a result. Transformations are lazy: Spark only records them. The last line is an action, so only then does Spark plan the whole chain and run it. Seeing the whole chain first lets the optimizer read only the needed columns and push the filter down to the files.

An action starts a `job`. Spark splits the job into `stages` at every `shuffle`: the step where rows move between machines, for example so that all rows for one `day` meet in one place for the `groupBy`. Each stage is a set of tasks, one per slice of data, and the executors run them in parallel.

Two design choices make Spark suitable for long work:

- **Shuffles go through disk.** A shuffle writes intermediate files to disk before the next stage reads them. This costs time, but a stage does not have to start again when a later stage fails.
- **Lost work is recomputed.** Spark remembers the transformations that produced each piece of data, called its lineage. When an executor dies, Spark recomputes only the lost pieces and retries the failed tasks. The job continues.

Spark also has higher-level libraries on the same engine: Structured Streaming for stream processing, MLlib for machine learning, and a pandas API. The current release line is Spark 4. Spark 4.2.0 was released in July 2026.

## Why it exists

Spark started at UC Berkeley's AMPLab as a faster successor to Hadoop MapReduce. MapReduce wrote results to disk after every step and could express only a map followed by a reduce. Multi-step pipelines and iterative algorithms, such as machine learning, were slow and awkward to write. Spark keeps data in memory between steps where it can, and it lets one program express a whole graph of steps.

In a data platform, Spark usually has three roles:

- **Transformation at scale.** Reading raw data and writing cleaned, joined, and aggregated Iceberg tables. The job can take hours and survives failures on the way.
- **Logic beyond SQL.** Parsing messy formats, calling Python libraries, or building machine learning features. DataFrame code can do things that are hard or impossible in SQL.
- **Table maintenance.** Iceberg ships Spark procedures for the maintenance jobs from the Iceberg lesson, such as compaction and snapshot expiry:

```sql
CALL lakehouse.system.rewrite_data_files(table => 'sales.orders');
```

## Where its limits are

**It is slow to start.** An application must get executors from the cluster manager before it does anything. Each stage adds scheduling overhead. Seconds or minutes of startup do not matter for a two-hour job, but they make Spark a poor engine behind an interactive dashboard.

**It is not a database.** Spark owns no storage and keeps no tables between applications, except through a catalog and the files it wrote. There is no OLTP here: no millisecond point lookups, no serving path for an application.

**Shuffles decide performance, and tuning is real work.** Moving data between machines is the expensive part of most jobs. The number of shuffle partitions defaults to `200`, whatever the data size. Skewed keys send most rows to one task, and a job then waits for that task. Adaptive Query Execution, on by default since Spark 3.2, fixes some of this at runtime, but not all. Memory settings, partition sizes, and join strategies remain your job.

**The driver is a bottleneck by design.** Actions like `collect()` pull the whole result into the driver's memory. On a large dataset, that crashes the driver. Results should go to storage, not to the driver.

**Python has a cost.** Built-in DataFrame functions run inside the engine. A custom Python function forces Spark to send rows to a Python process and back, which is much slower. Prefer built-in functions, and use Python functions only for logic that has no built-in equivalent.

**Streaming is micro-batch by default.** Structured Streaming processes a stream as a series of small batch jobs, with end-to-end latency as low as about 100 milliseconds. That is enough for writing streams into tables, but it is not per-event processing.

**It is oversized for small data.** If the data fits on one machine, a single database or a local tool will be faster to write and cheaper to run. Spark earns its complexity only when the data or the processing really needs a cluster.

## Typical use cases

- **Building lakehouse tables.** Nightly and hourly jobs that turn raw files into modeled Iceberg tables.
- **Backfills and reprocessing.** Rewriting years of history after a logic change, where the job is long and must not fail on one lost machine.
- **Table maintenance.** Compaction, snapshot expiry, and orphan-file cleanup through Iceberg's Spark procedures.
- **Machine learning pipelines.** Building features over large datasets and training or scoring models with MLlib or Python libraries.
- **Stream ingestion.** Structured Streaming jobs that write incoming data into tables every few seconds or minutes.

## Spark vs Trino

Both are distributed engines. Both read the same Iceberg tables and store nothing of their own. Both accept SQL. They were built for different work, and the differences follow from that.

| | Trino | Spark |
| --- | --- | --- |
| Built for | Interactive SQL questions | Long data processing jobs |
| Interface | SQL | DataFrames in Python, Scala, Java, R, plus SQL |
| Cluster | Long-running and shared; queries come and go | Executors belong to one application for its lifetime |
| Intermediate data | Streamed between workers in memory | Shuffled through files on disk |
| Worker failure | Query fails by default; retries are opt-in | Failed tasks rerun; lost data is recomputed |
| Typical run time | Seconds to minutes | Minutes to hours |
| Beyond SQL | Mostly nothing | Streaming, machine learning, custom code |
| Data sources | Federation across many systems in one query | Mostly files and lakehouse tables |

The practical rule is simple. Use Trino when a person or a dashboard is waiting for an answer. Use Spark when a job produces data that other queries will read later. The Trino lesson said that a six-hour job that must survive node failures belongs on a batch engine. Spark is that engine.

Many platforms run both on the same tables. Spark writes and maintains them. Trino answers questions over them. The overlap is real: Trino can run `INSERT` and `MERGE`, and Spark SQL can run ad hoc queries. Choose by the shape of the workload, not by which engine can technically run the statement.

## Check your understanding

1. A PySpark script defines ten transformations and then prints nothing. How much data does Spark read?
2. An executor dies in the middle of a three-hour Spark job. What happens?
3. A job with a `groupBy` on `customer_id` spends most of its time in one task. What is the likely cause?
4. An analyst wants a dashboard to refresh in two seconds over a lakehouse table. Spark or Trino?
5. A nightly job joins five large tables, runs custom Python parsing, and writes a new Iceberg table. Spark or Trino?

Answers: (1) None. Transformations are lazy, and without an action Spark runs no job. (2) Spark reruns the failed tasks on other executors and recomputes lost data from its lineage. The job continues. (3) Key skew: a few customers have most of the rows, so one task gets most of the shuffle. (4) Trino. Spark's startup and scheduling overhead does not fit an interactive dashboard. (5) Spark. The job is long, needs custom code, and must survive failures.

## Official resources

- [Apache Spark documentation](https://spark.apache.org/docs/latest/)
- [Cluster mode overview: driver, executors, cluster managers](https://spark.apache.org/docs/latest/cluster-overview.html)
- [Spark SQL, DataFrames and Datasets guide](https://spark.apache.org/docs/latest/sql-programming-guide.html)
- [Performance tuning and Adaptive Query Execution](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
- [Structured Streaming programming guide](https://spark.apache.org/docs/latest/streaming/index.html)
- [Iceberg Spark procedures](https://iceberg.apache.org/docs/latest/spark-procedures/)

Spark and Trino both do work when someone asks. The next lesson covers the system that decides when each job runs, in what order, and what happens when one fails: Apache Airflow.
