---
slug: postgresql/psql
title: Using PostgreSQL from the Terminal
description: Connect with psql, run SQL, inspect tables, and use built-in help from the macOS terminal.
tags:
  - postgresql
  - sql
  - psql
  - terminal
---

`psql` is PostgreSQL's terminal client. It sends SQL statements to the server and displays the results. **SQL** is the language used to query and change database data. `psql` also has its own commands for inspecting objects and controlling the session.

Complete the macOS setup in the course overview before starting. It installs the client, starts the local server, and creates the `postgresql_course` database.

## Connect from the shell

Open Terminal and connect to the course database:

```sh
psql -d postgresql_course
```

For a local connection, `psql` can use a Unix-domain socket, a local communication channel, and your macOS user name as the database role. A **role** is the identity PostgreSQL uses to control access. The `-d` option selects the database.

For a remote server, replace these example values with its connection details:

```sh
psql -h db.example.com -p 5432 -U app_user -d app_database
```

The options identify the server host, port, database role, and database. PostgreSQL commonly listens on port `5432`, but the server may use another port. If authentication requires a password, let `psql` prompt for it; do not put a password directly in a shell command where it can remain in command history.

After a successful connection, the prompt includes the current database:

```text
postgresql_course=>
```

With the default prompt, `=>` indicates an ordinary role and `=#` indicates a superuser. A superuser bypasses most access controls. The local setup normally creates a superuser; use ordinary roles for application connections.

Confirm where the session is connected:

```text
\conninfo
```

You can also ask the server for the current context with SQL:

```sql
SELECT
  current_database() AS database,
  current_user AS role,
  current_schema() AS schema;
```

## Distinguish SQL from psql commands

At the `psql` prompt, you can enter two kinds of input:

- **SQL statements** are sent to PostgreSQL and normally end with a semicolon.
- **psql meta-commands** begin with a backslash, are handled by the client, and do not end with a semicolon.

SQL may span several lines. Until the terminating semicolon arrives, the prompt changes to a continuation form such as `postgresql_course->`. If you start the wrong statement, clear the pending query buffer instead of completing it:

```text
\r
```

## Navigate databases and schemas

List databases available on the server:

```text
\l
```

Switch to another database without leaving `psql`, then return to the course database:

```text
\c postgres
\c postgresql_course
```

Each `\c` creates a new connection. Run `\conninfo` afterward when there is any doubt about the active database or role.

Schemas group named objects inside a database. List its schemas and the tables visible through the session's schema search path:

```text
\dn
\dt
```

An empty database may report that it did not find any relations. A **table** stores records as rows with named columns. Create one and insert a row:

```sql
CREATE TABLE terminal_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO terminal_notes (body)
VALUES ('psql is connected')
RETURNING id, body, created_at;
```

`id` is generated automatically and identifies each row. `body` must contain a value, and `now()` supplies a timestamp for `created_at`. `RETURNING` displays the inserted row.

Now list the table and inspect its definition:

```text
\dt
\d terminal_notes
\d+ terminal_notes
```

The `+` variant asks for additional details. Most object-listing commands also accept a name pattern, so `\dt terminal*` narrows the list.

## Control results and find help

Wide rows can be easier to read vertically. Let `psql` choose expanded output automatically, and show the duration of each SQL statement:

```text
\x auto
\timing on
```

Both settings last for the current `psql` session. Turn timing off with `\timing off` and return to ordinary table output with `\x off`.

Use the built-in help instead of leaving the terminal:

```text
\?
\h
\h CREATE TABLE
```

`\?` explains psql meta-commands. `\h` lists SQL commands for which syntax help is available, while `\h CREATE TABLE` shows help for one SQL command.

## Run one command or a SQL file

For a quick terminal check, use `-c`. `psql` executes the complete SQL string and exits:

```sh
psql -d postgresql_course -c 'SELECT current_database(), current_user;'
```

To run a file, save SQL statements in `lesson.sql` in your current shell directory. Use `-f` to execute it and report errors with line numbers:

```sh
psql -d postgresql_course --set=ON_ERROR_STOP=on -f lesson.sql
```

`ON_ERROR_STOP` stops file processing after an error. From an interactive session, enable the same behavior before reading the file:

```text
\set ON_ERROR_STOP on
\i lesson.sql
```

This setting does not undo statements that have already succeeded. Transactions, covered later, let you group changes that must succeed or fail together.

## End the session

Exit the client with:

```text
\q
```

This closes the client connection and returns to the macOS shell. It does not stop the PostgreSQL server; the Homebrew service continues running for later lessons.

## Official resources

- [psql reference](https://www.postgresql.org/docs/current/app-psql.html)
- [PostgreSQL tutorial: Accessing a Database](https://www.postgresql.org/docs/current/tutorial-accessdb.html)
- [Database connection parameters](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-PARAMKEYWORDS)

## Practice

Connect to the local course database and confirm the active database and role with `\conninfo`. Turn on timing, then create and populate a small table:

```sql
DROP TABLE IF EXISTS practice_terminal_notes;

CREATE TABLE practice_terminal_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  body text NOT NULL
);

INSERT INTO practice_terminal_notes (body)
VALUES ('connect'), ('inspect'), ('query');
```

Complete these tasks without leaving `psql`:

1. List only tables whose names begin with `practice_`.
2. Display the columns, defaults, indexes, and constraints of `practice_terminal_notes`.
3. Use built-in help to open the syntax reference for `INSERT`.
4. Enable automatic expanded output and select every row from the table.
5. Exit with `\q`, then use `psql -d postgresql_course -c` from the macOS shell to return the row count.

You are done when the shell command reports `3`. Reconnect and remove the table with `DROP TABLE practice_terminal_notes;` so the exercise can be repeated.
