---
slug: postgresql/mvcc-and-vacuum
title: MVCC and Vacuum
description: Understand how PostgreSQL row versions support concurrent snapshots and how vacuum safely reclaims their space.
tags:
  - postgresql
  - databases
  - concurrency
  - vacuum
---

**Multiversion concurrency control (MVCC)** lets PostgreSQL keep several physical versions of one logical row. A statement's snapshot determines which **row version** it can see.

An ordinary `SELECT` can read a committed version while another transaction changes the row. It does not need a row lock, though table locks can still block it. Old versions occupy space until they are safe to remove. **Vacuum** makes that space reusable.

## Connect snapshots to row versions

Create a small table and inspect three PostgreSQL system columns:

```sql
CREATE TABLE mvcc_accounts (
  owner text PRIMARY KEY,
  balance numeric(12, 2) NOT NULL
);

INSERT INTO mvcc_accounts (owner, balance)
VALUES ('Alice', 500.00);

SELECT ctid, xmin, xmax, owner, balance
FROM mvcc_accounts;
```

The exact values will differ on every database:

- `ctid` identifies the row version's current physical location. It is useful for observation, not as a durable application identifier.
- `xmin` records the transaction ID that created this version.
- `xmax` records the transaction ID that deleted or replaced this version. It can also hold row-lock information, so its raw value is not a simple deleted flag.

Now update the logical row and inspect it again:

```sql
UPDATE mvcc_accounts
SET balance = 550.00
WHERE owner = 'Alice';

SELECT ctid, xmin, xmax, owner, balance
FROM mvcc_accounts;
```

An `UPDATE` creates a new row version. The query returns one Alice because only one version is visible to its snapshot; an older version may still occupy space. A `DELETE` also leaves a version that becomes invisible to later snapshots after commit.

Do not use `xmin`, `xmax`, or `ctid` as permanent application data. They expose implementation details that PostgreSQL manages and can change as rows are updated or tables are rewritten.

## See why an old version must remain

Use two sessions to connect the row versions to the isolation behavior from the transactions lesson. In session A, establish a transaction-level snapshot:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

SELECT balance
FROM mvcc_accounts
WHERE owner = 'Alice';
-- 550.00
```

While session A remains open, update the row and commit in session B:

```sql
UPDATE mvcc_accounts
SET balance = 600.00
WHERE owner = 'Alice';
```

Session A still sees the version from its snapshot:

```sql
SELECT balance
FROM mvcc_accounts
WHERE owner = 'Alice';
-- still 550.00

COMMIT;
```

A new statement after that commit sees `600.00`. PostgreSQL kept the earlier version for session A and the new version for later readers. When no snapshot or replica still needs an obsolete version, it becomes a **dead row version** that vacuum can remove.

## Understand what vacuum maintains

A standard `VACUUM` performs several related maintenance jobs:

1. It removes dead row versions and dead index entries when they are no longer needed, then marks their space for reuse by future writes.
2. It updates the table's **visibility map**, which records pages whose rows are visible to every transaction. This lets later vacuum runs skip safe pages and can let an index-only scan avoid visiting the table for visibility checks.
3. It **freezes** sufficiently old row versions so they remain safely recognizable as old when PostgreSQL's finite transaction ID counter wraps around.

Plain vacuum usually makes space reusable inside the table file without returning it to the operating system. A frequently updated table can therefore reuse space while its file size stays stable.

`ANALYZE` is a separate operation that samples table contents and refreshes planner statistics. Run both explicitly when a large data change needs immediate cleanup and fresh statistics:

```sql
VACUUM (VERBOSE, ANALYZE) mvcc_accounts;
```

Run `VACUUM` outside an explicit transaction block. `VERBOSE` reports what the operation did and is helpful while learning; it is not required for maintenance.

## Let autovacuum handle the routine case

**Autovacuum** schedules `VACUUM` and `ANALYZE` as tables change. It also vacuums to prevent transaction ID wraparound. Keep it enabled and adjust its settings when measurements show a need. Temporary tables, used in the query-planning lessons, need manual maintenance because autovacuum cannot access them.

Inspect its table-level statistics with:

```sql
SELECT
  relname,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  vacuum_count,
  autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

`n_live_tup` and `n_dead_tup` are estimates. Compare their trends with vacuum timestamps and the table's update rate. Investigate when the dead-row estimate grows and no recent autovacuum appears.

A manual vacuum can help after a large update or delete, or when autovacuum falls behind. For fresh planner statistics alone, use `ANALYZE`.

## Avoid delaying cleanup

Vacuum cannot remove a version that a transaction or replica still needs. Long-running transactions can therefore delay cleanup even when vacuum succeeds. Prepared transactions waiting for an external coordinator can delay it too, and so can replication slots that record what data a replica still needs.

Find transactions that have remained open for a long time:

```sql
SELECT
  pid,
  usename,
  state,
  xact_start,
  now() - xact_start AS transaction_age
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start;
```

Check a session's owner and purpose before ending it. In application code, begin transactions when needed and commit or roll back promptly. Avoid leaving a session `idle in transaction`, waiting for its next command with a transaction open.

Remove a replication slot only after confirming that its consumer no longer needs it.

## Reserve `VACUUM FULL` for exceptional recovery

`VACUUM FULL` rewrites the table into a compact file. It needs extra disk space and an `ACCESS EXCLUSIVE` table lock, which blocks other sessions from reading or writing the table.

Use it only when returning substantial disk space justifies a planned outage, such as after an unusually large deletion. If the table will grow again, standard vacuum is usually enough.

## Official resources

- [MVCC introduction](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [System columns](https://www.postgresql.org/docs/current/ddl-system-columns.html)
- [Routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html)
- [`VACUUM` command reference](https://www.postgresql.org/docs/current/sql-vacuum.html)
- [`pg_stat_user_tables` statistics](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW)

## Practice

Create a row that two local sessions can observe:

```sql
DROP TABLE IF EXISTS practice_mvcc_accounts;

CREATE TABLE practice_mvcc_accounts (
  owner text PRIMARY KEY,
  balance numeric(12, 2) NOT NULL
);

INSERT INTO practice_mvcc_accounts (owner, balance)
VALUES ('Alice', 500.00);
```

Open two macOS Terminal windows connected to `postgresql_course`.

1. In session A, begin a `REPEATABLE READ` transaction and select `ctid`, `xmin`, and `balance` for Alice.
2. In session B, add `100.00` to Alice and return the same three values. Run `VACUUM (VERBOSE, ANALYZE) practice_mvcc_accounts;` while session A remains open.
3. Read the row again in session A, commit, and read it once more outside the transaction.
4. In session B, run the verbose vacuum again and inspect `n_live_tup` and `n_dead_tup` in `pg_stat_user_tables` for this table.

You are done when the physical identifiers change after the update, session A keeps seeing `500.00` inside its snapshot, and a later statement sees `600.00`. Compare the two vacuum reports, then drop the table.
