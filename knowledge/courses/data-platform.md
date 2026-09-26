---
slug: data-platform
title: Data Platform
catalogOrder: 100
description: Learn what Iceberg, Trino, Spark, and Airflow each do, where their limits are, and which job belongs to which tool.
tags:
  - data-engineering
  - data-platform
  - spark
  - analytics
lessons:
  - data-platform/platform-architecture
  - data-platform/iceberg
  - data-platform/lakehouse
  - data-platform/trino
  - data-platform/spark
  - data-platform/airflow
---

An application developer meets data engineering as a list of unfamiliar names: Iceberg, Trino, Spark, Airflow. They are not layers of one framework. Each one owns a different job in the path data takes from the systems that produce it to the queries that answer questions about it: storing tables, answering queries, processing data at scale, and scheduling the work that keeps it all current. Two of them, Trino and Spark, overlap enough to be confused, so the course compares them directly.

This course is a tour, not a tutorial. Each lesson answers the same four questions about one tool or standard: what it is, why it exists, where it stops being the right choice, and which use cases it appears in most often. The goal is judgment — enough understanding to read a data platform's architecture diagram, follow a conversation with a data engineer, and know which tool a given problem belongs to.

## What you will learn

- How ingestion, storage, compute, and orchestration divide the work in a data platform.
- How Apache Iceberg turns files in object storage into tables with schemas, snapshots, and safe concurrent writes.
- What the lakehouse architecture claims to solve, and how it compares with a data warehouse and a plain data lake.
- How Trino answers SQL queries across sources it does not own, and which workloads it is wrong for.
- What Apache Spark is, how it builds and maintains tables at scale, and when to choose it over Trino.
- How Apache Airflow schedules and retries dependent pipeline tasks, and where its batch-oriented model ends.
