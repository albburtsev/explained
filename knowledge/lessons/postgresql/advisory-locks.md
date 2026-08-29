---
slug: postgresql/advisory-locks
title: Advisory Locks
description: Coordinate application-defined PostgreSQL resources with stable lock keys, suitable lifetimes, and deliberate wait behavior.
tags:
  - postgresql
  - databases
  - concurrency
  - locking
---

Row and table locks protect database objects that PostgreSQL understands. Some operations need a different boundary: only one process should rebuild a report, schedule work for one tenant, or perform a transition that spans several tables but has no single row to lock.

An **advisory lock** associates a PostgreSQL lock with an application-defined numeric key. PostgreSQL manages conflicts and waiting, but it does not know what the key represents and does not automatically lock any rows. The guarantee exists only when every participating code path follows the same key convention and acquires the lock before touching the resource.

Use an ordinary constraint, atomic statement, or row lock when the rule maps naturally to stored data. Use an advisory lock when the resource or critical section belongs to the application's model rather than to one PostgreSQL row or table.

## Design a stable key convention

Each advisory-lock function accepts either one `bigint` key or a pair of `integer` keys. The two forms use separate key spaces, so a one-value key never conflicts with a two-value key.

The two-integer form is convenient when one value identifies a resource type and the other identifies a resource instance:

```text
(21, tenant_id) means "rebuild this tenant's search index"
(22, tenant_id) means "generate this tenant's monthly invoice batch"
```

The numbers have no built-in meaning. Define their interpretation in one shared application module or database function, and keep these properties explicit:

- The same logical resource always produces the same key.
- Unrelated resource types cannot accidentally produce the same key.
- Every service that coordinates the resource uses the same convention.
- The identifier fits the selected `integer` or `bigint` function signature.

Avoid casually hashing arbitrary strings into a small key space. Different strings can collide, causing unrelated work to block. If a stable numeric identifier already exists, prefer it. If the application must encode several values into one `bigint`, document and test the encoding and its allowed ranges.

Advisory-lock keys are local to a database. Identical keys acquired in different databases do not coordinate with each other.

## Prefer a transaction-level lock for database work

A **transaction-level advisory lock** lasts until the current transaction commits or rolls back. `pg_advisory_xact_lock` waits until it can acquire an exclusive lock:

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

The lock serializes only cooperating callers. An `UPDATE` that skips `pg_advisory_xact_lock(21, 7001)` can still change rows for tenant `7001`. Keep database constraints for invariants that must hold regardless of the caller.

You can observe the conflict without creating any tables. Keep this transaction open in session A:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(21, 7001);
```

In session B, try the same key and then a different key:

```sql
BEGIN;

SELECT pg_try_advisory_xact_lock(21, 7001) AS same_resource;
-- false

SELECT pg_try_advisory_xact_lock(21, 7002) AS different_resource;
-- true

ROLLBACK;
```

Commit session A, then repeat the first try inside a new transaction in session B. It now returns `true`. The explicit transaction blocks matter: a transaction-level lock acquired in an autocommitted statement is released as soon as that statement finishes.

Acquire the lock before reading the state on which the protected decision depends. Under `READ COMMITTED`, for example, locking first ensures that the following statements begin after the previous holder's transaction finishes:

```sql
BEGIN;

SELECT pg_advisory_xact_lock(22, 7001);

SELECT count(*)
FROM invoice_batches
WHERE tenant_id = 7001
  AND billing_month = DATE '2026-08-01';

-- Create the batch only when it does not exist.

COMMIT;
```

The first lesson's transaction rules still apply. Keep the transaction short, retry the whole transaction after a deadlock or serialization failure, and encode a uniqueness rule as a database constraint when possible. The advisory lock can coordinate a workflow, but it should not be the only defense against invalid stored data.

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

The application must inspect `acquired`. If it is `false`, roll back without running the protected work. If it is `true`, perform the work and commit:

```sql
-- Run only after acquired is true.
UPDATE tenant_search_state
SET rebuilt_at = clock_timestamp()
WHERE tenant_id = 7001;

COMMIT;
```

A blocking call is appropriate when every request must eventually run and the surrounding request has a sensible timeout and cancellation policy. A try call is often easier for scheduled jobs because another worker can treat `false` as "already running" rather than wait.

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
- With a connection pool, the code must retain the same physical database session through acquisition, protected work, and release. Returning a locked connection to the pool can block unrelated requests.

Use structured cleanup such as a `finally` block in application code, verify that `pg_advisory_unlock` returns `true`, and reserve session-level locking for a requirement that cannot fit safely in one transaction. Transaction-level locks are simpler for ordinary database changes because PostgreSQL ties cleanup to the transaction boundary.

## Choose exclusive or shared mode

The functions shown so far acquire **exclusive** advisory locks: only one session can hold the key in a conflicting mode. PostgreSQL also provides shared variants, including `pg_advisory_xact_lock_shared` and `pg_try_advisory_xact_lock_shared`.

Multiple sessions may hold a shared lock on the same key simultaneously. An exclusive request conflicts with both shared and exclusive holders. This can model many compatible observers versus one exclusive maintainer, but it works only if readers and writers both participate in the convention.

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

Be careful when calling lock functions over a query result. SQL expression evaluation order can cause PostgreSQL to acquire more locks than an attached `LIMIT` suggests. If `resource_id` follows the documented `integer` key convention, select the intended keys in a subquery first:

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

`granted = false` identifies a waiting request. As in the previous lesson, use `pg_blocking_pids(pid)` to find the sessions ahead of a waiter. PostgreSQL stores the numeric key parts in `classid`, `objid`, and `objsubid`; your application key registry is what turns those numbers back into useful resource names.

## Apply the decision rules

- Prefer constraints, atomic statements, and row locks for rules tied directly to stored rows.
- Use advisory locks only when every participating caller can follow the same application-defined protocol.
- Give each resource a stable, collision-resistant numeric key and document its namespace.
- Prefer transaction-level locks for work that fits in one transaction.
- Use a try function when skipping or rescheduling is better than waiting.
- Use session-level locks only with guaranteed same-session execution and balanced cleanup.
- Acquire multiple keys in a consistent order, keep the protected section short, and monitor waits through `pg_locks`.

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
