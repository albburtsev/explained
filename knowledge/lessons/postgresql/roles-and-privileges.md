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

PostgreSQL uses **roles** for both people and groups of permissions. A role can own database objects, receive privileges, and belong to other roles. A role with the `LOGIN` attribute can also start a database session and is what PostgreSQL commonly calls a user.

Keeping identity and permissions separate makes access easier to reason about:

- A **login role** identifies a person or application that connects.
- A **group role** normally has no `LOGIN` attribute and collects privileges for a job such as reading reports or editing catalog data.
- **Object privileges** allow specific operations on databases, schemas, tables, sequences, and other objects.

The goal is least privilege: give each login only the capabilities it needs, preferably through membership in a small number of group roles.

## Create roles for identities and capabilities

Role-management commands require a superuser or an appropriately authorized role with `CREATEROLE`. In the local course database, create one login role and two group roles:

```sql
CREATE ROLE app_ada LOGIN;
CREATE ROLE catalog_reader;
CREATE ROLE catalog_editor;
```

`CREATE ROLE` defaults to `NOLOGIN`, so `catalog_reader` and `catalog_editor` are useful as permission bundles but cannot initiate a connection. `CREATE USER app_ada` would be an alternative spelling of `CREATE ROLE app_ada LOGIN`.

`LOGIN` makes a role eligible to start a session; the server's authentication configuration still determines whether a particular connection is accepted. The examples below use `SET ROLE` to test authorization without changing authentication settings.

Roles belong to the PostgreSQL cluster, not to one database. Object privileges, however, apply to objects inside a particular database. Creating `app_ada` therefore makes the role known across the cluster but does not automatically give it access to every table.

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

`SET ROLE` changes the active role for the current session. An administrator can use it to test the effective permissions of the new login without opening another connection:

```sql
SET ROLE app_ada;

SELECT session_user, current_user;

RESET ROLE;
```

`session_user` remains the role that opened the connection, while `current_user` becomes `app_ada` until `RESET ROLE`. Membership and `SET ROLE` are related but not identical: inherited privileges are normally available immediately, while explicitly switching roles also changes which role owns newly created objects.

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

Schema and table privileges protect different operations. `USAGE` on a schema permits a role to resolve objects inside that namespace. A table privilege such as `SELECT` or `UPDATE` permits the corresponding operation on the table. A role needs both gates to pass:

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

Prefer explicit privilege names over `ALL PRIVILEGES` when the role should perform a known set of operations. If inserts use an independently managed sequence, such as one created for a `serial` column, the role also needs the relevant sequence privilege; a table grant does not automatically grant access to its sequences.

Use `psql` to inspect schema and relation access controls:

```text
\dn+ course_catalog
\dp course_catalog.*
```

## Understand ownership and effective access

The role that creates an object normally owns it. An owner can alter or drop the object and is always treated as able to grant its privileges. Ownership is therefore stronger than an ordinary `GRANT`; revoking table privileges from the owner does not create a durable security boundary.

A role's effective access is the combination of privileges granted:

- directly to the role;
- through every inherited role membership;
- to `PUBLIC`, the implicit group containing every role.

This means one `REVOKE` might not remove access if another path still supplies it. Inspect memberships and object access controls before concluding that a role has lost a capability.

Only an object owner, a superuser, or a role holding the relevant grant option can normally pass an object privilege to another role. Avoid `WITH GRANT OPTION` unless the recipient is intentionally responsible for delegating that access.

## Set privileges for future objects

A grant on existing tables does not automatically cover tables created later. Configure default privileges when a role should receive the same access on future objects:

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA course_catalog
GRANT SELECT ON TABLES TO catalog_reader;
```

This changes the defaults only for objects created later by the role that runs the command. It does not modify existing tables and does not affect tables created by another owner. If several deployment roles create objects, configure defaults for each relevant creator with `FOR ROLE`, executed by an authorized administrator. For example, assuming `catalog_owner` already exists:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE catalog_owner
IN SCHEMA course_catalog
GRANT SELECT ON TABLES TO catalog_reader;
```

Use ordinary `GRANT` for existing objects and `ALTER DEFAULT PRIVILEGES` for future ones. Treat both as part of the deployment that creates or changes the schema so a new object does not accidentally appear with the wrong access.

## Apply the access-control rules

- Use login roles for identities and non-login roles for reusable permission bundles.
- Grant membership instead of duplicating object grants across many logins.
- Give roles only the attributes and object privileges their work requires.
- Remember that using a table in a schema requires the appropriate privileges on both objects.
- Check direct grants, inherited memberships, and `PUBLIC` when diagnosing effective access.
- Configure existing-object grants and future-object defaults separately.
- Keep object ownership in controlled deployment or owner roles rather than ordinary application logins.

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
