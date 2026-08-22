---
slug: temporal/why-temporal
title: Why Temporal?
description: Learn when durable execution fits an application and how Temporal differs from simpler orchestration tools.
tags:
  - temporal
  - durable-execution
  - orchestration
---

A process that runs in memory has an implicit failure policy: if the process disappears, so does everything it knew. For a single request, restarting from the beginning may be acceptable. For a process that spans several services, retries, timers, or human decisions, recovery becomes application logic of its own.

Imagine an executive-report process that must fetch metrics, render a report, wait for an analyst's approval, and deliver the result every morning. A crash after approval must not lose that approval or send the report twice. A conventional implementation often grows a state table, a queue, retry counters, timers, leases, and reconciliation jobs. Each piece is manageable; keeping the whole process consistent is the hard part.

## Think in durable executions

`Durable execution` means that the progress of a function is preserved outside the process running its code. In Temporal, that function is a `Workflow`. The Temporal Service records the Workflow's history, while your Worker executes its code. If the Worker stops, another compatible Worker can reconstruct the Workflow's state from that history and continue making progress.

This changes the boundary of application code. The business sequence can remain ordinary control flow—conditions, loops, waits, and error handling—while Temporal supplies durable state, timers, task dispatch, and recovery. A Workflow can wait without occupying a thread or keeping one Worker alive.

Temporal does not make every operation exactly once. Calls to databases, APIs, file systems, and other external systems run as `Activities`. An Activity may be retried after a failure whose outcome is unknown, so side effects still need suitable idempotency or deduplication. Temporal makes the orchestration durable; it does not repeal distributed-systems failure modes.

## Recognize a good fit

Temporal becomes useful when a business process has several of these properties:

- It has a meaningful identity and must retain progress across crashes or deployments.
- It coordinates multiple failure-prone operations in a particular order.
- It can run for seconds, days, or longer, including durable timers or human waits.
- It must react to external messages while it is running.
- Operators need to inspect an execution and understand what happened.
- Implementing retries, saved state, and recovery by hand would obscure the business logic.

The report process fits because it combines external calls, a long human wait, scheduled starts, and a requirement not to lose progress. Temporal gives that entire process one durable execution instead of making the application reconstruct it from several infrastructure components.

## Compare solution categories

Temporal overlaps with several familiar tools, but the useful question is not which tool has the longest feature list. Choose the abstraction that matches the process.

| Category | Prefer it when | Consider Temporal when |
| --- | --- | --- |
| Cron | A periodic command is short, stateless, and safe to rerun from the beginning. | Each scheduled run is a stateful, multi-step process that needs recovery, control, or visibility. |
| Task queue | Jobs are mostly independent units of background work. | Jobs are steps in a larger process with ordering, waits, compensation, or shared state. |
| DAG or data orchestrator | The central problem is batch or data-pipeline dependencies, lineage, backfills, and a data-focused ecosystem. | The central problem is application behavior with dynamic branches, events, user interaction, or long-lived state. |
| Managed state machine | A finite set of explicit states and provider integrations expresses the process clearly. | General-purpose code makes evolving orchestration easier to read, test, and reuse than a growing transition graph. |

These categories can coexist. A data orchestrator can start a Temporal Workflow, or a Temporal Activity can enqueue independent work elsewhere. Temporal is an application orchestration platform, not a mandatory replacement for every scheduler, queue, or data tool.

## Know when it is excessive

Do not adopt Temporal merely because code might fail. A local function, one database transaction, or one idempotent background job usually has a simpler recovery boundary. A queue plus a worker may be enough when jobs do not share durable process state. A dedicated data orchestrator may remain the better interface when dataset lineage and backfills are the primary concern.

Temporal also introduces real costs: a Service to use or operate, Workers to deploy, an SDK programming model, operational conventions, and compatibility constraints for Workflow code that may be replayed. The benefit should outweigh that platform and learning overhead.

A practical decision test is this: if a process failure would force you to reconstruct business progress from logs, database rows, and queue messages, durable execution is worth evaluating. If restarting the whole operation is safe, cheap, and obvious, use the simpler tool.

## Official resources

- [Temporal documentation](https://docs.temporal.io/)
- [Workflow Execution and replay](https://docs.temporal.io/workflow-execution)
- [Workflow definitions and deterministic constraints](https://docs.temporal.io/workflow-definition)
- [Activities and external operations](https://docs.temporal.io/activities)

The next lesson turns this mental model into a running TypeScript application and identifies how the Temporal Service, Client, Worker, Workflow, Activity, and Task Queue cooperate.
