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

PostgreSQL lets one transaction read a stable view while another transaction changes the same table. It does this with **multiversion concurrency control (MVCC)**: instead of treating a row as one mutable object, PostgreSQL can keep multiple physical **row versions** and decide which version each SQL statement may see.

This separation is why ordinary reads do not block ordinary writes, and writes do not block reads. It also creates maintenance work. Versions that no transaction can see anymore occupy space until **vacuum** makes that space reusable.

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
- `xmax` participates in recording when a version was deleted or replaced, and can also contain row-lock information. Its raw value is not a simple visible/deleted flag.

Now update the logical row and inspect it again:

```sql
UPDATE mvcc_accounts
SET balance = 550.00
WHERE owner = 'Alice';

SELECT ctid, xmin, xmax, owner, balance
FROM mvcc_accounts;
```

An `UPDATE` normally creates a successor version rather than overwriting the old version in place. The query sees only the version visible to its snapshot, so it returns one Alice even though an older physical version can remain in the table. A `DELETE` similarly makes a version invisible to later snapshots without necessarily removing its storage immediately.

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

A new statement after that commit sees `600.00`. PostgreSQL needed both row versions while the old snapshot existed: session A needed the earlier version, while session B and later transactions needed the successor. Only after no relevant snapshot can see the earlier version is that version **dead** and eligible for removal.

This is the central MVCC tradeoff: readers and writers interfere less during normal work, but updates and deletes leave versions that require asynchronous cleanup.

## Understand what vacuum maintains

A standard `VACUUM` performs several related maintenance jobs:

1. It removes dead row versions and dead index entries when they are no longer needed, then marks their space for reuse by future writes.
2. It updates the table's **visibility map**, which records pages whose rows are visible to every transaction. This lets later vacuum runs skip safe pages and can let an index-only scan avoid visiting the table for visibility checks.
3. It **freezes** sufficiently old row versions so they remain safely recognizable as old when PostgreSQL's finite transaction ID counter wraps around.

Plain vacuum usually reuses space inside the existing table file; it usually does not return that space to the operating system. This is expected. A heavily updated table can reach a stable size and reuse the same space over many cycles.

`ANALYZE` is a separate operation that samples table contents and refreshes planner statistics. Run both explicitly when a large data change needs immediate cleanup and fresh statistics:

```sql
VACUUM (VERBOSE, ANALYZE) mvcc_accounts;
```

Run `VACUUM` outside an explicit transaction block. `VERBOSE` reports what the operation did and is helpful while learning; it is not required for maintenance.

## Let autovacuum handle the routine case

PostgreSQL's **autovacuum** system schedules `VACUUM` and `ANALYZE` work in response to table activity. It also runs anti-wraparound vacuuming when transaction IDs become old enough. For most databases, the right starting point is to keep autovacuum enabled and tune it only from observed workload evidence.

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

`n_live_tup` and `n_dead_tup` are estimates, not exact counts. Use them as trends alongside the last-run timestamps and the table's update rate. A growing dead-row estimate with no recent successful autovacuum is a reason to investigate, not by itself proof that vacuum is broken.

A manual vacuum can be appropriate after an unusual bulk update or delete, before a time-sensitive query-planning test, or while correcting an autovacuum backlog. It should supplement a healthy automatic process rather than replace it by default.

## Avoid holding the cleanup horizon open

Vacuum cannot remove a version that might still be visible to a transaction or required by a replication consumer. Long-lived transactions, prepared transactions, and stale replication slots can therefore retain old versions even while vacuum runs successfully.

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

Investigate the owner and purpose before ending any session. The practical application rule is simpler: begin transactions only when needed, complete their database work promptly, and commit or roll back instead of leaving sessions `idle in transaction`.

Replication slots intentionally retain data required by their consumers. Monitor them as part of replication operations and remove one only after confirming that its consumer no longer needs it.

## Reserve `VACUUM FULL` for exceptional recovery

`VACUUM FULL` is not a more thorough form of routine vacuum. It rewrites the table into a new compact file, requires extra temporary disk space, and takes an `ACCESS EXCLUSIVE` table lock that blocks concurrent use of that table.

Consider it only when returning substantial space to the operating system is worth a planned table outage, such as after an exceptional one-time deletion. If the workload will make the table grow again, regular standard vacuuming is usually the better steady-state strategy.

## Apply the operating rules

- Think of one logical row as a succession of physical versions selected by snapshots.
- Expect updates and deletes to create cleanup work; this is a normal cost of MVCC, not corruption.
- Keep autovacuum enabled and evaluate it with trends from `pg_stat_user_tables`.
- Keep transactions short so old snapshots do not unnecessarily delay cleanup.
- Use standard `VACUUM` for routine maintenance and `VACUUM (ANALYZE)` when planner statistics also need an immediate refresh.
- Treat `VACUUM FULL` as an exceptional, blocking table rewrite rather than a maintenance habit.

## Official resources

- [MVCC introduction](https://www.postgresql.org/docs/current/mvcc-intro.html)
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
