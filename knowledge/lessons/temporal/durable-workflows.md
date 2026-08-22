---
slug: temporal/durable-workflows
title: Durable Workflows
description: Understand how Temporal replays deterministic TypeScript Workflow code to preserve progress across Worker restarts.
tags:
  - temporal
  - typescript
  - durable-execution
---

The report application from the previous lesson looks like an ordinary chain of function calls, but its Workflow does not rely on one Node.js process staying alive. Temporal can reconstruct that Workflow's state on another Worker because the durable state is recorded by the Temporal Service.

This lesson makes that mechanism visible by adding a short durable wait, stopping the Worker, and then allowing the same execution to finish after the Worker restarts.

## Separate a definition from an execution

A `Workflow Definition` is the TypeScript function that describes the report process:

```ts
export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  // Durable orchestration belongs here.
}
```

Starting that function creates a `Workflow Execution`: one durable instance with its own input, state, and Event History. The function name `executiveReportWorkflow` is the Workflow Type. It can create many executions, just as one class or function can create many runtime instances.

Each execution has two useful identifiers:

- `Workflow ID` is the application-facing identity supplied by the Client. In the report project it begins with the report date and can be used to find or address the execution.
- `Run ID` is a server-assigned identifier for one run. A chain created by operations such as Continue-As-New can retain its Workflow ID while receiving a new Run ID.

For this lesson, think of the Workflow ID as the durable business identity and the Run ID as the identity of the current run. Within a Namespace, the pair identifies the exact run you see in Temporal Web UI.

## Follow Commands into Event History

Workflow code changes durable state through SDK operations. When the Worker reaches one of these operations, it produces a `Command` for the Temporal Service. The Service acts on the Command and appends resulting `Events` to that execution's `Event History`.

For example:

```text
Workflow code                       Command                Recorded Events
await sleep('20 seconds')       ->  StartTimer         ->  TimerStarted, TimerFired
await deliverExecutiveReport()  ->  ScheduleActivity   ->  Activity task events
return result                   ->  CompleteWorkflow   ->  WorkflowExecutionCompleted
```

Local calculations, assignments, and branches do not each create an Event. The history records the durable boundaries and their outcomes rather than snapshots of every JavaScript variable.

When a Worker no longer has the execution in memory, it receives the history and runs the Workflow Definition again from the beginning. During this `replay`, the SDK compares the Commands produced by the code with the recorded Events. Recorded results resolve the corresponding awaits, rebuilding local variables and control flow. Once replay reaches the end of the known history, the Worker can issue new Commands and continue the execution.

Replay is why a process restart does not mean starting the business process again. It is also why Workflow code has a stricter contract than ordinary application code.

## Keep Workflow code deterministic

A Workflow Definition must produce the same sequence of Commands when replayed with the same history. Normal TypeScript control flow is suitable, but a branch based on an unrecorded network response, process environment, or genuinely random value could produce a different next Command and cause a nondeterminism error.

The TypeScript SDK runs Workflow code in a sandbox and provides replay-safe behavior for several familiar APIs:

- `Date.now()` and `new Date()` return deterministic Workflow time, based on the current Workflow Task. Time advances across awaited Temporal operations.
- `Math.random()` uses a deterministic random source and produces the same sequence during replay.
- `setTimeout()` and `clearTimeout()` are replaced with deterministic versions, although the SDK recommends `sleep()` because it integrates better with cancellation.
- `uuid4()` from `@temporalio/workflow` generates deterministic UUIDs. `crypto.randomUUID()` is not available in the sandbox.
- `log` from `@temporalio/workflow` is replay-aware and suppresses duplicate log messages during replay.

The sandbox does not expose Node.js or DOM APIs. Packages are safe to import only when their executed code does not reference those APIs. `WeakRef` and `FinalizationRegistry` are also unavailable because garbage-collection timing is nondeterministic.

Most importantly, do not perform external I/O directly in Workflow code. Database drivers, `fetch`, filesystem calls, environment-dependent reads, and similar operations observe state outside the Event History. Put that work in Activities and call it through a typed proxy. Activity results are recorded, so replay can use a stored result rather than repeating the external call. The next lesson examines that boundary in detail.

Determinism also applies when code changes. Adding, removing, or reordering Command-producing operations can make an in-progress execution's new code disagree with its existing history. Production deployments therefore need a Workflow versioning strategy; do not treat an already-running Workflow Definition like a stateless request handler that can accept arbitrary edits.

## Add a durable delivery window

Replace `src/workflows.ts` with this cumulative version:

```ts
import { log, proxyActivities, sleep } from '@temporalio/workflow';

import type * as activities from './activities';

const { deliverExecutiveReport } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  log.info('Report accepted', { reportDate });

  await sleep('20 seconds');

  log.info('Delivery window opened', { reportDate });
  return await deliverExecutiveReport(reportDate);
}
```

The wait is part of Workflow orchestration, not a process-local timer. Temporal records `TimerStarted`, and the Service can later record `TimerFired` even while no Worker is running. The sleeping execution consumes no Worker thread.

The Activity remains exactly as it was in the previous lesson. This experiment is about recovering Workflow state, not Activity failure behavior.

## Restart the Worker mid-execution

Keep the Temporal development service running. Start the Worker and wait until it reports that it is polling:

```sh
npm run start.watch
```

In another terminal, start the report Workflow:

```sh
npm run workflow
```

The Client prints the Workflow ID and waits for the result. Before 20 seconds pass, return to the Worker terminal and press <kbd>Control</kbd>+<kbd>C</kbd>. Wait until the 20-second window has passed, then start the Worker again:

```sh
npm run start.watch
```

The waiting Client should now print the same delivery result as before. Open [Temporal Web UI](http://localhost:8233), select that Workflow ID, and inspect its Event History. You should find the timer start and fire events before the Activity and Workflow completion events.

The restarted Worker did not restore a JavaScript heap snapshot. It replayed the definition against the stored history, reproduced the timer Command, consumed the recorded timer outcome, and continued with the next Command. The replay-aware logger avoids printing `Report accepted` a second time merely because the code ran again during replay.

If the Client terminal is also closed, the Workflow still continues. The Client requests and observes execution; it does not host the Workflow's state. You can find the execution later through its Workflow ID in the Web UI.

## Review the durability contract

- A Workflow Definition is code; a Workflow Execution is one durable run of that code.
- Commands request durable actions, and the Service records their outcomes as Events.
- Replay reconstructs local Workflow state by matching deterministic Commands to Event History.
- Durable waits survive Worker downtime without occupying a Worker thread.
- Workflow code orchestrates with replay-safe APIs; external I/O belongs in Activities.

## Official resources

- [Workflow basics and TypeScript sandbox behavior](https://docs.temporal.io/develop/typescript/workflows/basics)
- [Workflow Execution, Commands, and replay](https://docs.temporal.io/workflow-execution)
- [Events and Event History](https://docs.temporal.io/workflow-execution/event)
- [Durable Timers in the TypeScript SDK](https://docs.temporal.io/develop/typescript/workflows/timers)
- [TypeScript Workflow API reference](https://typescript.temporal.io/api/namespaces/workflow)
