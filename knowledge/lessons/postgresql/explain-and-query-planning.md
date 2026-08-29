---
slug: postgresql/explain-and-query-planning
title: EXPLAIN and Query Planning
description: Read PostgreSQL query plans, compare estimates with execution data, and identify the first useful performance question.
tags:
  - postgresql
  - databases
  - query-performance
---

PostgreSQL does not execute a SQL query exactly as it is written. Its **planner** evaluates possible ways to perform the work and selects a **query plan**: a tree of operations such as scanning rows, filtering them, joining inputs, sorting, and aggregating.

The planner chooses between valid plans by estimating how many rows each operation will emit and how expensive the resulting work will be. Those estimates come largely from table statistics. `EXPLAIN` makes the chosen plan visible, while `EXPLAIN ANALYZE` runs the statement and adds measurements from that execution.

## Create a predictable example

The following temporary table keeps this lesson separate from application data. `generate_series` creates 100,000 rows, and `ANALYZE` collects the statistics the planner needs for useful estimates:

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

Consider a query that finds customers with the most pending orders:

```sql
SELECT customer_id, count(*) AS order_count
FROM plan_orders
WHERE status = 'pending'
GROUP BY customer_id
ORDER BY order_count DESC
LIMIT 5;
```

Before running it, ask PostgreSQL for its estimate-only plan:

```sql
EXPLAIN
SELECT customer_id, count(*) AS order_count
FROM plan_orders
WHERE status = 'pending'
GROUP BY customer_id
ORDER BY order_count DESC
LIMIT 5;
```

Plain `EXPLAIN` plans the statement but does not execute it. This makes it a safe first inspection when running the statement itself would be slow or would modify data.

## Read the plan tree

Each line is a **plan node**. Indentation shows parent-child relationships: a parent consumes rows emitted by its children. Start at the deepest indented node, then move upward to reconstruct the flow of data.

For this query, identify these kinds of work in your own output:

- A scan obtains rows from `plan_orders` and applies the `status` filter.
- An aggregate groups the surviving rows by `customer_id` and computes `count(*)`.
- A sort orders the groups by their count.
- A limit stops after five output rows.

The exact node names and numbers can vary with the PostgreSQL release, statistics, configuration, and data. Focus first on what work each node performs rather than memorizing one plan shape.

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

`ANALYZE` adds `actual time`, `rows`, and `loops` to each node. Actual time is measured in milliseconds, and actual rows report rows emitted per execution. When `loops` is greater than one, the displayed time and row count are averages for one loop; multiply them by `loops` when you need totals for that node.

Compare estimated `rows` with actual `rows` at each node. A large difference near the bottom of the tree can lead the planner to make poor choices higher up because later cost estimates build on earlier row estimates. If a filter removes many rows, `Rows Removed by Filter` reveals work that produced no output.

`BUFFERS` shows how PostgreSQL accessed table and index blocks. A `hit` means a requested block was already in PostgreSQL's buffer cache. A `read` means PostgreSQL had to request the block from storage; the operating system might still have cached it. Buffer counts often explain why two executions with similar plan shapes take different amounts of time.

Do not add the times for all nodes: parent measurements include time spent in their children. Use the top-level `Execution Time` for the whole statement and node measurements to locate where the execution spent work.

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

`EXPLAIN ANALYZE` really runs its statement. A write therefore changes data, fires triggers, acquires locks, and can wait behind other transactions. For a transactional write, the transaction pattern from the first lesson can prevent ordinary table changes from being committed:

```sql
BEGIN;

EXPLAIN (ANALYZE, BUFFERS)
UPDATE plan_orders
SET status = 'archived'
WHERE placed_on < CURRENT_DATE - 20;

ROLLBACK;
```

Use this only when executing the write itself is safe. A rollback does not undo every possible effect, such as values consumed from sequences or actions an external system performs in response to a trigger. Prefer a representative non-production environment for risky or expensive statements.

## A practical reading checklist

For each plan, answer these questions before proposing an optimization:

- Which leaf nodes obtain the rows?
- Where are rows filtered, joined, grouped, sorted, or limited?
- How closely do estimated and actual row counts agree?
- Is costly work repeated through a high `loops` count?
- Do buffer reads or a large volume of discarded rows explain the work?
- Does the query return the intended result after any change?

`EXPLAIN` is evidence about one statement under particular data, statistics, parameters, and cache conditions. It is a starting point for a testable explanation, not a verdict based on one node name.

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
