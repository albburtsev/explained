---
slug: temporal
title: Temporal
catalogOrder: 40
description: Learn to build reliable, long-running TypeScript applications with Temporal workflows, activities, workers, messages, tests, and schedules.
tags:
  - temporal
  - typescript
  - durable-execution
lessons:
  - temporal/why-temporal
  - temporal/your-first-temporal-application
  - temporal/durable-workflows
  - temporal/reliable-activities
  - temporal/workers-and-task-queues
  - temporal/workflow-messages
  - temporal/testing-temporal-applications
  - temporal/schedules
---

`Temporal` is a durable execution platform for application logic that must survive process crashes, network failures, and long waits. Instead of scattering retries, saved progress, and recovery code across services, you express the business process as a Workflow and let Temporal preserve its execution state.

This course builds one TypeScript application that prepares and delivers an executive BI report. You will begin with a complete local execution, then make the report pipeline durable, observable, interactive, testable, and scheduled.

## Set up Temporal on macOS

The Temporal TypeScript SDK supports Node.js 20, 22, and 24. Check that your current Node.js version is supported:

```sh
node --version
```

Install Temporal CLI with Homebrew and verify the installation:

```sh
brew install temporal
temporal --version
```

Start the local development service in a terminal and leave it running while you work through the course:

```sh
temporal server start-dev
```

The service listens on `localhost:7233`, and its Web UI is available at [http://localhost:8233](http://localhost:8233).

In another terminal, create the TypeScript project used throughout the lessons:

```sh
npx @temporalio/create@latest temporal-bi-report --sample hello-world
cd temporal-bi-report
npm install
```

The generated project includes the Temporal TypeScript SDK packages and a small end-to-end application that you will reshape into the executive-report pipeline.

## Official resources

- [Temporal documentation](https://docs.temporal.io/)
- [Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript)
- [TypeScript SDK API reference](https://typescript.temporal.io/)
- [TypeScript samples](https://github.com/temporalio/samples-typescript)

## What you will learn

- When durable execution is a better fit than a cron job, task queue, data orchestrator, or managed state machine.
- How Workflows, Activities, Workers, Task Queues, Clients, and the Temporal Service cooperate.
- How Event History and deterministic replay preserve Workflow state.
- How retries, timeouts, heartbeats, and idempotency make external work reliable.
- How to inspect and change a running Workflow with Queries, Signals, and Updates.
- How to test time-dependent behavior and start report Workflows on a schedule.
