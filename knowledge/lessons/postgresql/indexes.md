---
slug: postgresql/indexes
title: Indexes
description: Design PostgreSQL indexes around real query shapes, verify their plans, and account for their write and deployment costs.
tags:
  - postgresql
  - databases
  - query-performance
  - indexes
---

An **index** is a separate data structure that gives PostgreSQL another way to find or order rows. Without a suitable index, PostgreSQL may have to inspect an entire table. With one, it may navigate directly to a much smaller set of candidate rows.

An index is an option, not an instruction. The planner compares available paths and may still choose a sequential scan when a table is small, a condition matches many rows, or its estimates make the scan cheaper. Use the `EXPLAIN` workflow from the previous lesson to judge a concrete query rather than treating every sequential scan as a defect.

## Measure a query before adding an index

Create a temporary table with enough rows to make different access paths visible:

```sql
CREATE TEMP TABLE index_orders AS
SELECT
  n::bigint AS id,
  (n % 1000) + 1 AS customer_id,
  CASE WHEN n % 100 = 0 THEN 'pending' ELSE 'paid' END AS status,
  timestamptz '2026-01-01 00:00:00+00'
    + (n * interval '1 minute') AS placed_at,
  ((n * 37) % 10000)::numeric / 100 AS total
FROM generate_series(1, 200000) AS n;

ANALYZE index_orders;
```

Inspect a common query: fetch one customer's latest orders.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, placed_at, total
FROM index_orders
WHERE customer_id = 42
ORDER BY placed_at DESC
LIMIT 20;
```

Your exact plan and timings can differ. With no index, expect PostgreSQL to examine the table and sort matching rows before applying the limit. Record the scan node, rows removed by its filter, sort node, buffers, and execution time. Those observations are the baseline for the change.

## Match the index to the query shape

`CREATE INDEX` uses a B-tree unless another method is specified. A B-tree supports common equality and range comparisons and can return entries in order.

A first attempt might index only the filter column:

```sql
CREATE INDEX index_orders_customer_idx
ON index_orders (customer_id);

ANALYZE index_orders;
```

Run the same `EXPLAIN (ANALYZE, BUFFERS)` again. The planner can now locate rows for customer `42` through the index, although it may still sort those rows by `placed_at`.

The complete query shape includes both equality on `customer_id` and ordering by `placed_at`. A multicolumn index can support both:

```sql
CREATE INDEX index_orders_customer_time_idx
ON index_orders (customer_id, placed_at DESC);
```

Run the plan a third time. PostgreSQL can start at entries for customer `42`, read them in descending timestamp order, and stop after 20 rows. Depending on the data and cache state, you may see an `Index Scan` without a separate sort.

Column order matters in a multicolumn B-tree. It is most efficient when the query constrains the leading columns: equality conditions on the leading columns, followed by a range or ordering requirement, are a common pattern. PostgreSQL can sometimes use conditions on later columns through other techniques, but do not assume that `(customer_id, placed_at)` replaces an index needed for frequent searches on `placed_at` alone. Verify each important query shape.

Avoid keeping the first index automatically. The second index begins with `customer_id` and can often serve simple customer lookups too. If plans for the real workload confirm that, the single-column index is redundant and only adds storage and write work.

## Use specialized indexes deliberately

The default B-tree covers many workloads, but PostgreSQL offers other index methods and index definitions. Choose them by the operators and queries they must support:

- **B-tree** handles equality, ranges, null tests, and ordered retrieval.
- **Hash** handles equality only.
- **GIN** is an inverted index for values with components, including arrays, full-text search data, and suitable JSONB operators. The later JSONB lesson applies it to document queries.
- **GiST** and **SP-GiST** support extensible strategies such as geometric, range, and nearest-neighbor searches, depending on the operator class.
- **BRIN** stores summaries for physical block ranges. It can be compact and effective on very large tables when indexed values correlate with row storage order, such as an append-only timestamp.

The index method is only half of the match. Its **operator class** determines which operators the index supports for a data type. Before choosing a non-default method, begin with the exact `WHERE`, `JOIN`, or `ORDER BY` operators and check that the intended operator class supports them.

Three definitions solve common cases without indexing every row and column.

An **expression index** stores the result of a repeated expression. This index supports case-insensitive email lookup and enforces case-insensitive uniqueness:

```sql
CREATE UNIQUE INDEX users_email_lower_uniq
ON users (lower(email));

SELECT id
FROM users
WHERE lower(email) = lower('Ada@example.com');
```

The query expression must match what the index stores. Computing and maintaining that expression adds write cost.

A **partial index** includes only rows satisfying its predicate. If pending orders are a small, frequently queried subset, this index is smaller than indexing all statuses:

```sql
CREATE INDEX orders_pending_customer_time_idx
ON orders (customer_id, placed_at DESC)
WHERE status = 'pending';
```

A query can use it only when PostgreSQL can prove at planning time that the query condition implies `status = 'pending'`. Keep the predicate aligned with stable workload conditions; differently written or parameterized conditions may not establish that implication.

A **covering index** uses `INCLUDE` to store payload columns that are returned but are not search keys:

```sql
CREATE INDEX orders_customer_time_cover_idx
ON orders (customer_id, placed_at DESC)
INCLUDE (total, status);
```

This can enable an index-only scan when all required columns are available in the index and PostgreSQL can determine row visibility without visiting the table. It does not guarantee one: recently changed heap pages often still need visits. Included columns also enlarge the index, so add only narrow payloads for measured, important queries.

## Separate performance from correctness

PostgreSQL automatically creates unique B-tree indexes for primary-key and unique constraints. Do not create a duplicate index on the same keys. Prefer a constraint when the rule is part of the data model because it states the intent directly:

```sql
ALTER TABLE users
ADD CONSTRAINT users_email_unique UNIQUE (email);
```

Use `CREATE UNIQUE INDEX` when the rule specifically needs an expression or a subset, as in the earlier examples. Recall from the foreign-key lesson that PostgreSQL indexes the referenced primary or unique key, but does not automatically index the referencing columns.

An ordinary non-unique index improves possible access paths but never guarantees that a query will use it. Correctness must not depend on a particular plan.

## Account for lifecycle costs

Every index consumes storage and must be updated when relevant rows are inserted, deleted, or changed. More indexes can make reads faster while making writes and vacuum work heavier. Before adding one, identify the important query shape and compare its plan under representative data. After adding it, verify that execution improves and that the results remain correct.

For an existing busy table, a normal index build allows reads but blocks writes until the build finishes. PostgreSQL provides a production-oriented alternative:

```sql
CREATE INDEX CONCURRENTLY orders_customer_time_idx
ON orders (customer_id, placed_at DESC);
```

`CONCURRENTLY` permits normal writes during the build, but performs more work, usually takes longer, and cannot run inside a transaction block. A failed concurrent build can leave an invalid index that is ignored for queries but still costs write work. Check the operation's result and the index state; PostgreSQL recommends dropping the invalid index and retrying, or rebuilding it with `REINDEX INDEX CONCURRENTLY`.

Do not remove an apparently unused index from one observation. Statistics such as `idx_scan` in `pg_stat_user_indexes` cover only the period since statistics were reset, and indexes may also enforce constraints or support infrequent critical operations. Review a representative observation window, constraint ownership, duplicate prefixes, index size, and important plans before removal.

## Apply an evidence-based checklist

For each proposed index:

1. Start from a frequent or costly query, not from a column in isolation.
2. Match key order, expressions, predicate, and operator class to that query.
3. Compare `EXPLAIN (ANALYZE, BUFFERS)` before and after under representative data.
4. Check whether an existing index or constraint already covers the need.
5. Keep only the columns that contribute enough value to justify storage and write cost.
6. Choose a deployment method appropriate for the table's write traffic and verify the finished index.
7. Revisit the choice as data distribution and workload change.

The goal is not to maximize the number of index scans. It is to give PostgreSQL useful access paths for real workloads while keeping their maintenance cost deliberate.

## Official resources

- [Introduction to indexes](https://www.postgresql.org/docs/current/indexes-intro.html)
- [Index types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
- [Indexes on expressions](https://www.postgresql.org/docs/current/indexes-expressional.html)
- [Partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [Index-only scans and covering indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)
- [Index usage statistics](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-INDEXES-VIEW)
- [`CREATE INDEX`](https://www.postgresql.org/docs/current/sql-createindex.html)

## Practice

Build a temporary table large enough to compare two access paths locally:

```sql
CREATE TEMP TABLE practice_orders AS
SELECT
  n::bigint AS id,
  (n % 2000) + 1 AS store_id,
  timestamptz '2026-01-01 00:00:00+00'
    + (n * interval '1 minute') AS created_at,
  ((n * 37) % 10000)::numeric / 100 AS total
FROM generate_series(1, 200000) AS n;

ANALYZE practice_orders;
```

Use `EXPLAIN (ANALYZE, BUFFERS)` to establish a baseline for this query shape: filter for `store_id = 42`, order by `created_at` descending, return `id`, `created_at`, and `total`, and stop after 20 rows. Record the scan, sort, buffer counts, and execution time.

Create one B-tree index whose column order supports both the equality condition and requested ordering. Run `ANALYZE`, execute the identical query plan again, and compare it with the baseline.

You are done when both queries return the same 20 rows in the same order and you can explain why the indexed plan can stop early without a separate sort. Exact timings may vary between runs. The temporary table and index disappear when the session ends.
