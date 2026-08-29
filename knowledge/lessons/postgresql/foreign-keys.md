---
slug: postgresql/foreign-keys
title: Foreign Keys
description: Enforce relationships between PostgreSQL tables, choose safe referential actions, and evolve constraints without admitting inconsistent data.
tags:
  - postgresql
  - databases
  - data-integrity
  - foreign-keys
---

An application can check that a customer exists before it creates an order, but another transaction could delete that customer between the check and the insert. Other clients might skip the check entirely. A `foreign key` puts the rule in PostgreSQL, where it applies to every writer and remains correct under concurrent changes.

A foreign key requires each non-null value in the **referencing table** to match a key in the **referenced table**. The database rejects inserts, updates, or deletions that would leave a dangling reference.

## Define a relationship

Create the referenced table first. Its target columns must be backed by a primary key, a unique constraint, or a suitable non-partial unique index:

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

Use cascades to express ownership, not merely convenience. Deleting an order can reasonably delete its line items, while deleting a customer probably should not erase financial orders. A cascade can affect many rows, so its business meaning should be deliberate.

`ON UPDATE` accepts the same actions and controls changes to the referenced key. Stable surrogate keys rarely need to change; when a referenced natural key can change, `ON UPDATE CASCADE` can propagate the new value.

## Model multi-column relationships

A relationship may be identified by a combination of columns. In a multi-tenant schema, include the tenant in both sides so a row cannot accidentally reference another tenant's data:

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

The column count, order, and types on both sides must correspond. With the default `MATCH SIMPLE`, any null in a composite referencing key exempts that row from matching. Declare every component `NOT NULL` when partial references are invalid. If the entire relationship may be absent but a half-filled key must fail, use `MATCH FULL`; then either every component is null or the complete key must match.

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

At commit, manager `2` exists and the final state is valid. Without deferral, the first insert would fail. Keep immediate checking as the default unless a transaction genuinely needs temporary inconsistency: earlier errors are easier to diagnose, and a deferred violation makes the whole commit fail. `SET CONSTRAINTS ... IMMEDIATE` can force an early check before more work is done.

## Support the relationship with an index

The referenced key already has an index because PostgreSQL requires it to be unique. PostgreSQL does **not** automatically index the referencing columns. That omission can make deleting or updating a referenced row expensive because PostgreSQL must find matching rows in the referencing table. It can also slow common joins and filters.

For the first example, this is usually a useful supporting index:

```sql
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

An index is not part of the foreign key's correctness guarantee, and every index adds write and storage cost. Treat the relationship and its index as separate design decisions; the later indexing lesson shows how to validate the performance choice.

## Add a foreign key to existing data

This is an alternative to declaring `orders_customer_fk` inside `CREATE TABLE`, not a continuation of the first example. Assume `customers` and `orders` already exist, `customers.id` is a primary key, and `orders` does not yet have this foreign key. Do not run both constraint definitions against the same schema.

A normal `ALTER TABLE ... ADD CONSTRAINT` checks all existing rows immediately. On a large active table, use `NOT VALID` to begin enforcing the rule for new inserts and updates without performing the initial full scan:

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
WHERE c.id IS NULL;

ALTER TABLE orders
    VALIDATE CONSTRAINT orders_customer_fk;
```

`NOT VALID` is a migration state, not permission to keep bad data forever. Validation is what proves the complete table satisfies the relationship.

## Review the design

For each foreign key, answer these questions before shipping it:

- Must the relationship exist? If yes, add `NOT NULL` to every referencing column.
- Does the referenced key express stable identity and enforce uniqueness?
- Should deleting the referenced row be blocked, cascade to owned components, or preserve the dependent row with a cleared reference?
- Does a composite key prevent cross-tenant or cross-scope references?
- Will deletes, updates, joins, or filters need an index on the referencing columns?
- If the constraint is added to existing data, when will `VALIDATE CONSTRAINT` run?

The essential rule is simple: encode relationships that must always hold as database constraints, then make nullability, referential actions, and migration state explicit.

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
