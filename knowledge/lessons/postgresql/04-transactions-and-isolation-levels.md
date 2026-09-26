---
slug: postgresql/transactions-and-isolation-levels
title: Transactions and Isolation Levels
description: Group PostgreSQL changes into transactions, choose an isolation level, and retry concurrent operations safely.
tags:
  - postgresql
  - sql
  - transactions
  - concurrency
---

A **transaction** groups database statements into one unit that commits or rolls back. Its changes are **atomic**: they succeed or fail together.

An **isolation level** controls which changes from other transactions it can see and which concurrency problems PostgreSQL prevents. Grouping statements into a transaction does not by itself prevent every conflict with other sessions.

## Make a multi-step change atomic

Create a small table for the examples:

```sql
CREATE TABLE accounts (
  owner text PRIMARY KEY,
  balance numeric(12, 2) NOT NULL CHECK (balance >= 0)
);

INSERT INTO accounts (owner, balance)
VALUES ('Alice', 500.00), ('Bob', 200.00);
```

The `CHECK` constraint is a database rule that rejects negative balances. `PRIMARY KEY` makes each owner unique, and `NOT NULL` requires a balance.

A transfer requires both balances to change. Put both statements in one transaction:

```sql
BEGIN;

UPDATE accounts
SET balance = balance - 100.00
WHERE owner = 'Alice';

UPDATE accounts
SET balance = balance + 100.00
WHERE owner = 'Bob';

COMMIT;
```

`BEGIN` starts the transaction block. `COMMIT` makes all its successful changes visible as a unit. Use `ROLLBACK` instead when the operation must be abandoned:

```sql
BEGIN;

UPDATE accounts
SET balance = balance - 600.00
WHERE owner = 'Alice';
-- ERROR: the CHECK constraint rejects a negative balance

ROLLBACK;
```

After a statement error, the transaction is aborted; use `ROLLBACK` before continuing. Also check outcomes that are not SQL errors. An `UPDATE` that finds no account succeeds with a row count of zero. Before committing a transfer, verify that each update changed exactly one row.

Without an explicit transaction block, PostgreSQL still runs each statement in a transaction and normally commits a successful statement automatically. This **autocommit** behavior is convenient for independent statements, but it cannot make two separate statements all-or-nothing.

A rollback does not undo everything. A **sequence**, such as the counter behind an identity column, can consume numbers even if the transaction rolls back. A rollback also cannot undo actions in external systems.

## Understand what isolation controls

Suppose transaction A reads a balance while B changes it. Isolation determines whether a later query in A sees B's committed change. A **snapshot** is the view of committed data available to a query or transaction.

The common concurrency anomalies are:

- A **dirty read** observes another transaction's uncommitted data.
- A **nonrepeatable read** returns a different value when a transaction reads the same row again after another transaction commits a change.
- A **phantom read** returns a different set of matching rows after another transaction commits a change.
- A **serialization anomaly** produces a committed result that no one-at-a-time ordering of the transactions could have produced.

PostgreSQL accepts all four SQL isolation-level names, but implements three distinct behaviors:

| Requested level | Snapshot behavior in PostgreSQL | Main consequence |
| --- | --- | --- |
| `READ UNCOMMITTED` | Behaves like `READ COMMITTED` | Dirty reads still do not occur. |
| `READ COMMITTED` | A fresh snapshot for each statement | Two queries in one transaction can see different committed data. |
| `REPEATABLE READ` | One snapshot from the transaction's first query or data change | Repeated queries see a stable view, but serialization anomalies remain possible. |
| `SERIALIZABLE` | A stable snapshot plus checks for unsafe read/write patterns | Successfully committed transactions have an effect consistent with some serial order. |

`READ COMMITTED` is the PostgreSQL default. PostgreSQL's `REPEATABLE READ` is stronger than the SQL standard requires: it prevents phantom reads as well as nonrepeatable reads. Neither level allows dirty reads.

## Compare statement and transaction snapshots

Open two macOS Terminal windows and run `psql -d postgresql_course` in each. Label them session A and session B. In session A, start at the default isolation level and read Alice's balance:

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;

SELECT balance FROM accounts WHERE owner = 'Alice';
-- 400.00
```

The value is `400.00` after the earlier transfer. While session A remains open, run this statement in session B:

```sql
UPDATE accounts
SET balance = balance + 50.00
WHERE owner = 'Alice';
```

Assuming session B uses autocommit, its update is now committed. Query again in session A:

```sql
SELECT balance FROM accounts WHERE owner = 'Alice';
-- 450.00

ROLLBACK;
```

Each `SELECT` received a snapshot as of that statement's start, so the second query saw the newly committed value.

Repeat the experiment with a stable transaction snapshot. Start in session A:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

SELECT balance FROM accounts WHERE owner = 'Alice';
-- 450.00
```

Then add another `50.00` in session B using the same `UPDATE`. Session A continues to see its original snapshot:

```sql
SELECT balance FROM accounts WHERE owner = 'Alice';
-- still 450.00

ROLLBACK;
```

The snapshot is established by the first query or data-modification statement, not merely by executing `BEGIN`. A transaction always sees its own earlier changes as well.

Choose the isolation level when starting the transaction, as in these examples. The equivalent `SET TRANSACTION ISOLATION LEVEL ...` form must run before the transaction's first query or data-modification statement.

## Use Serializable for cross-row rules

A stable snapshot does not by itself preserve a rule that spans several rows. Suppose a service requires at least one doctor to remain on call:

```sql
CREATE TABLE on_call (
  doctor text PRIMARY KEY,
  active boolean NOT NULL
);

INSERT INTO on_call (doctor, active)
VALUES ('Alice', true), ('Bob', true);
```

Two `REPEATABLE READ` transactions could each count two active doctors and deactivate a different one. Both can commit because they update different rows, leaving nobody on call. This is a serialization anomaly: with one-at-a-time execution, the second transaction would see only one active doctor and refuse the change.

Run every transaction that enforces this rule at `SERIALIZABLE` instead:

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

SELECT count(*)
FROM on_call
WHERE active;

-- Deactivate one doctor only when the count is greater than one.
UPDATE on_call
SET active = false
WHERE doctor = 'Alice';

COMMIT;
```

The SQL comment does not enforce that condition; the application must check the count before it runs the `UPDATE`. If two sessions count first and then deactivate different doctors, PostgreSQL rejects one transaction with a serialization failure. Serializable permits concurrent work and aborts transactions when needed to preserve the serial-order guarantee.

Use `SERIALIZABLE` for decisions across several reads and writes when a database constraint cannot express the rule. Choose `REPEATABLE READ` for a stable view that does not need the serial-order guarantee. Use `READ COMMITTED` when the operation remains correct with a new snapshot for each statement.

## Treat retries as part of the contract

Transactions at `REPEATABLE READ` can fail when they try to change a row modified since their snapshot. `SERIALIZABLE` transactions can also fail when PostgreSQL detects a serialization anomaly. A serialization failure uses SQLSTATE `40001`.

Handle it by rolling back and retrying the **entire transaction** from the beginning:

```text
begin a new transaction
read every decision input again
perform all changes again
try to commit
if SQLSTATE is 40001, discard the attempt and retry
```

Retrying only the last statement would reuse decisions from an old snapshot. Keep transactions short, limit retries, and add a short delay between attempts under contention. Avoid external effects, such as sending a message, before commit unless they are safe to repeat.

## Official resources

- [Transactions tutorial](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [`SET TRANSACTION`](https://www.postgresql.org/docs/current/sql-set-transaction.html)

## Practice

Connect to `postgresql_course` and create an isolated table for the exercise:

```sql
DROP TABLE IF EXISTS practice_accounts;

CREATE TABLE practice_accounts (
  owner text PRIMARY KEY,
  balance numeric(12, 2) NOT NULL CHECK (balance >= 0)
);

INSERT INTO practice_accounts (owner, balance)
VALUES ('Alice', 500.00), ('Bob', 200.00);
```

First, transfer `80.00` from Alice to Bob inside a transaction, inspect both balances, and use `ROLLBACK`. Verify that the original balances return. Repeat the transfer and use `COMMIT`; the balances should now be `420.00` and `280.00`, while their sum remains `700.00`.

Next, open a second macOS Terminal window. In session A, begin a `REPEATABLE READ` transaction and read Alice's balance. In session B, add `20.00` to Alice and commit. Read Alice again in session A, then commit session A and read once more.

You are done when session A sees `420.00` twice inside its stable snapshot and `440.00` after committing. Drop `practice_accounts` when finished.
