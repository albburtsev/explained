---
slug: temporal/your-first-temporal-application
title: Your First Temporal Application
description: Run Temporal's TypeScript Hello World, map its components, and reshape it into a minimal executive-report application.
tags:
  - temporal
  - typescript
  - workflows
---

The project created on the course page already contains a complete Temporal application. Before changing it, run that application once and use it to identify where each Temporal primitive lives.

From the `temporal-bi-report` directory, inspect the generated files:

```text
src/
├── activities.ts
├── client.ts
├── worker.ts
└── workflows.ts
```

The generated sample is deliberately small: the Client starts the `example` Workflow, the Workflow calls the `greet` Activity, and the Activity returns a greeting.

## Run Hello World

Use three terminal windows. The first still runs the local Temporal Service from the course setup. In the second, start the generated Worker and leave it running:

```sh
npm run start.watch
```

The Worker builds the Workflow bundle and begins polling the `hello-world` Task Queue. In the third terminal, start a Workflow Execution through the generated Client:

```sh
npm run workflow
```

The Client prints the Workflow ID followed by the result:

```text
Started workflow workflow-<unique-id>
Hello, Temporal!
```

This one result crossed every important boundary in a Temporal application.

## Map the application

The components have distinct responsibilities:

- The `Temporal Service` stores execution state, coordinates tasks, and exposes execution data. It does not run your Workflow or Activity code.
- A `Client` sends commands to the Service. Here, `src/client.ts` starts a Workflow Execution and waits for its result.
- A `Workflow` describes the durable business sequence. The generated `example` Workflow asks Temporal to run one Activity.
- An `Activity` performs a fallible action, often involving an API, database, or another external system. The generated `greet` Activity only constructs a string.
- A `Worker` is your process. It loads Workflow and Activity definitions, polls for tasks, executes your code, and reports results to the Service.
- A `Task Queue` is the routing name between the Service and compatible Workers. The Client and Worker both use `hello-world`, so tasks reach the correct code.

The successful run follows this path:

```text
Client ──start──▶ Temporal Service ──Workflow task──▶ hello-world Task Queue
                                                            │
                                                            ▼
                                                         Worker
                                                            │
Workflow result ◀── Temporal Service ◀── Activity result ◀───┘
```

The queue does not contain your code. The Service places tasks there, and the Worker polls it when it has capacity. If the Worker is stopped, the Client can still ask the Service to start the Workflow, but `handle.result()` waits because no Worker is available to make progress.

## Reshape the sample into a report application

Now keep the same architecture but give it the domain used throughout this course. The first version simulates delivery so that the complete execution remains local. Later lessons will split it into real metric-fetching, rendering, and delivery Activities.

Replace `src/activities.ts` with:

```ts
export async function deliverExecutiveReport(
  reportDate: string,
): Promise<string> {
  const report = `Executive BI report for ${reportDate}`;

  return `${report} delivered to the leadership inbox`;
}
```

An Activity is an ordinary TypeScript function. Temporal invokes it through a task rather than through a direct function call from Workflow code.

Replace `src/workflows.ts` with:

```ts
import { proxyActivities } from '@temporalio/workflow';

import type * as activities from './activities';

const { deliverExecutiveReport } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  return await deliverExecutiveReport(reportDate);
}
```

`proxyActivities` creates a typed Activity proxy. Calling it schedules an Activity through Temporal; it does not import and execute the Activity implementation inside the Workflow runtime. The timeout is required because external work cannot be allowed to run without a bound.

In `src/worker.ts`, keep the generated connection and registration code, but change the Worker's Task Queue:

```ts
const worker = await Worker.create({
  connection,
  namespace: 'default',
  taskQueue: 'executive-report',
  workflowsPath: require.resolve('./workflows'),
  activities,
});
```

Finally, replace `src/client.ts` with:

```ts
import { Client, Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { nanoid } from 'nanoid';

import { executiveReportWorkflow } from './workflows';

async function run() {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection });
  const reportDate = new Date().toISOString().slice(0, 10);

  const handle = await client.workflow.start(executiveReportWorkflow, {
    taskQueue: 'executive-report',
    args: [reportDate],
    workflowId: `executive-report-${reportDate}-${nanoid()}`,
  });

  console.log(`Started workflow ${handle.workflowId}`);
  console.log(await handle.result());
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

The Workflow function supplies the Workflow Type, while `workflowId` identifies this particular execution. The date makes the ID recognizable in operational tools, and the random suffix keeps repeated practice runs distinct.

The Task Queue name in the Client must exactly match the name in the Worker. It is their routing contract. A mismatch does not normally reject the start request; it leaves the execution waiting on a queue that no compatible Worker polls.

## Run and inspect the report Workflow

The Worker running under `start.watch` restarts when the source files change. Wait until it reports that it is running again, then use the Client terminal:

```sh
npm run workflow
```

The final line should resemble:

```text
Executive BI report for 2026-08-22 delivered to the leadership inbox
```

Open [Temporal Web UI](http://localhost:8233), select the `default` Namespace, and find the execution whose Workflow ID starts with `executive-report-`. Its details should show:

- a completed status;
- Workflow Type `executiveReportWorkflow`;
- Task Queue `executive-report`;
- an Event History containing the Workflow start, Activity scheduling and completion, and Workflow completion.

The Event History is the Service's durable record of what happened. For now, use it only as evidence that the Client, Service, queue, Worker, Workflow, and Activity participated in the same execution. The next lessons explain how Workflow code and Activity execution use that record to survive failures.

## Official resources

- [Temporal TypeScript quickstart](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript)
- [Official TypeScript Hello World sample](https://github.com/temporalio/samples-typescript/tree/main/hello-world)
- [Task Queues](https://docs.temporal.io/task-queue)
- [Temporal Workers](https://docs.temporal.io/workers)
