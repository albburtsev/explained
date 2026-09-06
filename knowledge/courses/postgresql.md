---
slug: postgresql
title: PostgreSQL Data Integrity, Performance, and Concurrency
catalogOrder: 60
description: Use PostgreSQL to control access, protect relationships, tune queries, coordinate concurrent work, and store flexible JSONB data.
tags:
  - postgresql
  - databases
  - sql
lessons:
  - postgresql/psql
  - postgresql/schemas
  - postgresql/roles-and-privileges
  - postgresql/transactions-and-isolation-levels
  - postgresql/foreign-keys
  - postgresql/explain-and-query-planning
  - postgresql/indexes
  - postgresql/mvcc-and-vacuum
  - postgresql/row-and-table-locks
  - postgresql/advisory-locks
  - postgresql/jsonb
---

Learn to keep PostgreSQL data correct and queries efficient while multiple sessions work at the same time. Start with the `psql` terminal client, schemas, and access control. Then use transactions and foreign keys, measure query plans, and design indexes. The final lessons explain row versions, vacuum, locks, and JSONB.

Each lesson includes SQL examples and a local exercise to explore the feature's guarantees and costs.

## Install and run PostgreSQL on macOS

Required tool: [Homebrew](https://brew.sh/).

Install [PostgreSQL 18](https://formulae.brew.sh/formula/postgresql%4018):

```sh
brew install postgresql@18
```

Homebrew does not put this version's commands on your shell's search path automatically. Add them to your zsh configuration:

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
