---
slug: postgresql/row-and-table-locks
title: Row and Table Locks
description: Use PostgreSQL row and table locks, prevent deadlocks, and find blocked transactions.
tags:
  - postgresql
  - databases
  - concurrency
  - locking
---

MVCC lets ordinary reads use snapshots while writes proceed. Some decisions also need to prevent concurrent changes. A **lock** makes incompatible operations wait. PostgreSQL takes many locks automatically; explicit locks can protect decisions that span several statements.

The scope matters:

- A **row-level lock** coordinates changes to selected rows. It does not block an ordinary `SELECT`, but it can block another transaction that tries to update, delete, or lock the same rows incompatibly.
- A **table-level lock** coordinates access to a whole table. PostgreSQL takes one for every table a statement touches, even when the statement also locks individual rows.

Row and table locks normally last until `COMMIT` or `ROLLBACK`. Keep the transaction boundary from the transactions lesson in mind when deciding how long to hold one.

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

While session A holds the lock, an ordinary `SELECT` in session B can read the last committed row version. A competing `UPDATE`, `DELETE`, or `SELECT ... FOR UPDATE` for product `101` waits.

At `READ COMMITTED`, a locking read that waited rechecks the row after session A finishes and returns the updated version if it still matches `WHERE`. A deleted row is not returned. At `REPEATABLE READ` or `SERIALIZABLE`, a row changed since the snapshot can instead cause a serialization failure.

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

At `READ COMMITTED`, PostgreSQL automatically locks the row it updates and rechecks `stock >= 3` after waiting for a concurrent update. One returned row means success; zero means insufficient stock or an unknown product. Checking and changing happen in one statement. With autocommit, the lock ends when the statement's transaction finishes.

Use a locking read when a decision needs several statements based on the same row. Keep work that does not need the database outside the locked transaction where possible.

## Choose the weakest sufficient row lock

PostgreSQL offers four strengths in a `SELECT` locking clause:

| Clause | What it protects | Typical use |
| --- | --- | --- |
| `FOR UPDATE` | Blocks other row lockers, updates, and deletes. | The transaction may update key columns or delete the row. |
| `FOR NO KEY UPDATE` | Blocks conflicting writers but permits `FOR KEY SHARE`. | The transaction will change only non-key values. |
| `FOR SHARE` | Allows other shared row locks but blocks updates and deletes. | Multiple transactions may inspect a row while preventing changes. |
| `FOR KEY SHARE` | Prevents deletion and key-changing updates while permitting non-key updates. | A transaction depends on the row's referenced key remaining valid. |

`UPDATE` and `DELETE` take row locks automatically. For an explicit locking read, choose the weakest mode that protects the rule. Stronger modes can make more transactions wait.

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

INSERT INTO jobs (status)
VALUES ('ready'), ('ready');

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

Statements that access tables acquire table locks. Each mode conflicts with a defined set of other modes. Despite their names, `ROW SHARE` and `ROW EXCLUSIVE` are table-level locks.

The most useful modes to recognize are:

| Statement or operation | Usual table-level mode | Practical effect |
| --- | --- | --- |
| Plain `SELECT` | `ACCESS SHARE` | Coexists with ordinary reads and writes; only `ACCESS EXCLUSIVE` blocks it. |
| `SELECT ... FOR UPDATE` and other row-locking reads | `ROW SHARE` | Announces that rows may be locked while allowing ordinary reads and writes. |
| `INSERT`, `UPDATE`, `DELETE`, or `MERGE` | `ROW EXCLUSIVE` | Allows concurrent data changes; conflicting row locks still serialize changes to the same rows. |
| `CREATE INDEX` without `CONCURRENTLY` | `SHARE` | Allows reads but blocks data-changing statements. |
| `TRUNCATE`, `DROP TABLE`, `VACUUM FULL`, and many schema changes | `ACCESS EXCLUSIVE` | Conflicts with every mode, including plain reads. |

Even a small schema change can wait behind a long transaction and cause other sessions to queue behind it. Check the documented lock mode for the exact command before running it on a busy table.

Use an explicit table lock when a rule requires it. For example, maintenance can block concurrent data changes while still allowing reads:

```sql
BEGIN;

LOCK TABLE inventory IN SHARE MODE NOWAIT;
-- Perform the coordinated maintenance work.

COMMIT;
```

Always state the mode. Omitting it makes `LOCK TABLE` request `ACCESS EXCLUSIVE`, the most restrictive mode. An explicit table lock must run inside a transaction and is held until that transaction ends.

## Prevent and recover from deadlocks

A **deadlock** occurs when transactions form a cycle: each holds a lock needed by another. PostgreSQL detects the cycle and aborts one transaction, but the application cannot predict which one.

A consistent locking order helps prevent deadlocks. A transfer can lock both accounts in key order before changing either one:

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

Every code path that locks these accounts should use the same ordering. When a transaction will need a strong mode on an object, take that mode the first time it locks the object instead of upgrading later. Keep transactions short. Never hold a transaction open while waiting for user input.

Deadlocks can still happen. Treat a deadlock error as a failed transaction: roll back and retry the whole operation from the beginning, just as with the retryable transaction failures introduced in the isolation lesson.

## Find blocked sessions

When a query appears stuck, start with `pg_stat_activity` and PostgreSQL's blocker function:

```sql
SELECT
  pid,
  pg_blocking_pids(pid) AS blocked_by,
  now() - query_start AS query_age,
  query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```

`blocked_by` lists the process IDs ahead of each waiting session. `query_age` measures time since the query started, not just its lock wait. Check what the blocking sessions are doing before cancelling one.

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
    OR database = 0
    OR database = (SELECT oid FROM pg_database WHERE datname = current_database())
  );
```

A row-level wait often appears as a wait on the transaction ID of the session holding the row lock rather than as a tuple entry. Use `pg_blocking_pids()` instead of trying to infer blocker relationships from a self-join of `pg_locks`.

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
