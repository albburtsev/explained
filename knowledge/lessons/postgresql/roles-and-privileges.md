---
slug: postgresql/roles-and-privileges
title: Roles and Privileges
description: Control PostgreSQL access with login roles, group roles, object privileges, and least-privilege grants.
tags:
  - postgresql
  - databases
  - security
  - access-control
---

A **role** is a PostgreSQL identity that can own objects, receive permissions, and belong to other roles. Roles serve two common purposes:

- A **login role** identifies a person or application that connects.
- A **group role** normally cannot log in. It collects permissions for a job, such as reading reports.

**Object privileges** allow specific operations, such as reading a table. Follow **least privilege**: give each login only the permissions its work needs, usually through group membership.

## Create roles for identities and capabilities

Creating roles requires a superuser or a role with `CREATEROLE`. For these examples, connect as the local superuser created by the course setup. Create one login role and two group roles:

```sql
CREATE ROLE app_ada LOGIN;
CREATE ROLE catalog_reader;
CREATE ROLE catalog_editor;
```

`CREATE ROLE` defaults to `NOLOGIN`, so the group roles cannot connect. `CREATE USER app_ada` is another spelling of `CREATE ROLE app_ada LOGIN`.

`LOGIN` makes a role eligible to start a session. The server's authentication configuration still decides whether a particular connection is accepted. The examples below use `SET ROLE` to test authorization without changing authentication settings.

Roles belong to a **cluster**, the databases managed by one PostgreSQL server instance. Creating `app_ada` makes it known across those databases but does not give it access to their tables. Object privileges apply to the particular objects named in a grant.

Inspect roles and their attributes in `psql`:

```text
\du
```

Avoid broad attributes such as `SUPERUSER`, `CREATEDB`, `CREATEROLE`, and `BYPASSRLS` for ordinary application logins. A superuser bypasses almost every permission check, so object-level grants cannot meaningfully restrict it.

## Grant permissions through membership

Grant group-role membership to the login role:

```sql
GRANT catalog_reader TO app_ada;
```

Roles inherit the ordinary privileges of roles they belong to by default. Membership can therefore replace repeated direct grants to every login. Removing the membership removes that access path:

```sql
REVOKE catalog_reader FROM app_ada;
```

Grant it again for the remaining examples:

```sql
GRANT catalog_reader TO app_ada;
```

`SET ROLE` changes the session's active role. As the local superuser, test the new login's permissions without opening another connection:

```sql
SET ROLE app_ada;

SELECT session_user, current_user;

RESET ROLE;
```

`session_user` remains the role that opened the connection; `current_user` becomes `app_ada` until `RESET ROLE`. Inherited privileges are normally available without switching roles. Switching also changes the owner of objects created afterward. Ordinary roles need membership with the `SET` option to switch to another role.

## Grant access to both the namespace and the object

Create an isolated schema and table as the original administrative role:

```sql
CREATE SCHEMA course_catalog;

CREATE TABLE course_catalog.books (
  isbn text PRIMARY KEY,
  title text NOT NULL,
  in_stock boolean NOT NULL DEFAULT true
);

INSERT INTO course_catalog.books (isbn, title)
VALUES ('978-0-00-000001-1', 'Reliable SQL');
```

`USAGE` on a schema allows a role to look up its objects. A table privilege such as `SELECT` allows an operation on that table. Grant both:

```sql
GRANT USAGE ON SCHEMA course_catalog TO catalog_reader;
GRANT SELECT ON course_catalog.books TO catalog_reader;
```

Test the result as the login role:

```sql
SET ROLE app_ada;

SELECT * FROM course_catalog.books;

UPDATE course_catalog.books
SET in_stock = false
WHERE isbn = '978-0-00-000001-1';
-- ERROR: permission denied for table books

RESET ROLE;
```

The read succeeds and the write fails because `catalog_reader` has only `SELECT`. Grant a separate bundle of editing privileges and add it only when the login needs that job:

```sql
GRANT USAGE ON SCHEMA course_catalog TO catalog_editor;
GRANT SELECT, INSERT, UPDATE, DELETE
ON course_catalog.books
TO catalog_editor;

GRANT catalog_editor TO app_ada;
```

Prefer explicit privilege names over `ALL PRIVILEGES` when the role should perform a known set of operations. A table grant does not cover the table's sequences. If inserts use an independently managed sequence, such as one created for a `serial` column, grant the matching sequence privilege as well.

Use `psql` to inspect schema and relation access controls:

```text
\dn+ course_catalog
\dp course_catalog.*
```

## Understand ownership and effective access

An object's creator normally owns it. An owner can alter or drop it and grant its privileges again after revocation. Keep ownership with controlled deployment roles, because revoking privileges cannot reliably restrict an owner.

A role's effective access is the combination of privileges granted:

- directly to the role;
- through every inherited role membership;
- to `PUBLIC`, the implicit group containing every role.

One `REVOKE` may leave access available through another path. Check all three when diagnosing permissions.

Only an object owner, a superuser, or a role holding the relevant grant option can normally pass an object privilege to another role. Avoid `WITH GRANT OPTION` unless the recipient is intentionally responsible for delegating that access.

## Set privileges for future objects

A grant on existing tables does not automatically cover tables created later. Configure default privileges when a role should receive the same access on future objects:

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA course_catalog
GRANT SELECT ON TABLES TO catalog_reader;
```

This affects only future tables created by the role running the command. Existing tables and other creators' defaults stay unchanged. An authorized administrator can use `FOR ROLE` to configure another creator's defaults. The following example assumes a role named `catalog_owner` already exists:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE catalog_owner
IN SCHEMA course_catalog
GRANT SELECT ON TABLES TO catalog_reader;
```

Include grants and default privileges in schema deployments so both existing and future objects have the intended access.

## Official resources

- [Database roles](https://www.postgresql.org/docs/current/database-roles.html)
- [Role attributes](https://www.postgresql.org/docs/current/role-attributes.html)
- [Role membership](https://www.postgresql.org/docs/current/role-membership.html)
- [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html)
- [`GRANT`](https://www.postgresql.org/docs/current/sql-grant.html)
- [`ALTER DEFAULT PRIVILEGES`](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)

## Practice

Run this exercise in `postgresql_course` as the local administrative role used to create the course database:

```sql
CREATE ROLE practice_reader;
CREATE ROLE practice_editor;
CREATE ROLE practice_ada LOGIN;

CREATE SCHEMA practice_access;

CREATE TABLE practice_access.notes (
  id integer PRIMARY KEY,
  body text NOT NULL
);

INSERT INTO practice_access.notes (id, body)
VALUES (1, 'Visible to readers');
```

Complete these tasks:

1. Give `practice_reader` the schema and table privileges required to read `practice_access.notes`.
2. Give `practice_editor` the privileges required to read, insert, update, and delete rows in that table, but do not grant schema `CREATE`.
3. Grant only `practice_reader` to `practice_ada`, then use `SET ROLE practice_ada` to confirm that `SELECT` succeeds and `UPDATE` fails.
4. Reset the role, grant `practice_editor` to `practice_ada`, switch back, and confirm that the update now succeeds.
5. As the original role, set default table privileges for `practice_reader`, create another table, and verify as `practice_ada` that the future table is readable without another ordinary `GRANT`.
6. Inspect the roles with `\du` and the access controls with `\dn+ practice_access` and `\dp practice_access.*`.

You are done when `practice_ada` can perform only the operations supplied by its current memberships. Reset the active role before cleanup, then remove the schema and roles:

```sql
RESET ROLE;
ALTER DEFAULT PRIVILEGES IN SCHEMA practice_access
REVOKE SELECT ON TABLES FROM practice_reader;
DROP SCHEMA practice_access CASCADE;
DROP ROLE practice_ada;
DROP ROLE practice_reader;
DROP ROLE practice_editor;
```
