---
slug: postgresql/advisory-locks
title: Advisory Locks
description: Coordinate application work with PostgreSQL advisory locks, stable numeric keys, and controlled lock lifetimes.
tags:
  - postgresql
  - databases
  - concurrency
  - locking
---

An **advisory lock** protects a numeric key chosen by an application. The key might represent a report rebuild or work for one tenant. PostgreSQL manages conflicting requests but does not know what the key means or automatically lock any rows.

Every caller must use the same key and acquire the lock before doing the protected work. Prefer a constraint, atomic statement, or row lock when it can express the rule directly. Advisory locks help when an operation has no suitable row or table to lock.

## Design a stable key convention

Each advisory-lock function accepts either one `bigint` key or a pair of `integer` keys. The two forms use separate key spaces, so a one-value key never conflicts with a two-value key.

The two-integer form is convenient when one value identifies a resource type and the other identifies a resource instance:

```text
(21, tenant_id) means "rebuild this tenant's search index"
(22, tenant_id) means "generate this tenant's monthly invoice batch"
```

Define the keys in one shared application module or database function:

- The same logical resource always produces the same key.
- Unrelated resource types cannot accidentally produce the same key.
- Every service that coordinates the resource uses the same convention.
- The identifier fits the selected `integer` or `bigint` function signature.

Prefer an existing stable numeric identifier. Hashing strings can produce collisions, making unrelated work wait. If several values must fit into one `bigint`, document and test the encoding and allowed ranges.

Advisory-lock keys are local to a database. Identical keys acquired in different databases do not coordinate with each other.

## Prefer a transaction-level lock for database work

A **transaction-level advisory lock** is released when its transaction commits or rolls back. `pg_advisory_xact_lock` waits to acquire an exclusive lock. This application example assumes the two document tables and their columns already exist; the practice exercise below needs no tables:

```sql
BEGIN;

SELECT pg_advisory_xact_lock(21, 7001);

-- Rebuild the application-defined resource for tenant 7001.
DELETE FROM tenant_search_documents
WHERE tenant_id = 7001;

INSERT INTO tenant_search_documents (tenant_id, document_id, search_text)
SELECT tenant_id, id, title || ' ' || body
FROM tenant_documents
WHERE tenant_id = 7001;

COMMIT;
```

If another transaction holds a conflicting lock on `(21, 7001)`, the `SELECT` waits. Work for `(21, 7002)` can proceed because it uses a different key. At `COMMIT` or `ROLLBACK`, PostgreSQL releases the transaction-level lock automatically; there is no transaction-level unlock function.

An `UPDATE` that skips this advisory lock can still change rows for tenant `7001`. Keep database constraints for rules that every writer must obey.

Use an explicit transaction: with autocommit, the lock is released when the locking statement finishes. Acquire it before reading the state needed for the decision. At `READ COMMITTED`, following statements get fresh snapshots after the previous holder finishes. Waiting for a lock does not refresh an existing `REPEATABLE READ` or `SERIALIZABLE` snapshot.

Keep transactions short and retry the whole transaction after a deadlock or serialization failure, as in the earlier transactions lesson.

## Choose waiting or fail-fast behavior

The function name determines what happens when another session owns a conflicting lock:

| Behavior | Transaction-level function | Result |
| --- | --- | --- |
| Wait | `pg_advisory_xact_lock(...)` | Returns after acquiring the lock. |
| Try once | `pg_try_advisory_xact_lock(...)` | Returns `true` immediately on success or `false` immediately when unavailable. |

Use the try form when skipping, rescheduling, or reporting "busy" is better than making a request wait:

```sql
BEGIN;

SELECT pg_try_advisory_xact_lock(21, 7001) AS acquired;
```

Inspect `acquired`. If it is `false`, roll back without running the protected work. If it is `true`, perform the work and commit. This illustrative update assumes `tenant_search_state` already exists:

```sql
-- Run only after acquired is true.
UPDATE tenant_search_state
SET rebuilt_at = clock_timestamp()
WHERE tenant_id = 7001;

COMMIT;
```

A blocking call suits work that should wait, with a timeout and a way to cancel. Scheduled jobs can often treat `false` as "already running" and skip or reschedule.

## Use session-level locks deliberately

A **session-level advisory lock** lasts across transaction boundaries. `pg_advisory_lock` waits; `pg_try_advisory_lock` returns a Boolean immediately. Release an exclusive session-level lock with `pg_advisory_unlock`:

```sql
SELECT pg_try_advisory_lock(30, 9001) AS acquired;

-- If acquired is true, the same database session may run several transactions.

SELECT pg_advisory_unlock(30, 9001) AS released;
```

Session scope is useful when one coordinated operation intentionally spans several transactions. It also carries additional obligations:

- A transaction rollback does not release the lock.
- Repeated acquisitions by the same session stack; each successful acquisition needs a matching unlock.
- The lock is released when the session ends, but relying on disconnect as routine cleanup hides bugs.
- A connection pool reuses database connections. Keep the same physical session for acquisition, work, and release. Returning it to the pool with a lock held can block unrelated requests.

After a successful acquisition, use guaranteed cleanup such as a `finally` block and check that `pg_advisory_unlock` returns `true`. Prefer transaction-level locks for work that fits in one transaction.

## Choose exclusive or shared mode

The functions above acquire **exclusive** locks, which conflict with all other sessions' locks on the same key. **Shared** locks allow several sessions to hold a key together. Use `pg_advisory_xact_lock_shared` or `pg_try_advisory_xact_lock_shared` for transaction-level shared locks.

This can allow several readers or one exclusive maintainer, provided both readers and writers follow the same convention. The same conflict rules apply between session-level and transaction-level requests.

Session-level shared locks use `pg_advisory_lock_shared`, `pg_try_advisory_lock_shared`, and the matching `pg_advisory_unlock_shared`. Do not unlock a shared acquisition with the exclusive unlock function.

## Prevent deadlocks and accidental lock sets

Advisory locks participate in PostgreSQL's normal deadlock detection. If one operation needs several keys, every code path should acquire them in the same stable order:

```sql
BEGIN;

SELECT pg_advisory_xact_lock(21, 7001);
SELECT pg_advisory_xact_lock(21, 7002);

-- Coordinate work involving both tenants.

COMMIT;
```

Ordering by resource type and then numeric identifier is one possible convention. PostgreSQL will abort one transaction if a deadlock still forms; roll back and retry the complete operation.

When calling lock functions over query results, evaluation order can cause more locks than an attached `LIMIT` suggests. Select the intended keys in a subquery first. This pattern assumes `pending_rebuilds` exists and `resource_id` has type `integer`; run it inside the transaction containing the protected work:

```sql
SELECT pg_advisory_xact_lock(21, selected.resource_id)
FROM (
  SELECT resource_id
  FROM pending_rebuilds
  WHERE ready
  ORDER BY resource_id
  LIMIT 10
) AS selected;
```

Advisory locks share PostgreSQL's lock-manager memory with regular locks. They are suitable for bounded coordination, not for locking an unbounded number of rows as a replacement for row locks.

## Inspect active advisory locks

Advisory locks appear in `pg_locks`. The following query shows holders and waiters in the current database:

```sql
SELECT
  pid,
  mode,
  granted,
  waitstart,
  classid,
  objid,
  objsubid
FROM pg_locks
WHERE locktype = 'advisory'
  AND database = (
    SELECT oid
    FROM pg_database
    WHERE datname = current_database()
  )
ORDER BY granted DESC, pid;
```

`granted = false` identifies a waiting request. Use `pg_blocking_pids(pid)` to find its blockers. For two-integer keys, `classid` holds the first key, `objid` the second, and `objsubid` is `2`. For one `bigint`, `classid` and `objid` hold its high and low 32-bit halves, and `objsubid` is `1`.

## Official resources

- [Advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Advisory lock functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
- [`pg_locks`](https://www.postgresql.org/docs/current/view-pg-locks.html)

## Practice

Open two macOS Terminal windows connected to `postgresql_course`. In session A, acquire a transaction-level advisory lock and keep the transaction open:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(90, 1);
```

In session B, begin a transaction and try two keys without waiting:

```sql
BEGIN;
SELECT pg_try_advisory_xact_lock(90, 1) AS same_resource;
SELECT pg_try_advisory_xact_lock(90, 2) AS different_resource;
```

Before ending either transaction, inspect advisory rows in `pg_locks` and identify their `pid`, key fields, mode, and granted state. Roll back session B, commit session A, then start a new transaction in session B and try `(90, 1)` again. Roll it back after observing the result.

You are done when the first try for `(90, 1)` returns `false`, the different key returns `true`, and the original key returns `true` after session A commits. No manual unlock or cleanup is required because every lock used transaction scope.
