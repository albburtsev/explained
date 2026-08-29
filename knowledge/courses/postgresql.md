---
slug: postgresql
title: PostgreSQL Data Integrity, Performance, and Concurrency
catalogOrder: 60
description: Learn how PostgreSQL enforces relationships, plans queries, uses indexes and MVCC, coordinates concurrent work, and stores JSONB data.
tags:
  - postgresql
  - databases
  - sql
lessons:
  - postgresql/psql
  - postgresql/transactions-and-isolation-levels
  - postgresql/foreign-keys
  - postgresql/explain-and-query-planning
  - postgresql/indexes
  - postgresql/mvcc-and-vacuum
  - postgresql/row-and-table-locks
  - postgresql/advisory-locks
  - postgresql/jsonb
---

PostgreSQL provides several complementary tools for keeping data correct while applications read and modify it concurrently. Transactions define units of work, constraints protect relationships, query plans and indexes shape performance, and MVCC controls which row versions each statement can see. Explicit locks coordinate competing operations, while JSONB supports data whose structure does not fit a fixed set of columns.

This course introduces those tools through focused examples and practical decision rules. You will learn what each feature guarantees, what it costs, and when to use it without weakening correctness or creating avoidable contention.

## Install and run PostgreSQL on macOS

Required tool: [Homebrew](https://brew.sh/).

Install [PostgreSQL 18](https://formulae.brew.sh/formula/postgresql%4018):

```sh
brew install postgresql@18
```

The versioned formula is keg-only, so add its command-line tools to your zsh path:

```sh
echo 'export PATH="$(brew --prefix postgresql@18)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Start PostgreSQL now and automatically when you log in:

```sh
brew services start postgresql@18
pg_isready
```

Create a database for the course and open it with `psql`:

```sh
createdb postgresql_course
psql postgresql_course
```

At the `psql` prompt, confirm the connection and then exit:

```text
\conninfo
\q
```

To stop PostgreSQL and remove it from your login services later, run:

```sh
brew services stop postgresql@18
```
