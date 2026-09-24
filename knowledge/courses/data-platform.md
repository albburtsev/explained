---
slug: data-platform
title: Data Platform
catalogOrder: 100
description: Learn what Kafka, Iceberg, Trino, and Airflow each do, where their limits are, and which job belongs to which tool.
tags:
  - data-engineering
  - data-platform
  - streaming
  - analytics
lessons:
  - data-platform/platform-architecture
  - data-platform/kafka
  - data-platform/iceberg
  - data-platform/lakehouse
  - data-platform/trino
  - data-platform/airflow
---

An application developer meets data engineering as a list of unfamiliar names: Kafka, Iceberg, Trino, Airflow. They are not competing products and not layers of one framework. Each one owns a different job in the path data takes from the systems that produce it to the queries that answer questions about it: moving events, storing tables, running queries, and scheduling the work that keeps it all current.

This course is a tour, not a tutorial. Each lesson answers the same four questions about one tool or standard: what it is, why it exists, where it stops being the right choice, and which use cases it appears in most often. The goal is judgment — enough understanding to read a data platform's architecture diagram, follow a conversation with a data engineer, and know which tool a given problem belongs to.

## What you will learn

- How ingestion, storage, query, and orchestration divide the work in a data platform.
- What Apache Kafka is, and when a durable event log beats a queue or a direct API call.
- How Apache Iceberg turns files in object storage into tables with schemas, snapshots, and safe concurrent writes.
- What the lakehouse architecture claims to solve, and how it compares with a data warehouse and a plain data lake.
- How Trino answers SQL queries across sources it does not own, and which workloads it is wrong for.
- How Apache Airflow schedules and retries dependent pipeline tasks, and where its batch-oriented model ends.
