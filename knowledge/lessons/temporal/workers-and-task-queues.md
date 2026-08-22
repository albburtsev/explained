---
slug: temporal/workers-and-task-queues
title: Workers and Task Queues
description: Understand how Temporal Workers register code, poll Task Queues, share work, and shut down without owning durable Workflow state.
tags:
  - temporal
  - typescript
  - workers
---

The report application now has durable Workflow orchestration and retryable Activities, but neither the Client nor the Temporal Service executes that TypeScript. Your Worker Process supplies the runtime in which the application code actually runs.

This lesson follows one report through its Workflow and Activity tasks, then uses the existing `executive-report` Task Queue to observe what happens with zero, one, and two Worker Processes.

## Separate the Worker program from the process

A `Worker Program` is the static TypeScript entry point that configures a Worker. Starting that program creates a `Worker Process`: a running Node.js process that connects to the Temporal Service, polls a Task Queue, executes registered code, and returns results.

The cumulative `src/worker.ts` should have this shape:

```ts
import { NativeConnection, Worker } from '@temporalio/worker';

import * as activities from './activities';

async function run() {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  });

  try {
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'executive-report',
      workflowsPath: require.resolve('./workflows'),
      activities,
    });

    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

`Worker.create()` prepares two kinds of application code differently:

- `workflowsPath` identifies the module whose exported Workflow Definitions are bundled for Temporal's isolated Workflow runtime. The Worker can load and replay `executiveReportWorkflow` from that bundle.
- `activities` is a mapping from Activity Type names to ordinary Node.js function implementations. Here it registers `fetchMetrics`, `renderExecutiveReport`, and `deliverReport`.

Registration tells this Worker which task types it can execute. It does not upload the code to the Service. Every Worker Process that polls this queue must run code compatible with the tasks it may receive.

`worker.run()` starts polling and remains pending while the Worker runs. The generated process also responds to shutdown signals. When you press <kbd>Control</kbd>+<kbd>C</kbd>, the SDK stops accepting new work and completes its shutdown sequence; only then does `worker.run()` settle and the `finally` block close the connection.

## Follow the two task types

`executive-report` is one routing name, but Workflow Tasks and Activity Tasks are distinct. Because this Worker registers both kinds of code, the SDK polls both task types under that name.

One pass through the application looks like this:

```text
Client
  │ start Workflow
  ▼
Temporal Service
  │ Workflow Task: advance executiveReportWorkflow
  ▼
Workflow poller ──▶ run bundled Workflow code ──▶ ScheduleActivity Command
  ▲                                                     │
  │                                                     ▼
Temporal Service ◀──────── record Commands and Events ──┘
  │ Activity Task: run fetchMetrics
  ▼
Activity poller ──▶ call the Node.js Activity ──▶ return result or failure
  │
  ▼
Temporal Service ──▶ record outcome and schedule the next Workflow Task
```

A `Workflow Task` asks a Worker to advance a Workflow Execution. The Worker replays or resumes the deterministic Workflow code, runs it until it must wait, and returns Commands such as scheduling an Activity or starting a timer. It does not hold the Workflow open on a thread while the Workflow waits.

An `Activity Task` asks a Worker to invoke one registered Activity implementation. That code runs in the normal Node.js environment and may perform external I/O. Its result, failure, timeout, or heartbeat becomes input to later Workflow progress through Event History.

This task boundary explains why `await fetchMetrics(reportDate)` is not a direct function call. One Workflow Task produces a Command, the Service creates an Activity Task, and a later Workflow Task observes the Activity outcome.

## Keep durable state in the Service

A Worker may cache a Workflow Execution in memory so a later Workflow Task can resume efficiently. That cache is an optimization, not the durable source of truth. The Temporal Service persists Event History and timers; it can give the next task to another compatible Worker, which reconstructs the Workflow state through replay.

Activity-local memory is not durable either. An Activity result is durable after the Service records it, and accepted heartbeat details can help a retry resume, but arbitrary variables in the Worker Process disappear when that process stops.

The ownership boundary is therefore:

| Component | Owns |
| --- | --- |
| Temporal Service | Event History, execution coordination, timers, and queued tasks |
| Worker Process | Workflow runtime, registered implementations, execution capacity, and temporary caches |
| Client | Requests and handles used to start or interact with executions |

Neither a Worker nor a Client has to remain alive during a durable wait. A compatible Worker is required only when an available task needs application code to make progress.

## Observe a queue with no poller

First stop every report Worker with <kbd>Control</kbd>+<kbd>C</kbd>, but leave the local Temporal Service running. Start a report Workflow in another terminal:

```sh
npm run workflow
```

The Client prints the Workflow ID and then waits. The start request succeeded: the Service stored the new execution and scheduled its first Workflow Task. Progress pauses because no Worker polls `executive-report`; the Service does not run the Workflow code as a fallback.

Inspect the logical Task Queue from another terminal:

```sh
temporal task-queue describe --task-queue executive-report
```

The command reports Workflow and Activity queue information, including recent pollers and approximate backlog statistics. Poller entries can remain visible briefly after a Worker stops because the Service reports recent polling activity, so use the last-access time together with the running terminals rather than treating the list as an instantaneous process registry.

Now start one Worker again:

```sh
npm run start.watch
```

It claims the waiting Workflow Task and advances the same execution. After the durable timer and the Activity retry from earlier lessons, the original Client receives the report result. Nothing had to restart the Workflow or recreate its input.

## Share the queue between two Workers

Leave the first Worker running and open another terminal in the same project. Start an identical second Worker Process:

```sh
npm run start.watch
```

Run the inspection command again:

```sh
temporal task-queue describe --task-queue executive-report
```

The poller information should now contain two Worker identities. The TypeScript SDK's default identity includes the process ID and host name, so two local processes can be distinguished without changing the application.

The Service matches each available task to one compatible poller; it does not broadcast a task to both processes. Different tasks from one Workflow Execution may run on different Workers. If a Workflow Task moves to the other process, deterministic replay restores its state. If an Activity attempt fails because its Worker disappears, the Activity timeout and Retry Policy from the previous lesson determine when another attempt can run.

Stop either Worker with <kbd>Control</kbd>+<kbd>C</kbd>, then run the Client again:

```sh
npm run workflow
```

The remaining Worker completes the report because it registers the same Workflow and Activity types and polls the same queue. This is the basic horizontal-scaling model: start more compatible Worker Processes to add execution capacity, and remove them through the Worker's shutdown lifecycle. Task Queues decouple that process count from Workflow identity and durable state.

The experiment does not guarantee that a small number of tasks will be split evenly. Polling is capacity-based, so one Worker may claim several tasks while both are healthy. The important observations are that each task has one executor, both Workers can accept work, and losing one process does not erase Workflow progress.

## Review the execution boundary

- A Worker Process polls for tasks and runs registered application code; the Temporal Service never runs that code.
- Workflow Tasks advance deterministic orchestration, while Activity Tasks invoke ordinary Node.js functions.
- One Task Queue name routes separate Workflow and Activity task types to compatible pollers.
- The Service owns durable Event History; Worker caches and process memory are replaceable.
- With no poller, tasks wait. With multiple compatible pollers, tasks are distributed according to available capacity.
- Graceful shutdown stops a Worker from taking new work and lets another compatible Worker continue future progress.

## Official resources

- [Temporal Workers](https://docs.temporal.io/workers)
- [Task Queues](https://docs.temporal.io/task-queue)
- [How SDKs work with the Temporal Service](https://docs.temporal.io/encyclopedia/architecture/temporal-sdks)
- [TypeScript `Worker` API](https://typescript.temporal.io/api/classes/worker.Worker)
- [TypeScript `WorkerOptions` API](https://typescript.temporal.io/api/interfaces/worker.WorkerOptions)
- [Temporal CLI `task-queue` command](https://docs.temporal.io/cli/command-reference/task-queue)
