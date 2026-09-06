---
slug: postgresql/explain-and-query-planning
title: EXPLAIN and Query Planning
description: Read PostgreSQL query plans, compare estimates with measurements, and identify expensive work.
tags:
  - postgresql
  - databases
  - query-performance
---

The **planner** chooses how PostgreSQL executes a query. It estimates the cost of possible approaches, using statistics about the data. Its chosen **query plan** is a tree of operations such as scanning, filtering, joining, grouping, and sorting rows.

`EXPLAIN` displays the plan. `EXPLAIN ANALYZE` also executes the statement and reports measurements.

## Create a predictable example

A **temporary table** is visible only to the current session and is removed when that session ends. Here, `generate_series` creates 100,000 rows. `ANALYZE` collects statistics for the planner:

```sql
CREATE TEMP TABLE plan_orders AS
SELECT
  n AS id,
  (n % 1000) + 1 AS customer_id,
  CASE WHEN n <= 100 THEN 'pending' ELSE 'paid' END AS status,
  CURRENT_DATE - (n % 30) AS placed_on
FROM generate_series(1, 100000) AS n;

ANALYZE plan_orders;
```

Inspect a query that groups pending orders by customer and returns five groups with the highest counts:

```sql
EXPLAIN
SELECT customer_id, count(*) AS order_count
FROM plan_orders
WHERE status = 'pending'
GROUP BY customer_id
ORDER BY order_count DESC
LIMIT 5;
```

Plain `EXPLAIN` plans this statement without executing it. Start here when execution could be slow or change data.

## Read the plan tree

Each operation is a **plan node**, with details below it. Indentation shows its place in the tree: a parent uses rows produced by its children. Read from the deepest nodes upward to follow the data.

For this query, identify these kinds of work in your own output:

- A scan obtains rows from `plan_orders` and applies the `status` filter.
- An aggregate groups the surviving rows by `customer_id` and computes `count(*)`.
- A sort orders the groups by their count.
- A limit stops after five output rows.

Node names and numbers vary with the PostgreSQL release, statistics, configuration, and data. Identify each node's work before studying its numbers.

A typical estimate section has this form:

```text
(cost=<startup>..<total> rows=<estimated-output-rows> width=<average-row-bytes>)
```

- `startup` is the estimated work before the node can emit its first row. Sorting usually has startup work because it must collect input first.
- `total` is the estimated work if the node runs to completion. A parent's cost includes work done by its children, so do not add every node's cost together.
- `rows` estimates how many rows the node emits, not necessarily how many it examines.
- `width` estimates the average size of each emitted row in bytes.

Planner costs are relative units, not milliseconds. Use them to understand why PostgreSQL preferred one candidate plan over another; do not compare a cost number directly with wall-clock time.

## Compare estimates with reality

Now execute the same read-only query and collect measurements:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT customer_id, count(*) AS order_count
FROM plan_orders
WHERE status = 'pending'
GROUP BY customer_id
ORDER BY order_count DESC
LIMIT 5;
```

Here, the `ANALYZE` option runs the query; the standalone `ANALYZE table_name` command collects statistics. The plan now includes `actual time` in milliseconds, output `rows`, and `loops`, the number of executions. For repeated nodes, time and rows are per-loop averages. Multiply by `loops` to estimate that node's total work.

Compare estimated and actual `rows`. A large mismatch near the bottom can lead to poor choices above it because later estimates depend on earlier ones. `Rows Removed by Filter` counts rows examined but discarded.

`BUFFERS` shows how PostgreSQL accessed table and index blocks. A `hit` means a requested block was already in PostgreSQL's buffer cache. A `read` means PostgreSQL had to request the block from storage; the operating system might still have cached it. Buffer counts often explain why two executions with similar plan shapes take different amounts of time.

Do not add node times: parent measurements include their children. `Execution Time` reports server execution time, excluding planning and sending results to the client. Use node measurements to find expensive work; an application's total response time includes more than query execution.

## Use a focused diagnosis loop

When a query is unexpectedly slow, use this sequence:

1. Capture the exact SQL and representative parameter values. Different values can produce very different row counts.
2. Run plain `EXPLAIN` and read the plan from the leaves upward.
3. When executing the query is safe, run `EXPLAIN (ANALYZE, BUFFERS)` under representative conditions.
4. Find the earliest large mismatch between estimated and actual rows. Check whether the data changed substantially without fresh statistics; `ANALYZE <table>` refreshes them.
5. Look for work multiplied by many `loops`, large numbers of rows removed by a filter, expensive sorts, or scans that process far more rows than they emit.
6. Change one thing at a time, collect a new plan, and compare both the results and measurements.

A sequential scan is not automatically a problem. Reading most of a small table sequentially can be cheaper than making many scattered lookups. The next lesson explains how indexes create additional access paths and how to judge whether one matches a workload.

## Treat `EXPLAIN ANALYZE` as execution

`EXPLAIN ANALYZE` executes writes too. They change data, run triggers (automatic actions attached to a table), acquire locks, and may wait for other transactions. Use the transaction pattern from the transactions lesson to roll back ordinary table changes:

```sql
BEGIN;

EXPLAIN (ANALYZE, BUFFERS)
UPDATE plan_orders
SET status = 'archived'
WHERE placed_on < CURRENT_DATE - 20;

ROLLBACK;
```

Use this only when executing the write itself is safe. A rollback does not undo every possible effect, such as values consumed from sequences or actions an external system performs in response to a trigger. Prefer a representative non-production environment for risky or expensive statements.

## Official resources

- [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [EXPLAIN command reference](https://www.postgresql.org/docs/current/sql-explain.html)
- [Statistics used by the planner](https://www.postgresql.org/docs/current/planner-stats.html)
- [ANALYZE command reference](https://www.postgresql.org/docs/current/sql-analyze.html)

## Practice

Create a temporary data set whose statistics you can deliberately make stale:

```sql
CREATE TEMP TABLE practice_events AS
SELECT
  n AS id,
  (n % 500) + 1 AS actor_id,
  CASE WHEN n <= 100 THEN 'error' ELSE 'info' END AS event_type
FROM generate_series(1, 100000) AS n;

ANALYZE practice_events;
```

Run `EXPLAIN (ANALYZE, BUFFERS)` for a query that filters `event_type = 'error'`, groups by `actor_id`, orders by `count(*)` descending, and returns the first five groups. Record the scan node's estimated rows, actual rows, rows removed by the filter, and the top-level execution time.

Without running `ANALYZE`, change every row with `id <= 20000` to `event_type = 'error'` and capture the plan again. Find the first material difference between estimated and actual rows. Refresh the statistics, run the same plan a third time, and compare the estimate.

You are done when you can identify how stale statistics changed the estimate without confusing planner cost with elapsed milliseconds. The temporary table disappears when the session ends.
