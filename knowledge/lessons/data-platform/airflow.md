---
slug: data-platform/airflow
title: "Apache Airflow: Orchestrating Data Pipelines"
description: Learn how Airflow runs dependent batch tasks on a schedule, what it adds over cron, and where its orchestration model ends.
tags:
  - airflow
  - orchestration
  - data-engineering
---

A data platform is never one job. Raw files land in object storage, a Spark job writes them into an Iceberg table, a second job builds an aggregate on top of that table, and a report reads the result through Trino. Each step depends on the one before it, each can fail, and each must run again tomorrow.

Cron can start all four at fixed times. It cannot express that the aggregate must wait for the ingestion job to succeed, retry only the step that failed, or rerun last Tuesday after someone finds a bug. Apache Airflow exists for exactly that gap.

## Write the pipeline as Python code

Airflow describes itself as "a platform for orchestrating batch workflows". You define a workflow in a Python file, and Airflow schedules, runs, and displays it.

A `DAG` is one workflow: a set of steps plus the rules for when it runs. The name comes from *directed acyclic graph* — steps point forward to the steps that depend on them, and no path leads back to an earlier step. A `task` is one step in that graph, and an `operator` is a reusable template for a kind of task, such as running a SQL statement or launching a container.

Modern Airflow lets you write tasks as decorated Python functions. This style is called the TaskFlow API:

```python
from airflow.sdk import dag, task


@dag(schedule="@daily", catchup=False)
def daily_orders():
    @task
    def extract() -> str:
        return "s3://raw/orders/2026-09-24"

    @task
    def load(path: str) -> None:
        print(f"loading {path}")

    load(extract())


daily_orders()
```

Calling `load(extract())` does not run anything. It declares that `load` depends on `extract`, and Airflow builds the graph from that call. The older explicit form, `extract_task >> load_task`, expresses the same dependency and is still common in existing pipelines.

Four components turn that file into running work:

- The **DAG processor** parses your files and stores the resulting workflows.
- The **scheduler** decides which task instances are ready to run, based on the schedule and on which upstream tasks have already succeeded.
- The **executor** — a configuration property of the scheduler — hands those tasks to a local process, a pool of workers, or Kubernetes pods.
- The **metadata database**, usually PostgreSQL, stores the state of tasks, DAGs, and variables. It is the record of what ran, when, and with what result.

An API server serves the REST API and the web UI, where you inspect runs, read logs, and trigger a DAG by hand.

## Understand what cron cannot do

Airflow's value is in what it tracks between runs and between tasks.

Because the scheduler knows the graph, it starts a task only after its dependencies succeed. Because state lives in a database, a failure is a known condition rather than a silent one: a task carries a retry policy, and Airflow reruns just that task before failing the run. Because runs are addressable, you can trigger a *backfill* — copies of the DAG for a range of past dates — when logic changes or a source was late.

A `sensor` is a special operator that waits for something to happen, such as a file appearing or a partition being written. It ends the habit of guessing a safe start time for a downstream job. In `reschedule` mode a sensor frees its worker slot between checks, so a long wait does not hold resources.

All of this rests on one discipline that Airflow cannot enforce for you: tasks should be `idempotent`, meaning a second run with the same parameters produces the same result rather than a duplicate. The official best practices are blunt about the common failure — replace `INSERT` with an upsert, and read a fixed partition rather than "the latest data", so a retry cannot corrupt the output.

Airflow 3, released in April 2025, added versioning so a run completes on the DAG version it started with, moved backfills into the scheduler, introduced a task execution API that decouples task code from the database, and can start work from external events rather than the clock alone.

## Know where Airflow stops

Airflow is a batch orchestrator, and its documentation is explicit about the boundary: it "is designed for finite, batch-oriented workflows", and "is not intended for continuously running, event-driven, or streaming workloads". A streaming system handles the continuous flow; Airflow picks the data up afterward in batches.

It is also not a data processing engine. Airflow triggers work in other systems — a Trino query, a Spark job, a container — and records the outcome. Data should not travel through the scheduler. The `XCom` mechanism that passes values between tasks is "only designed for small amounts of data; do not use them to pass around large values, like dataframes."

Two more limits shape what you put in a DAG. Starting a task has real overhead, from scheduling latency to process or pod startup, so hundreds of one-second tasks waste more time than they do work; batch them instead. And Airflow is not a general-purpose job queue: it is poorly suited to per-request, low-latency, or high-frequency work that a queue and a worker handle better.

The neighboring category is application workflow orchestration, covered by this site's Temporal course: Temporal keeps the state of one long-running business process durable, while Airflow schedules dependent batch runs over datasets.

## Recognize the typical uses

Airflow fits work that has a clear start and end and repeats:

- Scheduled ELT — landing raw data, then building tables and aggregates in dependency order.
- Table maintenance, such as compaction or snapshot expiry on lakehouse tables.
- Backfills and reprocessing after a bug fix or a late source.
- Machine learning pipelines: feature builds, training runs, and batch scoring.
- Cross-system sequences where one late or failed step must stop everything downstream.

## Official resources

- [What is Airflow?](https://airflow.apache.org/docs/apache-airflow/stable/index.html)
- [Architecture overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)
- [DAGs](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html)
- [TaskFlow tutorial](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/taskflow.html)
- [Best practices](https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html)

That completes the tour. Iceberg gives files in object storage the behavior of tables, the lakehouse architecture puts warehouse guarantees on that storage, Trino answers SQL across it, Spark builds and maintains the tables with long processing jobs, and Airflow decides what runs, in what order, and what happens when a step fails. When you meet a data platform diagram, the useful question is no longer what each box is called, but which of those jobs it is doing.
