---
slug: postgresql/row-and-table-locks
title: Row and Table Locks
description: Coordinate concurrent PostgreSQL work with row and table locks, avoid unnecessary contention, and diagnose blocked transactions.
tags:
  - postgresql
  - databases
  - concurrency
  - locking
---

MVCC lets ordinary reads and writes proceed concurrently, but some operations must reserve data before deciding what to change. A **lock** makes incompatible work wait until the transaction holding the lock ends. PostgreSQL acquires many locks automatically; explicit locking is useful when a multi-statement decision needs a guarantee that MVCC alone does not provide.

The scope matters:

- A **row-level lock** coordinates changes to selected rows. It does not block an ordinary `SELECT`, but it can block another transaction that tries to update, delete, or lock the same rows incompatibly.
- A **table-level lock** coordinates access to a whole table. PostgreSQL takes one for every table a statement touches, even when the statement also locks individual rows.

Locks normally last until `COMMIT` or `ROLLBACK`, so the transaction boundary from the first lesson is also the lock lifetime.

## Lock a row before making a decision

Create a small inventory table:

```sql
CREATE TABLE inventory (
  product_id bigint PRIMARY KEY,
  stock integer NOT NULL CHECK (stock >= 0)
);

INSERT INTO inventory (product_id, stock)
VALUES (101, 5);
```

Suppose an application must read the current stock, perform a small decision in application code, and then subtract three units. In session A, lock the row as it is read:

```sql
BEGIN;

SELECT stock
FROM inventory
WHERE product_id = 101
FOR UPDATE;

-- The application confirms that stock is at least 3.
UPDATE inventory
SET stock = stock - 3
WHERE product_id = 101;

COMMIT;
```

While session A is open, an ordinary `SELECT` in session B can still read the last committed row version. A competing `UPDATE`, `DELETE`, or `SELECT ... FOR UPDATE` for product `101` waits. Under the default `READ COMMITTED` isolation level, a waiting `SELECT ... FOR UPDATE` locks and returns the current version after session A finishes.

The `WHERE` clause defines the lock scope. Select only rows the transaction actually needs, and support the lookup with an appropriate index so PostgreSQL can find them efficiently. A row lock may also cause a disk write because PostgreSQL marks the row as locked.

Do not split the locking read and the update across transactions. Committing immediately after `SELECT ... FOR UPDATE` releases the lock before it protects anything.

## Prefer one atomic statement when possible

Explicit locking is not always needed. The stock change can express its rule in one statement:

```sql
UPDATE inventory
SET stock = stock - 3
WHERE product_id = 101
  AND stock >= 3
RETURNING stock;
```

PostgreSQL automatically locks a row that it updates. The application can treat one returned row as success and zero returned rows as insufficient stock or an unknown product. This atomic form has a shorter lock lifetime and removes the gap between checking and changing data.

Use a locking read when the decision cannot be expressed clearly in one statement, when several later statements depend on the same row, or when an external caller must choose among database changes. Even then, keep non-database work outside the locked transaction whenever possible.

## Choose the weakest sufficient row lock

PostgreSQL offers four strengths in a `SELECT` locking clause:

| Clause | What it protects | Typical use |
| --- | --- | --- |
| `FOR UPDATE` | Blocks other row lockers, updates, and deletes. | The transaction may update key columns or delete the row. |
| `FOR NO KEY UPDATE` | Blocks conflicting writers but permits `FOR KEY SHARE`. | The transaction will change only non-key values. |
| `FOR SHARE` | Allows other shared row locks but blocks updates and deletes. | Multiple transactions may inspect a row while preventing changes. |
| `FOR KEY SHARE` | Prevents deletion and key-changing updates while permitting non-key updates. | A transaction depends on the row's referenced key remaining valid. |

`UPDATE` and `DELETE` acquire appropriate row locks automatically. For an explicit locking read, choose the weakest mode that preserves the invariant: stronger modes create more contention without adding useful correctness.

For a join, add `OF <alias>` when only one input should be locked:

```sql
SELECT o.id, o.total, c.email
FROM orders AS o
JOIN customers AS c ON c.id = o.customer_id
WHERE o.id = 42
FOR UPDATE OF o;
```

This locks the matching `orders` row, not the contributing `customers` row.

## Decide whether to wait

The default behavior is to wait for an incompatible lock. Two modifiers provide deliberate alternatives:

- `NOWAIT` raises an error immediately if a selected row cannot be locked.
- `SKIP LOCKED` omits rows that cannot be locked immediately.

`NOWAIT` suits interactive or latency-sensitive work whose caller can retry or report that the resource is busy:

```sql
SELECT *
FROM inventory
WHERE product_id = 101
FOR UPDATE NOWAIT;
```

`SKIP LOCKED` is specialized for queue-like tables with multiple workers. Each worker can claim a different ready job inside one transaction:

```sql
CREATE TABLE jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('ready', 'running', 'done'))
);

BEGIN;

WITH next_job AS (
  SELECT id
  FROM jobs
  WHERE status = 'ready'
  ORDER BY id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE jobs AS j
SET status = 'running'
FROM next_job
WHERE j.id = next_job.id
RETURNING j.*;

COMMIT;
```

Skipping locked rows gives an intentionally incomplete view, so do not use it for general reporting or correctness checks. Both modifiers apply to row locks; the statement can still wait for its required table-level lock.

## Understand automatic table locks

Every statement acquires a table-level mode whose only behavior is which other table-level modes it conflicts with. The historical names can mislead: `ROW SHARE` and `ROW EXCLUSIVE` are both table-level locks.

The most useful modes to recognize are:

| Statement or operation | Usual table-level mode | Practical effect |
| --- | --- | --- |
| Plain `SELECT` | `ACCESS SHARE` | Coexists with ordinary reads and writes; only `ACCESS EXCLUSIVE` blocks it. |
| `SELECT ... FOR UPDATE` and other row-locking reads | `ROW SHARE` | Announces that rows may be locked while allowing ordinary reads and writes. |
| `INSERT`, `UPDATE`, `DELETE`, or `MERGE` | `ROW EXCLUSIVE` | Allows concurrent data changes; conflicting row locks still serialize changes to the same rows. |
| `CREATE INDEX` without `CONCURRENTLY` | `SHARE` | Allows reads but blocks data-changing statements. |
| `TRUNCATE`, `DROP TABLE`, `VACUUM FULL`, and many schema changes | `ACCESS EXCLUSIVE` | Conflicts with every mode, including plain reads. |

This explains why an apparently small schema migration can wait behind a long transaction and, once queued, contribute to a chain of blocked sessions. Check the documented lock level for the exact command variant before running a migration on an active table.

Acquire a table lock explicitly only when correctness genuinely spans the table. For example, a maintenance step that requires a stable set of rows can prevent concurrent data changes while still allowing reads:

```sql
BEGIN;

LOCK TABLE inventory IN SHARE MODE NOWAIT;
-- Perform the coordinated maintenance work.

COMMIT;
```

Always state the mode. Omitting it makes `LOCK TABLE` request `ACCESS EXCLUSIVE`, the most restrictive mode. An explicit table lock must run inside a transaction and is held until that transaction ends.

## Prevent and recover from deadlocks

A **deadlock** occurs when transactions form a cycle: each holds a lock needed by another. PostgreSQL detects the cycle and aborts one transaction, but the application cannot predict which one.

The strongest prevention is consistent acquisition order. A transfer that touches two accounts can lock both rows by stable key before changing either one:

```sql
BEGIN;

SELECT owner
FROM accounts
WHERE owner IN ('Alice', 'Bob')
ORDER BY owner
FOR UPDATE;

-- Apply both balance changes after both rows are locked.

COMMIT;
```

Every code path that locks these accounts should use the same ordering. Also acquire the strongest mode the transaction will need on an object the first time it locks that object, and keep transactions short. Never hold a transaction open while waiting for user input.

Deadlocks can still happen. Treat a deadlock error as a failed transaction: roll back and retry the whole operation from the beginning, just as with the retryable transaction failures introduced in the isolation lesson.

## Find blocked sessions

When a query appears stuck, start with `pg_stat_activity` and PostgreSQL's blocker function:

```sql
SELECT
  pid,
  pg_blocking_pids(pid) AS blocked_by,
  now() - query_start AS waiting_for,
  query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```

`blocked_by` lists the process IDs ahead of each waiting session. Investigate what those sessions are doing and how long their transactions have been open before deciding whether any should be cancelled.

For deeper inspection, `pg_locks` shows requested modes and whether they have been granted:

```sql
SELECT
  pid,
  locktype,
  relation::regclass AS relation,
  mode,
  granted,
  waitstart
FROM pg_locks
WHERE NOT granted
  AND (
    database IS NULL
    OR database = (SELECT oid FROM pg_database WHERE datname = current_database())
  );
```

A row-level wait often appears as a wait on the transaction ID of the session holding the row lock rather than as a tuple entry. Use `pg_blocking_pids()` instead of trying to infer blocker relationships from a self-join of `pg_locks`.

## Apply the decision rules

- Prefer constraints or one atomic data-changing statement when they can express the rule.
- Use a row lock when later work must rely on selected rows remaining safe to change.
- Use the weakest lock mode that preserves correctness and lock only the rows you need.
- Use `NOWAIT` for fail-fast behavior and reserve `SKIP LOCKED` for queue-like workloads.
- Use explicit table locks sparingly, always name the mode, and check schema-change lock levels before deployment.
- Acquire multiple locks in a consistent order, keep transactions short, and retry the whole transaction after a deadlock.
- Diagnose waits with `pg_stat_activity`, `pg_blocking_pids()`, and `pg_locks`.

The next lesson covers advisory locks, which coordinate application-defined resources that do not map naturally to rows or tables.

## Official resources

- [Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [`SELECT` locking clauses](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [`LOCK TABLE`](https://www.postgresql.org/docs/current/sql-lock.html)
- [Viewing locks](https://www.postgresql.org/docs/current/monitoring-locks.html)
- [`pg_locks`](https://www.postgresql.org/docs/current/view-pg-locks.html)

## Practice

Create a small work queue in `postgresql_course`:

```sql
DROP TABLE IF EXISTS practice_jobs;

CREATE TABLE practice_jobs (
  id bigint PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'done'))
);

INSERT INTO practice_jobs (id, status)
VALUES (1, 'queued'), (2, 'queued'), (3, 'queued');
```

Open two macOS Terminal windows. In each session, begin a transaction and select one queued job ordered by `id` with `FOR UPDATE SKIP LOCKED LIMIT 1`. Keep session A open after it selects the first row, then run the selection in session B. Update each returned job to `running` and commit both transactions.

Reset the rows to `queued`. In session A, lock job `1` with `FOR UPDATE` and leave the transaction open. In session B, try to lock the same row with `NOWAIT`; roll back session B after the expected error, then roll back session A.

You are done when the workers claim different job IDs and the `NOWAIT` attempt fails immediately instead of waiting. Drop `practice_jobs` after both transactions have ended.
