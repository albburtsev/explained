---
slug: postgresql/indexes
title: Indexes
description: Match PostgreSQL indexes to queries, measure their effect, and account for storage, writes, and index builds.
tags:
  - postgresql
  - databases
  - query-performance
  - indexes
---

An **index** is a separate data structure that helps PostgreSQL find or order rows. It can reduce how much of a table a query needs to read.

The planner decides whether to use it. A sequential scan may cost less for a small table or a condition matching many rows. Use the previous lesson's `EXPLAIN` workflow to measure each query.

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

Column order matters. A multicolumn B-tree is usually most efficient with equality conditions on its leading columns, followed by a range or ordering condition. PostgreSQL can sometimes use later columns without a leading condition. Even so, measure searches on `placed_at` alone before assuming `(customer_id, placed_at)` covers them well.

The second index can often serve simple customer lookups too. If plans confirm this across the workload, remove the redundant single-column index to avoid extra storage and write work.

## Use specialized indexes deliberately

The default B-tree covers many workloads, but PostgreSQL offers other index methods and index definitions. Choose them by the operators and queries they must support:

- **B-tree** handles equality, ranges, null tests, and ordered retrieval.
- **Hash** handles equality only.
- **GIN** is an inverted index: it maps components of a value to matching rows. It supports arrays, full-text search, and suitable JSONB operators.
- **GiST** and **SP-GiST** support extensible strategies such as geometric, range, and nearest-neighbor searches, depending on the operator class.
- **BRIN** summarizes ranges of table blocks. It can be small and effective when indexed values follow physical row order, such as timestamps in a table that mainly receives new rows at the end.

An **operator class** defines which operators an index supports for a data type. Check the operators in the query's `WHERE`, `JOIN`, and `ORDER BY` clauses before choosing a method.

An **expression index** stores a calculated value. Create a temporary table to try case-insensitive email lookup and uniqueness:

```sql
CREATE TEMP TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL
);

CREATE UNIQUE INDEX users_email_lower_uniq
ON users (lower(email));

INSERT INTO users (email)
VALUES ('Ada@example.com');

SELECT id
FROM users
WHERE lower(email) = lower('ada@example.com');
```

The query uses the indexed expression, `lower(email)`. Computing and maintaining it adds write cost.

A **partial index** includes only rows matching its predicate, the condition after `WHERE`. Return to `index_orders` to index only pending orders:

```sql
CREATE INDEX orders_pending_customer_time_idx
ON index_orders (customer_id, placed_at DESC)
WHERE status = 'pending';
```

A query can use it only when PostgreSQL can prove at planning time that the query condition implies `status = 'pending'`. Keep the predicate aligned with stable workload conditions; differently written or parameterized conditions may not establish that implication.

A **covering index** contains all columns a query needs. `INCLUDE` adds columns that can be returned but are not search keys:

```sql
CREATE INDEX orders_customer_time_cover_idx
ON index_orders (customer_id, placed_at DESC)
INCLUDE (id, total, status);
```

This contains every column needed by the earlier latest-orders query. An **index-only scan** can avoid reading table pages when PostgreSQL also knows the rows are visible to the transaction. Recently changed pages may still need visits to check visibility. Included columns enlarge the index, so measure whether avoiding table reads justifies them.

## Separate performance from correctness

PostgreSQL creates unique B-tree indexes for primary-key and unique constraints. Do not add duplicate indexes on the same keys. For uniqueness on ordinary columns, a constraint states the rule directly. This alternative compares `email` as stored, unlike the earlier index on `lower(email)`:

```sql
ALTER TABLE users
ADD CONSTRAINT users_email_unique UNIQUE (email);
```

Use `CREATE UNIQUE INDEX` when the rule specifically needs an expression or a subset, as in the earlier examples. Recall from the foreign-key lesson that PostgreSQL indexes the referenced primary or unique key, but does not automatically index the referencing columns.

An ordinary non-unique index adds a possible access path, but it never guarantees that a query will use it. Correctness must not depend on a particular plan.

## Account for lifecycle costs

Indexes consume storage and add work to writes and cleanup. Compare plans using representative data, check that results remain correct, and keep only indexes whose benefits justify those costs.

On a permanent table, a normal index build allows reads but blocks writes until it finishes. `CONCURRENTLY` allows writes during the build. For example, if the foreign-key lesson's `orders` table did not yet have its supporting index, you could build it this way:

```sql
CREATE INDEX CONCURRENTLY orders_customer_id_idx
ON orders (customer_id);
```

Skip this command if that index already exists. Temporary tables always use non-concurrent builds because other sessions cannot access them.

A concurrent build does more work, usually takes longer, and cannot run inside a transaction block. Failure can leave an invalid index that queries ignore but writes still maintain. Check the result with `\d orders`. Recover by dropping the invalid index and retrying, or by using `REINDEX INDEX CONCURRENTLY`.

Before removing an index, observe it over a representative period. `idx_scan` in `pg_stat_user_indexes` counts scans only since statistics were reset. Also check whether the index enforces a constraint, supports rare but critical operations, or serves queries another index cannot handle efficiently.

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
