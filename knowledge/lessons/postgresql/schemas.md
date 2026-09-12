---
slug: postgresql/schemas
title: Postgres Schemas
description: Organize PostgreSQL objects with schemas, qualified names, and predictable search paths.
tags:
  - postgresql
  - databases
  - schemas
  - security
---

A PostgreSQL **schema** is a namespace: a group of named objects inside one database. It can contain tables, views, types, sequences, and functions. One connection can access any schema in its database if its role has permission. Schemas do not separate storage and cannot be nested.

Use schemas to separate application modules, extensions, or objects with different owners. They also allow names to repeat: `sales.events` and `audit.events` are different tables in the same database.

## Create and inspect schemas

Create two namespaces in `postgresql_course`:

```sql
CREATE SCHEMA course_app;
CREATE SCHEMA course_audit;
```

The role that runs `CREATE SCHEMA` owns the new schema unless an `AUTHORIZATION` clause names another role. Create one table in each schema by using a **qualified name** in the form `schema.object`:

```sql
CREATE TABLE course_app.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message text NOT NULL
);

CREATE TABLE course_audit.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message text NOT NULL
);

INSERT INTO course_app.events (message)
VALUES ('application event');

INSERT INTO course_audit.events (message)
VALUES ('audit event');
```

The two tables are independent even though they share the name `events`. Inspect the namespaces and their tables with the `psql` commands from the previous lesson:

```text
\dn
\dt course_app.*
\dt course_audit.*
```

Use qualified names when the target must be unambiguous:

```sql
SELECT * FROM course_app.events;
SELECT * FROM course_audit.events;
```

A name such as `course_app.events` selects a schema and table within the current database. It does not connect to another database.

## Understand `public`

New databases normally contain a schema named `public`. The previous lesson created `terminal_notes` without a schema qualifier, so PostgreSQL placed it in the current schema, usually `public` in the local setup.

With the course setup's default search path, these commands refer to the same table:

```sql
SELECT * FROM terminal_notes;
SELECT * FROM public.terminal_notes;
```

`public` is a normal schema provided as a default. Named application schemas can make ownership and organization clearer as a project grows.

## Resolve unqualified names with `search_path`

When a statement uses an unqualified name such as `events`, PostgreSQL searches schemas in the order defined by `search_path` and uses the first matching object. Inspect the configured and effective paths:

```sql
SHOW search_path;

SELECT
  current_schema(),
  current_schemas(true);
```

The default is `"$user", public`. `$user` means a schema named after `current_user`, the active database role. PostgreSQL ignores schemas that do not exist or that the role lacks `USAGE` permission to access. `current_schema()` reports the first usable schema in the configured path. `current_schemas(true)` also includes implicitly searched system schemas.

Change the path for the current session:

```sql
SET search_path TO course_app, course_audit, public;

SELECT * FROM events;
-- Returns the row from course_app.events.
```

PostgreSQL finds `course_app.events` first. The first usable schema in the path is also the destination for an unqualified `CREATE TABLE`:

```sql
CREATE TABLE settings (
  name text PRIMARY KEY,
  value text NOT NULL
);

SELECT current_schema();
-- course_app
```

The role also needs `CREATE` permission in that schema. Without it, creation fails; PostgreSQL does not try the next schema.

Reverse the first two entries and the same unqualified table name resolves differently:

```sql
SET search_path TO course_audit, course_app, public;

SELECT * FROM events;
-- Returns the row from course_audit.events.
```

Restore the configured session default when the experiment is finished:

```sql
RESET search_path;
```

The system catalog schema `pg_catalog` is always searched. When it is not listed explicitly, PostgreSQL searches it before the explicit path entries so built-in types and functions remain available.

## Prefer predictable object resolution

An unqualified name depends on session settings. Qualify names in schema migrations, administrative scripts, and code where selecting the wrong object would be dangerous. If an application relies on `search_path`, set and test it explicitly.

A role with `CREATE` permission on a schema can add an object whose name another query expects to find in a different schema. If that schema comes first in the path, the query silently uses the wrong object. Keep schemas that untrusted roles can write out of a privileged session's path.

## Move and remove objects deliberately

An existing object can move to another schema without recreating its data:

```sql
ALTER TABLE course_app.settings
SET SCHEMA course_audit;
```

The table's qualified name is now `course_audit.settings`. Update application references and deployment scripts together when moving or renaming a published object.

`DROP SCHEMA` uses `RESTRICT` behavior by default and refuses to remove a nonempty schema:

```sql
DROP SCHEMA course_app;
-- ERROR: cannot drop schema course_app because other objects depend on it
```

`DROP SCHEMA course_app CASCADE` removes its objects and can remove dependent objects in other schemas. Inspect both before using it, especially outside a disposable local database.

## Official resources

- [Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [`search_path` settings](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-SEARCH-PATH)
- [`CREATE SCHEMA`](https://www.postgresql.org/docs/current/sql-createschema.html)
- [`ALTER TABLE`](https://www.postgresql.org/docs/current/sql-altertable.html)
- [`DROP SCHEMA`](https://www.postgresql.org/docs/current/sql-dropschema.html)

## Practice

Create two disposable schemas containing tables with the same name:

```sql
DROP SCHEMA IF EXISTS practice_store CASCADE;
DROP SCHEMA IF EXISTS practice_audit CASCADE;

CREATE SCHEMA practice_store;
CREATE SCHEMA practice_audit;

CREATE TABLE practice_store.events (
  source text NOT NULL
);

CREATE TABLE practice_audit.events (
  source text NOT NULL
);

INSERT INTO practice_store.events VALUES ('store');
INSERT INTO practice_audit.events VALUES ('audit');
```

Complete these tasks in `psql`:

1. List both schemas and list the tables inside each one.
2. Set `search_path` to `practice_store, practice_audit, public`, then query `events` without a qualifier and inspect `current_schema()`.
3. Reverse the first two path entries and repeat the unqualified query.
4. While `practice_audit` is first, create an unqualified table named `settings` and determine which schema contains it.
5. Reset the path and query both `events` tables with qualified names.
6. Try to drop `practice_store` without `CASCADE` and explain the error.

You are done when the unqualified query returns `store` or `audit` according to path order and `settings` appears in `practice_audit`. Remove both practice schemas with `DROP SCHEMA ... CASCADE` after inspecting their contents.
