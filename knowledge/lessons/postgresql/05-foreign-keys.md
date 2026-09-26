---
slug: postgresql/foreign-keys
title: Foreign Keys
description: Enforce table relationships, choose delete and update actions, and add foreign keys to existing data.
tags:
  - postgresql
  - databases
  - data-integrity
  - foreign-keys
---

A **foreign key** requires a non-null value in one table to match a key in another. The table holding the reference is the **referencing table**; the target is the **referenced table**. Foreign keys can also refer to the same table.

For example, an order must refer to an existing customer. An application check alone is not enough: another transaction could delete the customer between the check and the insert. A foreign key makes PostgreSQL enforce the relationship during concurrent changes.

## Define a relationship

Create the referenced table first. Its target columns need a `NOT DEFERRABLE` primary key or unique constraint, or a unique index that covers every row:

```sql
CREATE TABLE customers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE
);

CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL,
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  CONSTRAINT orders_customer_fk
    FOREIGN KEY (customer_id)
    REFERENCES customers (id)
    ON DELETE RESTRICT
);
```

Here `orders` is the referencing table and `customers` is the referenced table. Naming the constraint makes errors and later schema changes easier to understand. Because `customers.id` is the primary key, `REFERENCES customers` without `(id)` would mean the same thing, but writing the column is often clearer.

Try the guarantee directly:

```sql
INSERT INTO customers (email)
VALUES ('ada@example.com')
RETURNING id;

-- Replace 1 with the returned id.
INSERT INTO orders (customer_id, total)
VALUES (1, 49.90);

-- Rejected because customer 999999 does not exist.
INSERT INTO orders (customer_id, total)
VALUES (999999, 10.00);
```

The foreign key does not make the relationship mandatory by itself. A null referencing value is normally exempt from the match. Add `NOT NULL`, as above, when every order must belong to a customer.

## Choose what happens to referenced rows

`ON DELETE` states what PostgreSQL should do when a referenced row still has dependents:

| Action | Result | Appropriate when |
| --- | --- | --- |
| `NO ACTION` | Rejects the change if the constraint is still broken when checked; this is the default. | The application should resolve the relationship explicitly. |
| `RESTRICT` | Rejects the change immediately and cannot be deferred. | Independent records must never be removed implicitly. |
| `CASCADE` | Deletes the referencing rows too. | The referencing rows are components with no meaning outside the referenced row. |
| `SET NULL` | Clears the reference. | The relationship is optional and the referencing column permits null. |
| `SET DEFAULT` | Replaces the reference with its column default. | The default identifies a valid referenced row, or is null. |

Use `CASCADE` when dependent rows belong to the referenced row. Deleting an order can reasonably delete its line items; deleting a customer should usually preserve order history. Check the business rule because a cascade can delete many rows.

`ON UPDATE` accepts the same actions for changes to the referenced key. Generated identifiers rarely change. If a key is a business value that can change, `ON UPDATE CASCADE` copies the new value to referencing rows.

## Model multi-column relationships

A **composite foreign key** uses several columns together. If tenants share tables, include the tenant identifier on both sides to prevent references to another tenant's data:

```sql
CREATE TABLE projects (
  tenant_id bigint NOT NULL,
  project_code text NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (tenant_id, project_code)
);

CREATE TABLE tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL,
  project_code text NOT NULL,
  title text NOT NULL,
  CONSTRAINT tasks_project_fk
    FOREIGN KEY (tenant_id, project_code)
    REFERENCES projects (tenant_id, project_code)
    ON DELETE CASCADE
);
```

Both sides need the same number of columns in corresponding order, with compatible types. By default, `MATCH SIMPLE` lets a row skip the check if any referencing column is null. Use `NOT NULL` on every component when the relationship is required. For an optional relationship, `MATCH FULL` requires either all components to be null or the complete key to match.

## Defer a check within a transaction

By default, a foreign key is `NOT DEFERRABLE` and is checked after each statement. A deferrable constraint can temporarily permit an intermediate state, provided the relationship is valid before the transaction commits.

For example, a self-referencing employee hierarchy may need two separate inserts even though the first employee names the second as manager:

```sql
CREATE TABLE employees (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  manager_id bigint,
  CONSTRAINT employees_manager_fk
    FOREIGN KEY (manager_id)
    REFERENCES employees (id)
    DEFERRABLE INITIALLY IMMEDIATE
);

BEGIN;
SET CONSTRAINTS employees_manager_fk DEFERRED;

INSERT INTO employees (id, name, manager_id)
VALUES (1, 'Ada', 2);

INSERT INTO employees (id, name, manager_id)
VALUES (2, 'Grace', NULL);

COMMIT;
```

At commit, manager `2` exists, so the relationship is valid. Without deferral, the first insert fails. Prefer immediate checks unless temporary inconsistency is necessary: a deferred violation fails the whole commit. Use `SET CONSTRAINTS ... IMMEDIATE` to check sooner.

## Support the relationship with an index

An **index** helps PostgreSQL find rows without scanning a whole table. The referenced key already has one to enforce uniqueness. PostgreSQL does **not** automatically index referencing columns, so finding dependent rows during a delete or key update can be expensive. An index can also help queries that join or filter on those columns.

For the first example, this is usually a useful supporting index:

```sql
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

The foreign key remains correct without this index. Add it when faster lookups justify its storage and write cost. The indexing lesson explains how to measure that tradeoff.

## Add a foreign key to existing data

This migration example assumes `customers` and `orders` exist, `customers.id` is a primary key, and `orders_customer_fk` has not been defined. Skip it if you already created that constraint above.

A normal `ALTER TABLE ... ADD CONSTRAINT` checks all existing rows. `NOT VALID` skips that initial scan while enforcing new references. Adding the constraint still takes locks that can block concurrent writes:

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_fk
  FOREIGN KEY (customer_id)
  REFERENCES customers (id)
  ON DELETE RESTRICT
  NOT VALID;
```

Find and repair existing orphaned rows, then validate the constraint separately:

```sql
SELECT o.id, o.customer_id
FROM orders AS o
LEFT JOIN customers AS c ON c.id = o.customer_id
WHERE o.customer_id IS NOT NULL
  AND c.id IS NULL;

ALTER TABLE orders
  VALIDATE CONSTRAINT orders_customer_fk;
```

The query finds non-null references with no matching customer. Validation proves that existing rows also satisfy the relationship; include it in the migration plan.

## Official resources

- [PostgreSQL: Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [PostgreSQL: CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)
- [PostgreSQL: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL: SET CONSTRAINTS](https://www.postgresql.org/docs/current/sql-set-constraints.html)

## Practice

Create two local tables without a relationship:

```sql
DROP TABLE IF EXISTS practice_articles;
DROP TABLE IF EXISTS practice_authors;

CREATE TABLE practice_authors (
  id bigint PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE practice_articles (
  id bigint PRIMARY KEY,
  author_id bigint NOT NULL,
  title text NOT NULL
);
```

Complete the relationship yourself:

1. Add a foreign key named `practice_articles_author_fk` from `practice_articles.author_id` to `practice_authors.id` with `ON DELETE RESTRICT`.
2. Add an index that supports lookups through the referencing column.
3. Insert author `1` and an article that refers to that author.
4. Try to insert an article for author `999`, then try to delete author `1`.
5. Use `\d practice_articles` to inspect both the constraint and supporting index.

You are done when both operations that would break the relationship are rejected while the valid rows remain. Drop the child table before the parent table when cleaning up.
