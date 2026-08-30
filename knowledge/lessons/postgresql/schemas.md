---
slug: postgresql/schemas
title: Postgres Schemas
description: Organize PostgreSQL objects with schemas, qualified names, predictable search paths, and explicit namespace privileges.
tags:
  - postgresql
  - databases
  - schemas
  - security
---

A PostgreSQL **schema** is a namespace inside one database. It groups named objects such as tables, views, types, sequences, and functions. Schemas do not create separate databases or storage boundaries: one connection can access objects in any schema of its current database when its role has the required privileges.

Schemas are useful for separating application modules, third-party extensions, or objects with different owners. They also allow the same object name to exist more than once. A database can contain both `sales.events` and `audit.events` because the schema name makes each table's identity distinct. Schemas cannot be nested.

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

A qualified name never connects to another database. PostgreSQL connections access one database at a time; the qualifier only selects a schema inside that database.

## Understand `public`

Every new database normally contains a schema named `public`. When earlier lessons created `terminal_notes` without a schema qualifier, PostgreSQL placed it in the current schema, which is commonly `public` in a default local database.

These commands refer to the same table when `public` is the current schema:

```sql
SELECT * FROM terminal_notes;
SELECT * FROM public.terminal_notes;
```

There is no special storage behavior attached to `public`. It is a normal schema supplied as a convenient default. As a project grows, named application schemas make ownership and object boundaries clearer than putting everything in one namespace.

## Resolve unqualified names with `search_path`

When a statement uses an unqualified name such as `events`, PostgreSQL searches schemas in the order defined by `search_path` and uses the first matching object. Inspect the configured and effective paths:

```sql
SHOW search_path;

SELECT
  current_schema(),
  current_schemas(true);
```

The default setting is commonly `"$user", public`. The `$user` entry means a schema with the session user's name; PostgreSQL ignores that entry when no such schema exists. `current_schema()` reports the first existing schema in the path. Passing `true` to `current_schemas` also shows implicitly searched system schemas.

Change the path for the current session:

```sql
SET search_path TO course_app, course_audit, public;

SELECT * FROM events;
-- Returns the row from course_app.events.
```

`course_app.events` wins because `course_app` appears before `course_audit`. The first existing schema in the path is also the destination for an unqualified `CREATE` command:

```sql
CREATE TABLE settings (
  name text PRIMARY KEY,
  value text NOT NULL
);

SELECT current_schema();
-- course_app
```

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

An unqualified name is concise, but its meaning depends on session state. Use explicit schema qualification in migrations, administrative scripts, and security-sensitive code when selecting the wrong object would be dangerous. If an application relies on `search_path`, set a deliberate path for its database role or connection and test it instead of assuming the server default.

A writable schema in `search_path` is also a trust boundary. A role with `CREATE` on that schema can add an object whose name shadows one expected by another query. Do not include schemas writable by untrusted roles in a privileged session's path.

Schema permissions and object permissions solve different parts of access control:

- `USAGE` on a schema allows a role to look up objects in that namespace.
- `CREATE` on a schema allows a role to create new objects there.
- Privileges such as `SELECT` or `UPDATE` on a table are still required separately.

For example, assuming a role named `app_reader` already exists, read access requires both namespace and table grants:

```sql
GRANT USAGE ON SCHEMA course_app TO app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA course_app TO app_reader;
REVOKE CREATE ON SCHEMA course_app FROM app_reader;
```

Use `\dn+ course_app` in `psql` to inspect schema ownership and access privileges. Schema ownership does not imply that the same role owns every object inside it, so review both levels when diagnosing permission errors.

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
-- ERROR: the schema is not empty
```

`DROP SCHEMA course_app CASCADE` removes contained objects and can also remove dependent objects outside that schema. Inspect the target and dependencies before using `CASCADE`; it is appropriate for disposable local examples but should never be a reflexive production cleanup command.

## Apply the design rules

- Use schemas as logical namespaces inside one database, not as substitutes for separate databases.
- Qualify object names when identity must not depend on session configuration.
- Keep `search_path` short, explicit, and free of schemas writable by untrusted roles.
- Remember that the first existing path entry resolves unqualified creation targets.
- Grant schema `USAGE` and object privileges separately; grant schema `CREATE` only to roles that should define objects.
- Treat moving or dropping a schema as an identity and dependency change, not just folder maintenance.

## Official resources

- [Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [`CREATE SCHEMA`](https://www.postgresql.org/docs/current/sql-createschema.html)
- [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html)
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
